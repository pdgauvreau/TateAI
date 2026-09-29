import Anthropic from '@anthropic-ai/sdk'
import { ProviderNotConfiguredError } from './index.js'

// Two tiers. Standard replies run on Sonnet: tutoring is a chat workload, and at
// medium effort it is responsive and about 2.5x cheaper per token than Opus, so
// the allowance goes further. "Deeper thinking" is the student's opt-in for a
// harder topic: Opus at high effort, which reasons more before answering and
// draws down the allowance correspondingly faster. Each is overridable per
// deployment.
const TIERS = {
  standard: {
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5',
    effort: process.env.ANTHROPIC_EFFORT ?? 'medium',
  },
  deep: {
    model: process.env.ANTHROPIC_DEEP_MODEL ?? 'claude-opus-5',
    effort: process.env.ANTHROPIC_DEEP_EFFORT ?? 'high',
  },
}

// US dollars per million tokens, which is the same number as micro-dollars per
// token. Cache writes are the 5-minute TTL rate (1.25x input), the only TTL used
// here. Output includes thinking tokens, which bill as output.
const RATES = {
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
}

// An unrecognised model is costed at the most expensive rate listed, so a model
// swap without a pricing update over-counts usage rather than giving it away.
const FALLBACK_RATE = RATES['claude-opus-5']

const rateFor = (model) =>
  Object.entries(RATES).find(([id]) => model?.startsWith(id))?.[1] ?? FALLBACK_RATE

/** Converts the provider's usage report into the provider-neutral shape. */
const meter = (model, usage) => {
  const tokens = {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
  }
  const rate = rateFor(model)
  const costMicros = Math.ceil(
    tokens.inputTokens * rate.input +
      tokens.outputTokens * rate.output +
      tokens.cacheReadTokens * rate.cacheRead +
      tokens.cacheWriteTokens * rate.cacheWrite
  )
  return { model, ...tokens, costMicros }
}

export const streamChat = async ({ system, messages, signal, onDelta, deep = false }) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ProviderNotConfiguredError(
      'ANTHROPIC_API_KEY is not set. Add it in your Vercel project settings (without a VITE_ prefix).'
    )
  }

  const { model, effort } = deep ? TIERS.deep : TIERS.standard
  const client = new Anthropic()

  const stream = client.messages.stream(
    {
      model,
      max_tokens: 4096,
      // The system prompt carries the course materials and is identical across
      // every turn of a conversation, so caching it turns a large repeated input
      // into a cheap cache read after the first message.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      output_config: { effort },
      messages,
    },
    { signal }
  )

  stream.on('text', (chunk) => onDelta?.(chunk))

  let final
  try {
    final = await stream.finalMessage()
  } catch (error) {
    // A reply that fails or is cancelled partway was still billed for what it
    // used. The stream's snapshot holds the usage reported so far, so the caller
    // can meter it rather than letting an interrupted turn go free.
    error.usage = meter(model, stream.currentMessage?.usage)
    throw error
  }

  const usage = meter(final.model, final.usage)

  // The model can decline a request outright; that arrives as HTTP 200, so it has to
  // be checked explicitly rather than caught.
  if (final.stop_reason === 'refusal') {
    const category = final.stop_details?.category ?? 'unspecified'
    const refusal = new Error(`The model declined to answer this request (${category}).`)
    refusal.usage = usage
    throw refusal
  }

  const text = final.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')

  return { text, usage }
}

/**
 * One-shot generation from course materials: flashcards, a quiz, a study guide,
 * or the due dates in a syllabus. With a JSON schema the reply is constrained to
 * it and returned parsed as `data`; without one it is returned as `text`.
 *
 * The materials go in the system prompt with a cache breakpoint, so making a
 * quiz and then flashcards from the same documents reads them from cache the
 * second time.
 */
export const generate = async ({ system, materials, prompt, schema, maxTokens = 16000, signal }) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ProviderNotConfiguredError(
      'ANTHROPIC_API_KEY is not set. Add it in your Vercel project settings (without a VITE_ prefix).'
    )
  }

  const { model } = TIERS.standard
  const client = new Anthropic()

  const stream = client.messages.stream(
    {
      model,
      max_tokens: maxTokens,
      system: [
        { type: 'text', text: system },
        { type: 'text', text: materials, cache_control: { type: 'ephemeral' } },
      ],
      output_config: {
        effort: 'medium',
        ...(schema ? { format: { type: 'json_schema', schema } } : {}),
      },
      messages: [{ role: 'user', content: prompt }],
    },
    { signal }
  )

  let final
  try {
    final = await stream.finalMessage()
  } catch (error) {
    error.usage = meter(model, stream.currentMessage?.usage)
    throw error
  }

  const usage = meter(final.model, final.usage)

  if (final.stop_reason === 'refusal') {
    const refusal = new Error('The model declined to generate this.')
    refusal.usage = usage
    throw refusal
  }
  if (final.stop_reason === 'max_tokens') {
    const cut = new Error('The result was too long to finish. Try fewer documents at a time.')
    cut.usage = usage
    throw cut
  }

  const text = final.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')

  if (!schema) return { text, usage }

  try {
    return { data: JSON.parse(text), usage }
  } catch {
    const malformed = new Error('The model returned something that could not be read. Try again.')
    malformed.usage = usage
    throw malformed
  }
}

const TRANSCRIBE_PROMPT =`Transcribe this file into text a tutor can work from. It is a student's homework, notes, or course material: often a phone photo of a worksheet, a textbook page, or handwritten work.

- Reproduce every word, number, and problem, in reading order. Keep problem numbers and labels exactly as written.
- Write all math in LaTeX: $...$ inline, $$...$$ for displayed equations. Write a dollar amount as \\$5.
- Keep the student's own handwritten working, marked [Student's work: ...], separate from the printed problem.
- Describe diagrams, graphs, and figures in a bracketed note with every label and value shown, e.g. [Figure: right triangle, legs 3 and 4, hypotenuse labeled c]. Render tables as Markdown tables.
- Mark anything you cannot read as [illegible] rather than guessing.

Output only the transcription, with no preamble or commentary.`

/**
 * Reads a photo or a scanned PDF into text, once, at upload time.
 *
 * The result is stored as the document's text, so every later reply works from
 * cheap cached text rather than paying for the image again on each turn. Runs on
 * the standard tier: reading a page is not the kind of hard reasoning the deep
 * tier is for.
 */
export const transcribe = async ({ mediaType, data, signal }) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ProviderNotConfiguredError(
      'ANTHROPIC_API_KEY is not set. Add it in your Vercel project settings (without a VITE_ prefix).'
    )
  }

  const { model } = TIERS.standard
  const client = new Anthropic()

  const source =
    mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: mediaType, data } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data } }

  // Streamed only so a long scanned document cannot hit an HTTP timeout; nothing
  // is shown until it finishes.
  const stream = client.messages.stream(
    {
      model,
      max_tokens: 32000,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: [source, { type: 'text', text: TRANSCRIBE_PROMPT }] }],
    },
    { signal }
  )

  let final
  try {
    final = await stream.finalMessage()
  } catch (error) {
    error.usage = meter(model, stream.currentMessage?.usage)
    throw error
  }

  const usage = meter(final.model, final.usage)

  if (final.stop_reason === 'refusal') {
    const refusal = new Error('This file could not be read.')
    refusal.usage = usage
    throw refusal
  }

  const text = final.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()

  return { text, usage, truncated: final.stop_reason === 'max_tokens' }
}
