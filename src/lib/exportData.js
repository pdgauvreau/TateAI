import { supabase } from './supabase'

/**
 * Builds a complete copy of everything the service holds for this user and hands
 * it to the browser as a download.
 *
 * The privacy policy promises this, so it has to actually be complete: profile,
 * every document including its extracted text, every conversation with its
 * full message history, and everything made for studying: courses,
 * assignments, flashcard decks with their review history, quizzes, and study
 * guides. The original PDFs are not included — they are already on
 * the user's machine, and bundling them would mean a zip and a much larger file.
 */
export const exportAllData = async () => {
  const results = await Promise.all([
    supabase.from('profiles').select('*').single(),
    supabase.from('documents').select('*'),
    supabase.from('conversations').select('*'),
    supabase.from('messages').select('*'),
    supabase.from('conversation_documents').select('*'),
    supabase.from('courses').select('*'),
    supabase.from('assignments').select('*'),
    supabase.from('decks').select('*'),
    supabase.from('cards').select('*'),
    supabase.from('quizzes').select('*'),
    supabase.from('study_guides').select('*'),
  ])
  const [profile, documents, conversations, messages, links, courses, assignments, decks, cards, quizzes, guides] =
    results

  const failure = results.find((r) => r.error)
  if (failure) return { error: failure.error.message }

  const byConversation = (id) =>
    (messages.data ?? [])
      .filter((m) => m.conversation_id === id)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  const payload = {
    exported_at: new Date().toISOString(),
    profile: profile.data,
    documents: documents.data ?? [],
    conversations: (conversations.data ?? []).map((conversation) => ({
      ...conversation,
      document_ids: (links.data ?? [])
        .filter((l) => l.conversation_id === conversation.id)
        .map((l) => l.document_id),
      messages: byConversation(conversation.id),
    })),
    courses: courses.data ?? [],
    assignments: assignments.data ?? [],
    flashcard_decks: (decks.data ?? []).map((deck) => ({
      ...deck,
      cards: (cards.data ?? []).filter((c) => c.deck_id === deck.id).sort((a, b) => a.position - b.position),
    })),
    quizzes: quizzes.data ?? [],
    study_guides: guides.data ?? [],
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `tate-ai-export-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)

  return { ok: true }
}
