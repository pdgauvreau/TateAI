import { supabase } from './supabase'

export const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

// What each accepted file becomes in storage. Matched by extension as well as
// type, because some browsers report an empty type for files dragged from
// certain apps.
const KINDS = [
  { ext: ['pdf'], mime: ['application/pdf'], store: 'application/pdf', suffix: 'pdf' },
  { ext: ['docx'], mime: [DOCX_MIME], store: DOCX_MIME, suffix: 'docx' },
  { ext: ['pptx'], mime: [PPTX_MIME], store: PPTX_MIME, suffix: 'pptx' },
  {
    ext: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'],
    mime: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'],
    // Every photo is re-encoded as JPEG in the browser before upload.
    store: 'image/jpeg',
    suffix: 'jpg',
    image: true,
  },
]

/** The value for a file input's accept attribute. */
export const ACCEPT = [
  ...KINDS.flatMap((kind) => kind.mime),
  ...KINDS.flatMap((kind) => kind.ext.map((ext) => `.${ext}`)),
].join(',')

const extensionOf = (name) => name.toLowerCase().split('.').pop()

const kindOf = (file) =>
  KINDS.find((kind) => kind.mime.includes(file.type)) ??
  KINDS.find((kind) => kind.ext.includes(extensionOf(file.name)))

export const isPhoto = (file) => Boolean(kindOf(file)?.image)

export const formatBytes = (bytes) => {
  if (!bytes) return '—'
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

const UNSUPPORTED = 'Upload a PDF, a photo, or a Word or PowerPoint file.'

export const validateFile = (file) => {
  if (!kindOf(file)) return UNSUPPORTED
  if (file.size > MAX_FILE_BYTES) return `That file is ${formatBytes(file.size)}. The limit is 25 MB.`
  if (file.size === 0) return 'That file is empty.'
  return null
}

// Long edge in pixels. The model reads a page at about this size anyway, and it
// turns a 4-12 MB phone photo into a few hundred KB.
const PHOTO_MAX_EDGE = 2000

/**
 * Shrinks a photo and re-encodes it as JPEG, the right way up.
 *
 * createImageBitmap applies the camera's orientation, so a photo taken sideways
 * arrives upright. Browsers that can decode HEIC (Safari) convert it here too;
 * elsewhere HEIC fails to decode and the student is asked for a JPEG.
 */
const preparePhoto = async (file) => {
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('This browser could not open that photo. Save it as a JPEG or PNG and try again.')
  }

  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  // A white ground, so a transparent PNG screenshot does not turn black as JPEG.
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error('Could not prepare that photo for upload.')
  return blob
}

export const listDocuments = async () =>
  supabase
    .from('documents')
    .select('id, title, status, status_detail, size_bytes, mime_type, course_id, created_at')
    .order('created_at', { ascending: false })

/**
 * Creates the row, uploads the file, then asks the API to extract its text.
 *
 * The row is created first so its id can name the storage object, which keeps
 * paths collision-free and lets the storage policies key off the user id prefix.
 * If a later step fails the row is marked failed rather than deleted, so the user
 * can see what went wrong instead of the upload silently vanishing.
 *
 * With a conversationId, the document is also attached to that conversation
 * once its text is ready, so the tutor sees it from the next message on. With a
 * courseId, it is filed under that course.
 */
export const uploadDocument = async ({ file, userId, conversationId, courseId }) => {
  const kind = kindOf(file)
  if (!kind) return { error: UNSUPPORTED }

  let body = file
  if (kind.image) {
    try {
      body = await preparePhoto(file)
    } catch (photoError) {
      return { error: photoError.message }
    }
  }

  const title = file.name.replace(/\.[^.]+$/, '') || 'Untitled'

  const { data: row, error: insertError } = await supabase
    .from('documents')
    .insert({
      user_id: userId,
      title,
      // storage_path is unique, so a placeholder has to be too: two uploads in
      // flight at once would otherwise collide.
      storage_path: `pending-${crypto.randomUUID()}`,
      mime_type: kind.store,
      size_bytes: body.size,
      status: 'pending',
      course_id: courseId ?? null,
    })
    .select('id')
    .single()

  if (insertError) return { error: insertError.message }

  const storagePath = `${userId}/${row.id}.${kind.suffix}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, body, { contentType: kind.store, upsert: false })

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

  let result
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

    result = await response.json()
  } catch {
    const message =
      'Could not reach the extraction API. If you are running `npm run dev`, use `npm run dev:api` instead — plain Vite does not serve /api routes.'
    await supabase
      .from('documents')
      .update({ status: 'failed', status_detail: message })
      .eq('id', row.id)
    return { error: message, documentId: row.id }
  }

  if (conversationId) {
    const { error: linkError } = await supabase
      .from('conversation_documents')
      .insert({ conversation_id: conversationId, document_id: row.id })
    if (linkError) return { error: linkError.message, documentId: row.id, title }
  }

  return { documentId: row.id, title, ...result }
}

export const deleteDocument = async ({ id }) => {
  // The stored path rather than a rebuilt one: the extension depends on the
  // file's type.
  const { data: row, error: fetchError } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (fetchError) return { error: fetchError.message }

  // Remove the object first: if this fails we still have the row pointing at it,
  // rather than an orphaned file nothing references. A row whose upload never
  // finished has only a placeholder path and no object to remove.
  if (row.storage_path.includes('/')) {
    const { error: storageError } = await supabase.storage.from('documents').remove([row.storage_path])
    if (storageError) return { error: storageError.message }
  }

  const { error } = await supabase.from('documents').delete().eq('id', id)
  return { error: error?.message ?? null }
}
