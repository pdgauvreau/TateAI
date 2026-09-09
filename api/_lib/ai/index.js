/**
 * Provider-neutral chat interface.
 *
 * This file must stay free of any vendor SDK calls — that is the whole point of
 * it. Each provider lives in its own adapter module and exposes one function:
 *
 *   streamChat({ system, messages, signal, onDelta }) -> Promise<{ text }>
 *
 *   system   string
 *   messages [{ role: 'user' | 'assistant', content: string }]
 *   onDelta  (chunk: string) => void, called as text arrives
 *   returns  the full assembled text, for persisting once the stream ends
 *
 * To add a provider: write an adapter with that signature, register it below,
 * and set AI_PROVIDER to its key. Nothing else in the codebase needs to change.
 */

const ADAPTERS = {
  anthropic: () => import('./anthropic.js'),
  // openai: () => import('./openai.js'),  // not written yet — see README
}

export const activeProvider = () => process.env.AI_PROVIDER ?? 'anthropic'

export class ProviderNotConfiguredError extends Error {}

export const streamChat = async (options) => {
  const name = activeProvider()
  const load = ADAPTERS[name]

  if (!load) {
    throw new ProviderNotConfiguredError(
      `AI_PROVIDER is set to "${name}", which has no adapter. Available: ${Object.keys(ADAPTERS).join(', ')}.`
    )
  }

  const adapter = await load()
  return adapter.streamChat(options)
}
