import { supabase } from './supabase'

/**
 * Builds a complete copy of everything the service holds for this user and hands
 * it to the browser as a download.
 *
 * The privacy policy promises this, so it has to actually be complete: profile,
 * every document including its extracted text, and every conversation with its
 * full message history. The original PDFs are not included — they are already on
 * the user's machine, and bundling them would mean a zip and a much larger file.
 */
export const exportAllData = async () => {
  const [profile, documents, conversations, messages, links] = await Promise.all([
    supabase.from('profiles').select('*').single(),
    supabase.from('documents').select('*'),
    supabase.from('conversations').select('*'),
    supabase.from('messages').select('*'),
    supabase.from('conversation_documents').select('*'),
  ])

  const failure = [profile, documents, conversations, messages, links].find((r) => r.error)
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
