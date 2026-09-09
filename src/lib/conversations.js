import { supabase } from './supabase'

export const listConversations = async () =>
  supabase
    .from('conversations')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false })

export const getConversation = async (id) =>
  supabase.from('conversations').select('id, title').eq('id', id).single()

export const listMessages = async (conversationId) =>
  supabase
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

export const listConversationDocuments = async (conversationId) =>
  supabase
    .from('conversation_documents')
    .select('document_id, documents(title)')
    .eq('conversation_id', conversationId)

/** Creates a conversation and attaches the chosen documents to it. */
export const createConversation = async ({ userId, title, documentIds }) => {
  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title: title || 'New conversation' })
    .select('id')
    .single()

  if (error) return { error: error.message }

  if (documentIds?.length) {
    const { error: linkError } = await supabase
      .from('conversation_documents')
      .insert(
        documentIds.map((documentId) => ({
          conversation_id: conversation.id,
          document_id: documentId,
        }))
      )

    if (linkError) return { error: linkError.message, id: conversation.id }
  }

  return { id: conversation.id }
}

export const deleteConversation = async (id) => {
  const { error } = await supabase.from('conversations').delete().eq('id', id)
  return { error: error?.message ?? null }
}

/**
 * Sends a message and streams the reply.
 *
 * `onDelta` receives text as it arrives so the UI can render the reply while it
 * is still being written. Resolves with the complete text once the stream ends.
 */
export const sendMessage = async ({ conversationId, message, onDelta, signal }) => {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) return { error: 'Your session expired. Sign in again.' }

  let response
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ conversationId, message }),
      signal,
    })
  } catch (networkError) {
    if (networkError.name === 'AbortError') return { aborted: true }
    return {
      error:
        'Could not reach the chat API. If you are running `npm run dev`, use `npm run dev:api` instead — plain Vite does not serve /api routes.',
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    return { error: payload.error ?? `Request failed (${response.status}).` }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let full = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      full += chunk
      onDelta?.(chunk)
    }
  } catch (streamError) {
    if (streamError.name === 'AbortError') return { text: full, aborted: true }
    return { error: streamError.message, text: full }
  }

  return { text: full }
}
