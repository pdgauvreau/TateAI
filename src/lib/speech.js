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
