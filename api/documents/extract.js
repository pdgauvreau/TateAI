import { createClient } from '@supabase/supabase-js'
import { extractText, getDocumentProxy } from 'unpdf'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

// Guards against a single enormous document exhausting the function's memory.
const MAX_CHARS = 400_000

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
    .select('id, storage_path, status')
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

    const buffer = new Uint8Array(await file.arrayBuffer())
    const pdf = await getDocumentProxy(buffer)
    const { text, totalPages } = await extractText(pdf, { mergePages: true })

    const cleaned = (text ?? '').replace(/\s+\n/g, '\n').trim()

    if (!cleaned) {
      // Almost always a scanned or image-only PDF. It uploaded fine, so say what
      // is actually wrong rather than reporting a generic failure.
      await supabase
        .from('documents')
        .update({
          status: 'failed',
          status_detail:
            'No selectable text found. This looks like a scanned document — TATE AI cannot read it yet.',
        })
        .eq('id', documentId)

      return res.status(422).json({
        error: 'No selectable text found in this PDF.',
        pages: totalPages,
      })
    }

    const truncated = cleaned.length > MAX_CHARS
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        status: 'ready',
        status_detail: truncated ? `Truncated to the first ${MAX_CHARS} characters.` : null,
        extracted_text: truncated ? cleaned.slice(0, MAX_CHARS) : cleaned,
      })
      .eq('id', documentId)

    if (updateError) throw new Error(updateError.message)

    return res.status(200).json({
      status: 'ready',
      pages: totalPages,
      characters: truncated ? MAX_CHARS : cleaned.length,
      truncated,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown extraction error.'
    await supabase
      .from('documents')
      .update({ status: 'failed', status_detail: message.slice(0, 500) })
      .eq('id', documentId)

    return res.status(500).json({ error: message })
  }
}
