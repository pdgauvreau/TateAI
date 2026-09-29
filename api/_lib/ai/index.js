/**
 * Provider-neutral chat interface.
 *
 * This file must stay free of any vendor SDK calls — that is the whole point of
 * it. Each provider lives in its own adapter module and exposes one function:
 *
 *   streamChat({ system, messages, signal, onDelta, deep }) -> Promise<{ text, usage }>
 *
 *   deep     boolean, the student's "Deeper thinking" choice: a more capable,
 *            more expensive model for this reply
 *   system   string
 *   messages [{ role: 'user' | 'assistant', content: string }]
 *   onDelta  (chunk: string) => void, called as text arrives
 *   returns  the full assembled text, for persisting once the stream ends, and
 *            usage: { model, inputTokens, outputTokens, cacheReadTokens,
 *            cacheWriteTokens, costMicros } for metering (costMicros is US
 *            dollars x 1e6). An error thrown after the provider started billing
 *            carries the usage so far as error.usage.
 *
 *   transcribe({ mediaType, data, signal }) -> Promise<{ text, usage, truncated }>
 *
 *   Reads a photo or a scanned PDF into text. mediaType is an image type or
 *   application/pdf, data is base64. usage has the same shape as above.
 *
 *   generate({ system, materials, prompt, schema?, maxTokens?, signal })
 *     -> Promise<{ data, usage }> with a JSON schema, { text, usage } without
 *
 *   One-shot generation over course materials. `materials` is the long, stable
 *   part of the prompt and should be cached by the adapter.
 *
 * To add a provider: write an adapter with those signatures, register it below,
 * and set AI_PROVIDER to its key. Nothing else in the codebase needs to change.
 */

const ADAPTERS = {
  anthropic: () => import('./anthropic.js'),
  // openai: () => import('./openai.js'),  // not written yet — see README
}

export const activeProvider = () => process.env.AI_PROVIDER ?? 'anthropic'

export class ProviderNotConfiguredError extends Error {}

const loadAdapter = async () => {
  const name = activeProvider()
  const load = ADAPTERS[name]

  if (!load) {
    throw new ProviderNotConfiguredError(
      `AI_PROVIDER is set to "${name}", which has no adapter. Available: ${Object.keys(ADAPTERS).join(', ')}.`
    )
  }

  return load()
}

export const streamChat = async (options) => (await loadAdapter()).streamChat(options)

export const transcribe = async (options) => (await loadAdapter()).transcribe(options)

export const generate = async (options) => (await loadAdapter()).generate(options)
