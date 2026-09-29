import { createClient } from '@supabase/supabase-js'
import { extractText, getDocumentProxy } from 'unpdf'
import { ProviderNotConfiguredError, transcribe } from '../_lib/ai/index.js'
import { checkUsage, limitMessage, recordUsage } from '../_lib/limits.js'
import { DOCX_MIME, PPTX_MIME, extractDocx, extractPptx } from '../_lib/office.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

// Guards against a single enormous document exhausting the function's memory.
const MAX_CHARS = 400_000

// Types the model can read directly. The browser converts phone photos (HEIC
// included) to JPEG and shrinks them before upload, so in practice images
// arrive as JPEG.
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

// A scanned PDF is read page by page by the model. Past this many pages the
// read would outrun the function's time limit, so longer scans are refused with
// a way forward rather than failing partway.
const MAX_SCANNED_PAGES = 20

// The model API caps a request at 32 MB, and base64 inflates a file by a third.
const MAX_TRANSCRIBE_BYTES = 20 * 1024 * 1024

class ExtractionRefused extends Error {
  constructor(message, status = 422) {
    super(message)
    this.status = status
  }
}

/**
 * Reads a photo or scanned PDF through the model. Checked against the
 * student's allowance first, and metered afterwards, like a reply.
 */
const readWithModel = async ({ supabase, userId, bytes, mediaType, signal }) => {
  if (bytes.byteLength > MAX_TRANSCRIBE_BYTES) {
    throw new ExtractionRefused('This file is too large to read. Try a smaller scan or a photo of each page.')
  }

  const usage = await checkUsage(supabase, userId)
  if (!usage.allowed) throw new ExtractionRefused(limitMessage(usage), 429)

  try {
    const result = await transcribe({
      mediaType,
      data: Buffer.from(bytes).toString('base64'),
      signal,
    })
    await recordUsage(supabase, userId, result.usage, 'transcription')
    return result
  } catch (error) {
    if (error?.usage) await recordUsage(supabase, userId, error.usage, 'transcription')
    throw error
  }
}

/** Returns { text, pages?, note? } for any supported type. */
const extract = async ({ supabase, userId, bytes, mimeType, signal }) => {
  // Rows from before other types were accepted have no recorded type; they are
  // all PDFs.
  const type = mimeType ?? 'application/pdf'

  if (type === 'application/pdf') {
    // A copy: pdf.js may take ownership of the buffer it is given, and the
    // original is still needed if the pages turn out to be scans.
    const pdf = await getDocumentProxy(new Uint8Array(bytes.slice(0)))
    const { text, totalPages } = await extractText(pdf, { mergePages: true })
    const cleaned = (text ?? '').replace(/\s+\n/g, '\n').trim()
    if (cleaned) return { text: cleaned, pages: totalPages }

    // No selectable text: a scanned or photographed document. Read the pages.
    if (totalPages > MAX_SCANNED_PAGES) {
      throw new ExtractionRefused(
        `This is a scanned PDF of ${totalPages} pages. Scans are read up to ${MAX_SCANNED_PAGES} pages at a time, so split it into smaller files, or upload only the pages you need.`
      )
    }
    const result = await readWithModel({ supabase, userId, bytes, mediaType: type, signal })
    return {
      text: result.text,
      pages: totalPages,
      note: result.truncated ? 'Only part of this scan could be read. Try uploading fewer pages.' : 'Read from scanned pages.',
    }
  }

  if (IMAGE_TYPES.has(type)) {
    const result = await readWithModel({ supabase, userId, bytes, mediaType: type, signal })
    return { text: result.text, note: result.truncated ? 'Only part of this photo could be read.' : null }
  }

  if (type === DOCX_MIME) return { text: (await extractDocx(bytes)).trim() }
  if (type === PPTX_MIME) return { text: (await extractPptx(bytes)).trim() }

  throw new ExtractionRefused('This file type is not supported. Upload a PDF, a photo, or a Word or PowerPoint file.')
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

  const { documentId } = req.body ?? {}
  if (!documentId) {
    return res.status(400).json({ error: 'documentId is required.' })
  }

  // Deliberately the anon key plus the caller's own token rather than the service
  // role key: every query below runs as that user and stays subject to RLS, so a
  // forged documentId cannot reach another user's file even if this code is wrong.
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

  const { data: document, error: fetchError } = await supabase
    .from('documents')
    .select('id, storage_path, status, mime_type')
    .eq('id', documentId)
    .single()

  if (fetchError || !document) {
    return res.status(404).json({ error: 'Document not found.' })
  }

  await supabase.from('documents').update({ status: 'processing' }).eq('id', documentId)

  try {
    const { data: file, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.storage_path)

    if (downloadError) throw new Error(`Could not read the uploaded file: ${downloadError.message}`)

    const { text, pages, note } = await extract({
      supabase,
      userId: user.id,
      bytes: await file.arrayBuffer(),
      mimeType: document.mime_type,
      signal: req.signal,
    })

    if (!text) {
      throw new ExtractionRefused('No text could be found in this file.')
    }

    const truncated = text.length > MAX_CHARS
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        status: 'ready',
        status_detail: truncated ? `Truncated to the first ${MAX_CHARS} characters.` : (note ?? null),
        extracted_text: truncated ? text.slice(0, MAX_CHARS) : text,
      })
      .eq('id', documentId)

    if (updateError) throw new Error(updateError.message)

    return res.status(200).json({
      status: 'ready',
      pages: pages ?? null,
      characters: truncated ? MAX_CHARS : text.length,
      truncated,
    })
  } catch (error) {
    const message =
      error instanceof ExtractionRefused || error instanceof ProviderNotConfiguredError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown extraction error.'

    await supabase
      .from('documents')
      .update({ status: 'failed', status_detail: message.slice(0, 500) })
      .eq('id', documentId)

    return res.status(error instanceof ExtractionRefused ? error.status : 500).json({ error: message })
  }
}
