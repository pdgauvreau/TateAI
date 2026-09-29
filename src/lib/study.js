import { supabase } from './supabase'
import { authedFetch } from './api'
import { schedule } from './srs'

/**
 * Flashcard decks, quizzes, and study guides.
 *
 * All three are made by /api/generate from documents the student picks, then
 * read and updated here directly under row-level security.
 */

export const STUDY_KINDS = {
  flashcards: { label: 'Flashcards', noun: 'deck', path: 'cards', table: 'decks' },
  quiz: { label: 'Practice quiz', noun: 'quiz', path: 'quiz', table: 'quizzes' },
  guide: { label: 'Study guide', noun: 'guide', path: 'guide', table: 'study_guides' },
}

/** Makes a deck, quiz, or guide; resolves to { id } or { error }. */
export const generateStudy = async ({ kind, documentIds, courseId }) =>
  authedFetch('/api/generate', { kind, documentIds, courseId: courseId ?? null })

/**
 * Every study item, newest first, with how many cards are due in each deck.
 * One list, so the dashboard can show them together and filter by course.
 */
export const listStudyItems = async () => {
  const now = new Date().toISOString()
  const [decks, dueCards, quizzes, guides] = await Promise.all([
    supabase.from('decks').select('id, title, course_id, created_at, cards(count)'),
    supabase.from('cards').select('deck_id').lte('due_at', now),
    supabase.from('quizzes').select('id, title, course_id, created_at, best_score, attempts, questions'),
    supabase.from('study_guides').select('id, title, course_id, created_at'),
  ])

  const error = decks.error ?? dueCards.error ?? quizzes.error ?? guides.error
  if (error) return { error: error.message }

  const dueByDeck = new Map()
  for (const card of dueCards.data ?? []) dueByDeck.set(card.deck_id, (dueByDeck.get(card.deck_id) ?? 0) + 1)

  const items = [
    ...(decks.data ?? []).map((d) => ({
      kind: 'flashcards',
      id: d.id,
      title: d.title,
      course_id: d.course_id,
      created_at: d.created_at,
      total: d.cards?.[0]?.count ?? 0,
      due: dueByDeck.get(d.id) ?? 0,
    })),
    ...(quizzes.data ?? []).map((q) => ({
      kind: 'quiz',
      id: q.id,
      title: q.title,
      course_id: q.course_id,
      created_at: q.created_at,
      total: q.questions?.length ?? 0,
      best: q.best_score,
      attempts: q.attempts,
    })),
    ...(guides.data ?? []).map((g) => ({
      kind: 'guide',
      id: g.id,
      title: g.title,
      course_id: g.course_id,
      created_at: g.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return { items }
}

export const deleteStudyItem = async (kind, id) => supabase.from(STUDY_KINDS[kind].table).delete().eq('id', id)

// --------------------------------------------------------------- flashcards --

export const getDeck = async (id) => {
  const [deck, cards] = await Promise.all([
    supabase.from('decks').select('id, title, course_id').eq('id', id).single(),
    supabase
      .from('cards')
      .select('id, front, back, due_at, interval_days, ease, reps, lapses, position')
      .eq('deck_id', id)
      .order('position', { ascending: true }),
  ])
  if (deck.error) return { error: deck.error.message }
  if (cards.error) return { error: cards.error.message }
  return { deck: deck.data, cards: cards.data ?? [] }
}

/** Applies a rating and saves the card's new schedule; resolves to the updated card. */
export const reviewCard = async (card, rating) => {
  const next = schedule(card, rating)
  const { error } = await supabase.from('cards').update(next).eq('id', card.id)
  if (error) return { error: error.message }
  return { card: { ...card, ...next } }
}

export const deleteCard = async (id) => supabase.from('cards').delete().eq('id', id)

// ------------------------------------------------------------------ quizzes --

export const getQuiz = async (id) => {
  const { data, error } = await supabase
    .from('quizzes')
    .select('id, title, course_id, questions, best_score, attempts')
    .eq('id', id)
    .single()
  if (error) return { error: error.message }
  return { quiz: data }
}

export const recordQuizAttempt = async (quiz, score) => {
  const best = quiz.best_score === null ? score : Math.max(quiz.best_score, score)
  const { error } = await supabase
    .from('quizzes')
    .update({ best_score: best, attempts: (quiz.attempts ?? 0) + 1 })
    .eq('id', quiz.id)
  if (error) return { error: error.message }
  return { best_score: best, attempts: (quiz.attempts ?? 0) + 1 }
}

// ------------------------------------------------------------ study guides --

export const getGuide = async (id) => {
  const { data, error } = await supabase
    .from('study_guides')
    .select('id, title, course_id, content, created_at')
    .eq('id', id)
    .single()
  if (error) return { error: error.message }
  return { guide: data }
}
