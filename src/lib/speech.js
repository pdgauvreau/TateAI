/**
 * Thin wrappers over the browser's built-in speech APIs.
 *
 * Both are unevenly supported, so everything here is feature-detected and the UI
 * hides the controls rather than offering a button that silently does nothing.
 */

const SpeechRecognition =
  typeof window !== 'undefined'
    ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
    : undefined

export const recognitionSupported = Boolean(SpeechRecognition)
export const synthesisSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window

const ERROR_MESSAGES = {
  'not-allowed': 'Microphone access was blocked. Allow it in your browser settings to dictate.',
  'service-not-allowed': 'Microphone access was blocked by your browser settings.',
  'audio-capture': 'No microphone was found.',
  network: 'Speech recognition needs a network connection and could not reach it.',
  // Fired when someone taps the mic and says nothing — not worth alarming them.
  'no-speech': null,
  aborted: null,
}

/**
 * Starts dictation. Returns a handle with stop().
 *
 * onResult receives ({ transcript, isFinal }) as speech is recognised, so the UI
 * can show words appearing live and commit them when the phrase settles.
 */
export const startDictation = ({ onResult, onError, onEnd, lang = 'en-US' }) => {
  if (!recognitionSupported) {
    onError?.('Speech recognition is not supported in this browser.')
    return null
  }

  const recognition = new SpeechRecognition()
  recognition.lang = lang
  recognition.interimResults = true
  // One utterance per press. Continuous mode drifts and picks up room noise long
  // after the student has stopped talking.
  recognition.continuous = false

  recognition.onresult = (event) => {
    let interim = ''
    let final = ''
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i]
      if (result.isFinal) final += result[0].transcript
      else interim += result[0].transcript
    }
    if (final) onResult?.({ transcript: final, isFinal: true })
    else if (interim) onResult?.({ transcript: interim, isFinal: false })
  }

  recognition.onerror = (event) => {
    const message = ERROR_MESSAGES[event.error]
    if (message === null) return // benign, stay quiet
    onError?.(message ?? `Speech recognition failed (${event.error}).`)
  }

  recognition.onend = () => onEnd?.()

  try {
    recognition.start()
  } catch {
    // start() throws if called while already running; treat as already listening.
  }

  return {
    stop: () => {
      try {
        recognition.stop()
      } catch {
        /* already stopped */
      }
    },
  }
}

/**
 * Available voices, best-first for this app.
 *
 * getVoices() is empty on first call in most browsers — the list arrives
 * asynchronously — so callers must also listen via onVoicesChanged.
 */
export const listVoices = () => {
  if (!synthesisSupported) return []
  const uiLang = (navigator.language ?? 'en-US').toLowerCase()
  const base = uiLang.split('-')[0]

  return window.speechSynthesis
    .getVoices()
    .slice()
    .sort((a, b) => {
      // Exact locale match first, then same language, then everything else.
      const rank = (v) => {
        const lang = (v.lang ?? '').toLowerCase()
        if (lang === uiLang) return 0
        if (lang.startsWith(base)) return 1
        return 2
      }
      return rank(a) - rank(b) || a.name.localeCompare(b.name)
    })
}

/** Voices populate asynchronously; returns an unsubscribe function. */
export const onVoicesChanged = (callback) => {
  if (!synthesisSupported) return () => {}
  window.speechSynthesis.addEventListener('voiceschanged', callback)
  return () => window.speechSynthesis.removeEventListener('voiceschanged', callback)
}

// Module-level so the streaming callback does not have to thread it through on
// every sentence.
let preferredVoiceURI = null

export const setPreferredVoice = (voiceURI) => {
  preferredVoiceURI = voiceURI || null
}

export const cancelSpeech = () => {
  if (synthesisSupported) window.speechSynthesis.cancel()
}

/**
 * Queues text to be spoken.
 *
 * Replies are spoken a sentence at a time as they stream in (see splitSentences),
 * because waiting for the whole reply leaves a long silence, and speaking each
 * network chunk breaks words mid-syllable.
 */
export const speak = (text) => {
  if (!synthesisSupported || !text.trim()) return

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1.02
  utterance.pitch = 1

  if (preferredVoiceURI) {
    const match = window.speechSynthesis
      .getVoices()
      .find((v) => v.voiceURI === preferredVoiceURI)
    // Fall back to the browser default if a remembered voice is no longer
    // installed, rather than failing silently.
    if (match) utterance.voice = match
  }

  window.speechSynthesis.speak(utterance)
}

/**
 * Pulls complete sentences off the front of a buffer.
 * Returns [sentences, remainder] — the remainder is text that has not yet reached
 * a sentence boundary and should stay buffered until more arrives.
 */
export const splitSentences = (buffer) => {
  const sentences = []
  let remainder = buffer
  // Sentence end followed by whitespace, so "3.5" or "e.g. " mid-sentence are
  // less likely to split awkwardly.
  const pattern = /[^.!?]*[.!?]+(?=\s|$)/

  while (true) {
    const match = pattern.exec(remainder)
    if (!match || !match[0].trim()) break
    sentences.push(match[0].trim())
    remainder = remainder.slice(match[0].length)
  }

  return [sentences, remainder]
}
