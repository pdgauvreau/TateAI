import Anthropic from '@anthropic-ai/sdk'
import { ProviderNotConfiguredError } from './index.js'

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5'

// Tutoring is a chat workload, so medium effort is the sensible default: it keeps
// replies responsive and cheap without the flatness of low. Override per
// deployment if answers feel shallow.
const EFFORT = process.env.ANTHROPIC_EFFORT ?? 'medium'

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

  const final = await stream.finalMessage()

  // Opus 5 can decline a request outright; that arrives as HTTP 200, so it has to
  // be checked explicitly rather than caught.
  if (final.stop_reason === 'refusal') {
    const category = final.stop_details?.category ?? 'unspecified'
    throw new Error(`The model declined to answer this request (${category}).`)
  }

  const text = final.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')

  return { text, model: final.model, usage: final.usage }
}
