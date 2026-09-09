import { supabase } from './supabase'

export const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB
export const ACCEPTED_MIME = 'application/pdf'

export const formatBytes = (bytes) => {
  if (!bytes) return '—'
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export const validateFile = (file) => {
  // Checking the extension too: some browsers report an empty type for files
  // dragged from certain apps.
  const looksPdf = file.type === ACCEPTED_MIME || file.name.toLowerCase().endsWith('.pdf')
  if (!looksPdf) return 'Only PDF files are supported right now.'
  if (file.size > MAX_FILE_BYTES) return `That file is ${formatBytes(file.size)}. The limit is 25 MB.`
  if (file.size === 0) return 'That file is empty.'
  return null
}

export const listDocuments = async () =>
  supabase
    .from('documents')
    .select('id, title, status, status_detail, size_bytes, created_at')
    .order('created_at', { ascending: false })

/**
 * Creates the row, uploads the file, then asks the API to extract its text.
 *
 * The row is created first so its id can name the storage object, which keeps
 * paths collision-free and lets the storage policies key off the user id prefix.
 * If a later step fails the row is marked failed rather than deleted, so the user
 * can see what went wrong instead of the upload silently vanishing.
 */
export const uploadDocument = async ({ file, userId }) => {
  const { data: row, error: insertError } = await supabase
    .from('documents')
    .insert({
      user_id: userId,
      title: file.name.replace(/\.pdf$/i, ''),
      storage_path: 'pending',
      mime_type: ACCEPTED_MIME,
      size_bytes: file.size,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError) return { error: insertError.message }

  const storagePath = `${userId}/${row.id}.pdf`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, { contentType: ACCEPTED_MIME, upsert: false })

  if (uploadError) {
    await supabase
      .from('documents')
      .update({ status: 'failed', status_detail: `Upload failed: ${uploadError.message}` })
      .eq('id', row.id)
    return { error: uploadError.message, documentId: row.id }
  }

  const { error: pathError } = await supabase
    .from('documents')
    .update({ storage_path: storagePath })
    .eq('id', row.id)

  if (pathError) return { error: pathError.message, documentId: row.id }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) return { error: 'Your session expired. Sign in again.', documentId: row.id }

  try {
    const response = await fetch('/api/documents/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ documentId: row.id }),
    })

    if (!response.ok) {
      // The function records its own failure reason on the row, so surface that
      // rather than inventing a second message here.
      const payload = await response.json().catch(() => ({}))
      return { error: payload.error ?? `Extraction failed (${response.status}).`, documentId: row.id }
    }

    return { documentId: row.id, ...(await response.json()) }
  } catch (networkError) {
    const message =
      'Could not reach the extraction API. If you are running `npm run dev`, use `npm run dev:api` instead — plain Vite does not serve /api routes.'
    await supabase
      .from('documents')
      .update({ status: 'failed', status_detail: message })
      .eq('id', row.id)
    return { error: message, documentId: row.id }
  }
}

export const deleteDocument = async ({ id, userId }) => {
  // Remove the object first: if this fails we still have the row pointing at it,
  // rather than an orphaned file nothing references.
  const { error: storageError } = await supabase.storage
    .from('documents')
    .remove([`${userId}/${id}.pdf`])

  if (storageError) return { error: storageError.message }

  const { error } = await supabase.from('documents').delete().eq('id', id)
  return { error: error?.message ?? null }
}
