import { createClient } from '@supabase/supabase-js'
import { ProviderNotConfiguredError, generate } from './_lib/ai/index.js'
import { checkUsage, limitMessage, recordUsage } from './_lib/limits.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

// Most course material a single generation reads, shared evenly across the
// chosen documents. Roughly a long textbook chapter.
const MATERIALS_BUDGET = 150_000
const MAX_DOCUMENTS = 10

const ASSIGNMENT_KINDS = ['homework', 'reading', 'quiz', 'exam', 'project', 'essay', 'other']

// The same rule the tutor follows in chat: study aids are fine, answers to the
// student's own homework are not.
const SYSTEM = `You make study material for a student from their own course materials. The materials follow in <document> tags.

Ground everything in the materials. Do not add facts the materials do not support; if they are thin on a topic, cover less rather than inventing.

If the materials contain homework, assignment, or problem-set questions the student has to hand in, do not solve them or reveal their answers anywhere in what you produce. Test the same ideas with new questions of your own instead.

Write all math in LaTeX: $...$ inline, $$...$$ for displayed equations. Write a dollar amount as \\$5.`

const strictObject = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})

const KINDS = {
  syllabus: {
    maxTokens: 8000,
    schema: strictObject({
      assignments: {
        type: 'array',
        items: strictObject({
          title: { type: 'string' },
          kind: { type: 'string', enum: ASSIGNMENT_KINDS },
          due_date: { type: 'string', description: 'YYYY-MM-DD' },
          due_time: { type: 'string', description: 'HH:MM in 24-hour time, or empty if none is given' },
          notes: { type: 'string', description: 'Short detail worth remembering, or empty' },
        }),
      },
    }),
    prompt: ({ today }) =>
      `Find every dated deliverable in these materials: homework, readings with a due date, quizzes, exams, projects, essays. Today is ${today}. When a date gives no year, use the one that puts it in the current term, nearest after today. Resolve relative dates ("week 3 Friday") only when the materials say when the term starts; otherwise leave that item out. Use a short, specific title (e.g. "Problem Set 3", "Midterm exam"). Skip class meetings, office hours, and anything with no date. If there are none, return an empty list.`,
  },
  flashcards: {
    maxTokens: 16000,
    schema: strictObject({
      title: { type: 'string', description: 'A short name for the deck' },
      cards: {
        type: 'array',
        items: strictObject({
          front: { type: 'string', description: 'A question or a term' },
          back: { type: 'string', description: 'The answer, in one to three sentences' },
        }),
      },
    }),
    prompt: ({ count }) =>
      `Make ${count} flashcards covering the most important ideas in these materials: key terms, definitions, relationships, formulas, and the reasoning behind them. Each card tests one thing. Prefer "why" and "how" cards over bare definitions where the material supports them. Keep each back short enough to check at a glance.`,
  },
  quiz: {
    maxTokens: 16000,
    schema: strictObject({
      title: { type: 'string', description: 'A short name for the quiz' },
      questions: {
        type: 'array',
        items: strictObject({
          question: { type: 'string' },
          choices: { type: 'array', items: { type: 'string' }, description: 'Exactly four options' },
          answer: { type: 'integer', description: 'Index 0-3 of the correct choice' },
          explanation: { type: 'string', description: 'Why that answer is right and the likeliest wrong one is wrong' },
        }),
      },
    }),
    prompt: ({ count }) =>
      `Write a practice quiz of ${count} multiple-choice questions on these materials, like the ones a good instructor would put on an exam. Each question has exactly four choices and one correct answer. Make the wrong choices plausible: the mistakes a student who half-understands would make. Mix recall with application, and put the correct answer in different positions.`,
  },
  guide: {
    maxTokens: 12000,
    schema: null,
    prompt: () =>
      `Write a study guide for these materials in Markdown: a one-paragraph overview, then the main topics as ## sections. Under each, the key ideas in short bullets, any formulas with what each symbol means, and a worked example where one helps (made up, not taken from a homework problem). End with a "## Check yourself" section of five questions with no answers given. Be concise: this is for review, not a replacement for the materials.`,
  },
}

const clampCount = (value, fallback, max) => {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? Math.min(Math.max(n, 5), max) : fallback
}

const packMaterials = (documents) => {
  const perDocument = Math.floor(MATERIALS_BUDGET / documents.length)
  let clipped = false
  const body = documents
    .map((doc) => {
      const text = doc.extracted_text
      if (text.length > perDocument) clipped = true
      return `<document title="${String(doc.title).replace(/"/g, '&quot;')}">\n${text.slice(0, perDocument)}\n</document>`
    })
    .join('\n\n')
  return { body, clipped }
}

