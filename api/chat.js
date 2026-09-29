import { createClient } from '@supabase/supabase-js'
import { streamChat, ProviderNotConfiguredError } from './_lib/ai/index.js'
import { checkUsage, recordUsage, limitMessage } from './_lib/limits.js'

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
- For assignments and problem sets, walk them toward the answer with hints and questions. Do not hand over a finished solution they could submit. Fully solving a different problem that uses the same idea is fine, and often the quickest way to unstick them.
- Keep replies short and conversational — this is a spoken-style back-and-forth, not a lecture. A few sentences is usually right.
- Ground your answers in the course materials below. If something they ask about is not covered there, say so rather than inventing what their course says.
- If the materials are unclear or contradict what they remember, tell them; do not paper over it.
- Materials may include transcribed photos of worksheets or of the student's handwritten work. Treat a bracketed [illegible] as unreadable and ask about it rather than guessing.

Formatting: replies are rendered as Markdown. Use a short numbered list for steps and bold sparingly; skip headings. Write all math in LaTeX, $...$ inline and $$...$$ on its own line for anything longer, and write a dollar amount as \\$5 so it is not read as math.`

// Reply modes the student can pick for a message. Each adds an instruction to
// that message, so the mode is kept with the message and replayed with it on
// every later turn, and the prompt for a conversation stays the same each time.
const INTENT_INSTRUCTIONS = {
  hint: 'The student asked for a hint. Give one small hint toward their next step: the smallest nudge that could unstick them. Do not do the step for them. End by asking what they would try.',
  example:
    "The student asked for a worked example. Make up a new problem that tests the same idea as the one they are working on, with different numbers and details, and solve it completely, step by step, saying why each step is taken. Then hand their own problem back and ask them to try its first step. Do not solve their actual problem, even partly, and do not reuse its numbers.",
  check:
    'The student wants their work checked. Go through it step by step. Find the first step that is wrong, point to it, and explain what went wrong and why, without giving the corrected result or the final answer; ask them to redo it from that step. If a later step has a separate mistake, say that there is one and where, without fixing it. If everything is right, say so plainly, and flag anything that came out right by luck. If they gave only an answer with no working, ask to see their steps.',
  essay:
    "The student wants feedback on a piece of their writing (pasted, or attached as a document). Respond as a writing tutor. Start with what works. Then give the two or three changes that would improve it most, in order of impact: the thesis (is it arguable and specific?), structure and flow, whether the evidence supports each claim, and clarity. Point to the exact place each time by quoting a few words. Explain the problem and ask a question that helps them fix it; do not rewrite their sentences or paragraphs for them, and do not write new content they could paste in. Mention grammar only if it gets in the way of meaning. If they ask how to format a citation, show the format using the source details they give. If no writing is included, ask them to paste or attach it.",
}

const INTENTS = Object.keys(INTENT_INSTRUCTIONS)

// A document at most this long goes into the prompt whole even when the
// materials as a whole are over budget: a photo of a worksheet is short and the
// student expects the tutor to see all of it.
const WHOLE_DOCUMENT_CHARS = 8_000

// Passages sent with each message from documents too long to include whole.
const EXCERPT_BUDGET = 30_000
const EXCERPT_CANDIDATES = 40

const escapeAttr = (value) => String(value).replace(/"/g, '&quot;')

/** The student's message as the model sees it: its mode instruction first. */
const forModel = ({ content, intent }) =>
  intent && INTENT_INSTRUCTIONS[intent]
    ? `<request_mode>${INTENT_INSTRUCTIONS[intent]}</request_mode>\n\n${content}`
    : content

/**
 * Decides which documents go into the prompt whole and which are searched.
 *
 * Everything goes in whole when it fits the budget, as before: the system
 * prompt is then identical on every turn and served from cache. Otherwise short
 * documents still go in whole, and the long ones are searched per message.
 */
const planContext = (documents) => {
  const total = documents.reduce((sum, doc) => sum + doc.extracted_text.length, 0)
  if (total <= CONTEXT_BUDGET) return { whole: documents, searched: [] }

  const whole = []
  const searched = []
  let used = 0
  // Shortest first, so as many whole documents fit as possible.
  for (const doc of [...documents].sort((a, b) => a.extracted_text.length - b.extracted_text.length)) {
    const size = doc.extracted_text.length
    if (size <= WHOLE_DOCUMENT_CHARS && used + size <= CONTEXT_BUDGET - EXCERPT_BUDGET) {
      whole.push(doc)
      used += size
    } else {
      searched.push(doc)
    }
  }
  return { whole, searched }
}

/**
 * Passages from the searched documents that best match what the student just
 * asked, plus their previous message so a follow-up like "why?" still finds the
 * topic. Returned in document order, so neighbouring passages read on.
 */
const findExcerpts = async (supabase, conversationId, searched, query) => {
  if (!searched.length || !query.trim()) return ''

  const titles = new Map(searched.map((doc) => [doc.id, doc.title]))
  const { data, error } = await supabase.rpc('match_document_chunks', {
    p_conversation_id: conversationId,
    p_query: query.slice(0, 2000),
    p_limit: EXCERPT_CANDIDATES,
  })
  if (error || !data?.length) return ''

  const picked = []
  let used = 0
  for (const chunk of data) {
    if (!titles.has(chunk.document_id)) continue
    if (used + chunk.content.length > EXCERPT_BUDGET) break
    picked.push(chunk)
    used += chunk.content.length
  }
  if (!picked.length) return ''

  picked.sort((a, b) =>
    a.document_id === b.document_id ? a.position - b.position : titles.get(a.document_id).localeCompare(titles.get(b.document_id))
  )

  const body = picked
    .map(
      (chunk) =>
        `<excerpt document="${escapeAttr(titles.get(chunk.document_id))}" part="${chunk.position + 1}">\n${chunk.content}\n</excerpt>`
    )
    .join('\n')
  return `<excerpts>\n${body}\n</excerpts>`
}

export const buildSystemPrompt = ({ whole, searched }) => {
  if (!whole.length && !searched.length) {
    return `${SYSTEM_PREAMBLE}\n\nThe student has not attached any course materials to this conversation, so answer from general knowledge and say when you are doing so.`
  }

  const parts = [SYSTEM_PREAMBLE]

  if (whole.length) {
    const sections = whole.map(
      (doc) => `<document title="${escapeAttr(doc.title)}">\n${doc.extracted_text}\n</document>`
    )
    parts.push(`The student's course materials for this conversation:\n\n${sections.join('\n\n')}`)
  }

  if (searched.length) {
    const titles = searched.map((doc) => `"${doc.title}"`).join(', ')
    parts.push(
      `These documents are too long to include in full: ${titles}. With each message you get the passages from them that best match the student's question, in <excerpts>. If the passages do not cover what they ask about, say so and ask which page or section they mean, or ask them to paste it, rather than guessing what the document says.`
    )
  }

  return parts.join('\n\n')
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

  const { conversationId, message, deep, intent: requestedIntent, documentId } = req.body ?? {}
  if (!conversationId || !message?.trim()) {
    return res.status(400).json({ error: 'conversationId and a non-empty message are required.' })
  }
  const intent = INTENTS.includes(requestedIntent) ? requestedIntent : null

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

  // Checked before any model work, and before the user's message is written, so
  // a refused turn leaves no trace in the conversation.
  const usage = await checkUsage(supabase, user.id)
  if (!usage.allowed) {
    res.setHeader('Retry-After', String(Math.max(60, Math.round((new Date(usage.resetAt) - Date.now()) / 1000))))
    return res.status(429).json({
      error: limitMessage(usage),
      window: usage.window,
      resetAt: usage.resetAt,
    })
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
      .select('documents(id, title, extracted_text, status)')
      .eq('conversation_id', conversationId),
    supabase
      .from('messages')
      .select('role, content, intent')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
  ])

  const linkedDocuments = (linked ?? []).map((row) => row.documents).filter(Boolean)
  // Sorted, because the query has no guaranteed order: documents appearing in a
  // different order would change the system prompt and miss the cache.
  const documents = linkedDocuments
    .filter((doc) => doc.status === 'ready' && doc.extracted_text)
    .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))

  // An attachment is recorded only if it really belongs to this conversation.
  const attachedId = linkedDocuments.some((doc) => doc.id === documentId) ? documentId : null

  const { error: userMessageError } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: message,
    intent,
    document_id: attachedId,
  })
  if (userMessageError) {
    return res.status(500).json({ error: userMessageError.message })
  }

  const priorTurns = (history ?? [])
    .filter((turn) => turn.role !== 'system')
    .slice(-HISTORY_TURNS)

  const plan = planContext(documents)
  const lastStudentTurn = [...priorTurns].reverse().find((turn) => turn.role === 'user')
  const excerpts = await findExcerpts(
    supabase,
    conversationId,
    plan.searched,
    `${message} ${lastStudentTurn?.content ?? ''}`
  )
  const current = forModel({ content: message, intent })

  // Stream as plain text: the client appends chunks straight to the open reply.
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Accel-Buffering', 'no')

  let assembled = ''

  try {
    const { text, usage: spent } = await streamChat({
      system: buildSystemPrompt(plan),
      messages: [
        ...priorTurns.map((turn) => ({ role: turn.role, content: forModel(turn) })),
        // Excerpts ride on this message only: they are chosen for this question,
        // and keeping them out of the system prompt keeps that cacheable.
        { role: 'user', content: excerpts ? `${excerpts}\n\n${current}` : current },
      ],
      signal: req.signal,
      // Strictly true, so a malformed body falls back to the cheaper tier.
      deep: deep === true,
      onDelta: (chunk) => {
        assembled += chunk
        res.write(chunk)
      },
    })

    // Recorded first, before anything else that could fail: the money is already
    // spent, so the allowance has to reflect it whatever happens next.
    await recordUsage(supabase, user.id, spent)

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
    // A reply that failed or was cancelled partway was still billed for what it
    // used; the adapter attaches that as error.usage. With no usage at all the
    // request never reached the model, so there is nothing to meter.
    if (error?.usage) await recordUsage(supabase, user.id, error.usage)

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
