/**
 * Text extraction for Word and PowerPoint files.
 *
 * Both formats are zip archives of XML, so they are read directly here rather
 * than sent to a model: it is instant, exact, and costs the student nothing.
 */

import JSZip from 'jszip'
import mammoth from 'mammoth'

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

export const extractDocx = async (bytes) => {
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
  return value
}

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

const decodeXml = (text) =>
  text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return XML_ENTITIES[entity] ?? match
  })

// One line per paragraph (<a:p>), joining its text runs (<a:t>).
const paragraphsOf = (xml) =>
  (xml.match(/<a:p[\s>][\s\S]*?<\/a:p>/g) ?? [])
    .map((paragraph) =>
      (paragraph.match(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g) ?? [])
        .map((run) => decodeXml(run.replace(/<[^>]+>/g, '')))
        .join('')
        .trim()
    )
    .filter(Boolean)

const slideNumber = (path) => Number(path.match(/(\d+)\.xml$/)?.[1] ?? 0)

/**
 * Slides in order, each headed with its number, followed by its speaker notes:
 * on lecture decks the notes often carry the explanation the slide only hints at.
 */
export const extractPptx = async (bytes) => {
  const zip = await JSZip.loadAsync(bytes)

  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => slideNumber(a) - slideNumber(b))

  const sections = []
  for (const path of slidePaths) {
    const n = slideNumber(path)
    const body = paragraphsOf(await zip.file(path).async('string'))

    const notesFile = zip.file(`ppt/notesSlides/notesSlide${n}.xml`)
    // Notes pages repeat the slide number as a text run; drop bare numbers.
    const notes = notesFile
      ? paragraphsOf(await notesFile.async('string')).filter((line) => !/^\d+$/.test(line))
      : []

    if (!body.length && !notes.length) continue
    sections.push(
      [`## Slide ${n}`, ...body, ...(notes.length ? ['', `Speaker notes: ${notes.join(' ')}`] : [])].join('\n')
    )
  }

  return sections.join('\n\n')
}