const titleFrom = (documents, fallback) =>
  documents.length === 1 ? documents[0].title : `${documents[0].title} and ${documents.length - 1} more`

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

  const { kind, documentIds, courseId, count, today } = req.body ?? {}
  const spec = KINDS[kind]
  if (!spec) {
    return res.status(400).json({ error: `kind must be one of: ${Object.keys(KINDS).join(', ')}.` })
  }
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return res.status(400).json({ error: 'Choose at least one document.' })
  }
  if (documentIds.length > MAX_DOCUMENTS) {
    return res.status(400).json({ error: `Choose at most ${MAX_DOCUMENTS} documents at a time.` })
  }

  // The caller's own token, so every query below runs under row-level security.
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

  const { data: rows, error: docsError } = await supabase
    .from('documents')
    .select('id, title, extracted_text, status, course_id')
    .in('id', documentIds)
  if (docsError) return res.status(500).json({ error: docsError.message })

  const documents = (rows ?? [])
    .filter((doc) => doc.status === 'ready' && doc.extracted_text)
    .sort((a, b) => a.title.localeCompare(b.title))
  if (!documents.length) {
    return res.status(400).json({ error: 'None of those documents are ready to read yet.' })
  }

  // File the result under the chosen course, or the one course all the
  // documents share. A course id that is not the caller's is dropped by RLS.
  let course = null
  const candidate = courseId ?? (new Set(documents.map((d) => d.course_id)).size === 1 ? documents[0].course_id : null)
  if (candidate) {
    const { data } = await supabase.from('courses').select('id').eq('id', candidate).maybeSingle()
    course = data?.id ?? null
  }

  const usage = await checkUsage(supabase, user.id)
  if (!usage.allowed) {
    return res.status(429).json({ error: limitMessage(usage), window: usage.window, resetAt: usage.resetAt })
  }

  const { body: materials, clipped } = packMaterials(documents)
  const safeToday = /^\d{4}-\d{2}-\d{2}$/.test(today ?? '') ? today : new Date().toISOString().slice(0, 10)

  let result
  try {
    result = await generate({
      system: SYSTEM,
      materials,
      prompt: spec.prompt({
        today: safeToday,
        count: kind === 'quiz' ? clampCount(count, 10, 25) : clampCount(count, 20, 40),
      }),
      schema: spec.schema,
      maxTokens: spec.maxTokens,
      signal: req.signal,
    })
  } catch (error) {
    if (error?.usage) await recordUsage(supabase, user.id, error.usage, 'generation')
    const message =
      error instanceof ProviderNotConfiguredError ? error.message : (error?.message ?? 'Generation failed.')
    return res.status(502).json({ error: message })
  }

  await recordUsage(supabase, user.id, result.usage, 'generation')

  const note = clipped ? 'Some long documents were only partly read.' : null

  if (kind === 'syllabus') {
    // Returned for the student to review, not saved: dates pulled from a
    // syllabus are worth a human look before they drive the planner.
    const assignments = (result.data.assignments ?? [])
      .filter((a) => a.title?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(a.due_date))
      .map((a) => ({
        title: a.title.trim().slice(0, 200),
        kind: ASSIGNMENT_KINDS.includes(a.kind) ? a.kind : 'other',
        due_date: a.due_date,
        due_time: /^\d{2}:\d{2}$/.test(a.due_time) ? a.due_time : '',
        notes: (a.notes ?? '').trim().slice(0, 2000),
      }))
    return res.status(200).json({ assignments, sourceDocumentId: documents.length === 1 ? documents[0].id : null, courseId: course, note })
  }

  if (kind === 'flashcards') {
    const cards = (result.data.cards ?? [])
      .map((c) => ({ front: c.front?.trim().slice(0, 2000), back: c.back?.trim().slice(0, 4000) }))
      .filter((c) => c.front && c.back)
    if (!cards.length) return res.status(502).json({ error: 'No cards could be made from those materials.' })

    const { data: deck, error } = await supabase
      .from('decks')
      .insert({ user_id: user.id, course_id: course, title: (result.data.title?.trim() || titleFrom(documents)).slice(0, 200) })
      .select('id')
      .single()
    if (error) return res.status(500).json({ error: error.message })

    const { error: cardsError } = await supabase
      .from('cards')
      .insert(cards.map((card, position) => ({ ...card, position, deck_id: deck.id, user_id: user.id })))
    if (cardsError) return res.status(500).json({ error: cardsError.message })

    return res.status(200).json({ id: deck.id, count: cards.length, note })
  }

  if (kind === 'quiz') {
    const questions = (result.data.questions ?? []).filter(
      (q) =>
        q.question?.trim() &&
        Array.isArray(q.choices) &&
        q.choices.length === 4 &&
        q.choices.every((c) => typeof c === 'string' && c.trim()) &&
        Number.isInteger(q.answer) &&
        q.answer >= 0 &&
        q.answer < 4
    )
    if (!questions.length) return res.status(502).json({ error: 'No questions could be made from those materials.' })

    const { data: quiz, error } = await supabase
      .from('quizzes')
      .insert({
        user_id: user.id,
        course_id: course,
        title: (result.data.title?.trim() || titleFrom(documents)).slice(0, 200),
        questions,
      })
      .select('id')
      .single()
    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({ id: quiz.id, count: questions.length, note })
  }

  // guide
  const content = result.text.trim()
  if (!content) return res.status(502).json({ error: 'The study guide came back empty. Try again.' })

  const { data: guide, error } = await supabase
    .from('study_guides')
    .insert({ user_id: user.id, course_id: course, title: `Study guide: ${titleFrom(documents)}`.slice(0, 200), content })
    .select('id')
    .single()
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ id: guide.id, note })
}
