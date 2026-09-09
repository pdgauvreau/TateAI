import { createClient } from '@supabase/supabase-js'
import { streamChat, ProviderNotConfiguredError } from './_lib/ai/index.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

// How much course material to put in front of the model. This is a blunt
// character budget shared across the conversation's documents — fine for a set of
// lecture slides, not for a whole textbook. Retrieval (embed and pull only the
// relevant passages) is the real fix once documents get large.
const CONTEXT_BUDGET = 60_000

// Recent turns kept in the prompt. Older ones drop off rather than growing the
// request without bound.
const HISTORY_TURNS = 20

const SYSTEM_PREAMBLE = `You are TATE AI, a study partner helping a student understand their own course materials.

How to work with them:
- Prefer questions over answers. Ask them to explain a concept in their own words, then correct and extend what they say.
- When they are wrong, say so plainly and explain why. Do not agree to be encouraging.
- For assignments and problem sets, walk them toward the answer with hints and questions. Do not hand over a finished solution they could submit.
- Keep replies short and conversational — this is a spoken-style back-and-forth, not a lecture. A few sentences is usually right.
- Ground your answers in the course materials below. If something they ask about is not covered there, say so rather than inventing what their course says.
- If the materials are unclear or contradict what they remember, tell them; do not paper over it.`

const buildSystemPrompt = (documents) => {
  if (!documents.length) {
    return `${SYSTEM_PREAMBLE}\n\nThe student has not attached any course materials to this conversation, so answer from general knowledge and say when you are doing so.`
  }

  // Share the budget evenly so one long document cannot crowd the others out.
  const perDocument = Math.floor(CONTEXT_BUDGET / documents.length)
  const sections = documents.map((doc) => {
    const body = doc.extracted_text ?? ''
    const clipped = body.length > perDocument
    return `<document title="${doc.title}">\n${clipped ? `${body.slice(0, perDocument)}\n[... truncated ...]` : body}\n</document>`
  })

  return `${SYSTEM_PREAMBLE}\n\nThe student's course materials for this conversation:\n\n${sections.join('\n\n')}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Server is missing Supabase configuration.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token.' })
  }

  const { conversationId, message } = req.body ?? {}
  if (!conversationId || !message?.trim()) {
    return res.status(400).json({ error: 'conversationId and a non-empty message are required.' })
  }

  // Same posture as the extraction endpoint: the caller's own token, so every
  // read and write below stays subject to row-level security.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid or expired session.' })
  }

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .single()
  if (conversationError || !conversation) {
    return res.status(404).json({ error: 'Conversation not found.' })
  }

  const [{ data: linked }, { data: history }] = await Promise.all([
    supabase
      .from('conversation_documents')
      .select('documents(title, extracted_text, status)')
      .eq('conversation_id', conversationId),
    supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
  ])

  const documents = (linked ?? [])
    .map((row) => row.documents)
    .filter((doc) => doc && doc.status === 'ready' && doc.extracted_text)

  const { error: userMessageError } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, role: 'user', content: message })
  if (userMessageError) {
    return res.status(500).json({ error: userMessageError.message })
  }

  const priorTurns = (history ?? [])
    .filter((turn) => turn.role !== 'system')
    .slice(-HISTORY_TURNS)

  // Stream as plain text: the client appends chunks straight to the open reply.
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Accel-Buffering', 'no')

  let assembled = ''

  try {
    const { text } = await streamChat({
      system: buildSystemPrompt(documents),
      messages: [...priorTurns, { role: 'user', content: message }],
      signal: req.signal,
      onDelta: (chunk) => {
        assembled += chunk
        res.write(chunk)
      },
    })

    await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, role: 'assistant', content: text })

    // Touching the conversation moves it up the client's most-recent ordering.
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    return res.end()
  } catch (error) {
    const message =
      error instanceof ProviderNotConfiguredError
        ? error.message
        : (error?.message ?? 'The model request failed.')

    // Anything already streamed is real output the user has read, so keep it and
    // append the error rather than discarding the turn.
    if (assembled) {
      await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, role: 'assistant', content: assembled })
      res.write(`\n\n[interrupted: ${message}]`)
      return res.end()
    }

    if (!res.headersSent) {
      return res.status(500).json({ error: message })
    }
    res.write(`[error: ${message}]`)
    return res.end()
  }
}
