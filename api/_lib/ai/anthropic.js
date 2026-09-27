import Anthropic from '@anthropic-ai/sdk'
import { ProviderNotConfiguredError } from './index.js'

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5'

// Tutoring is a chat workload, so medium effort is the sensible default: it keeps
// replies responsive and cheap without the flatness of low. Override per
// deployment if answers feel shallow.
const EFFORT = process.env.ANTHROPIC_EFFORT ?? 'medium'

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

export const streamChat = async ({ system, messages, signal, onDelta }) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ProviderNotConfiguredError(
      'ANTHROPIC_API_KEY is not set. Add it in your Vercel project settings (without a VITE_ prefix).'
    )
  }

  const client = new Anthropic()

  const stream = client.messages.stream(
    {
      model: MODEL,
      max_tokens: 4096,
      // The system prompt carries the course materials and is identical across
      // every turn of a conversation, so caching it turns a large repeated input
      // into a cheap cache read after the first message.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      output_config: { effort: EFFORT },
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
    error.usage = meter(MODEL, stream.currentMessage?.usage)
    throw error
  }

  const usage = meter(final.model, final.usage)

  // Opus 5 can decline a request outright; that arrives as HTTP 200, so it has to
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
