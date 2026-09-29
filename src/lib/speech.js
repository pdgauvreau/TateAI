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

// Abbreviations a tutor would expand when talking. Matched case-insensitively
// with the trailing period optional.
const SPOKEN_ABBREVIATIONS = [
  [/\be\.g\.?(?=[\s,]|$)/gi, 'for example'],
  [/\bi\.e\.?(?=[\s,]|$)/gi, 'that is'],
  [/\bvs\.?(?=\s|$)/gi, 'versus'],
  [/\betc\.(?=\s|$)/gi, 'et cetera'],
]

const GREEK = [
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'vartheta',
  'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi',
  'varphi', 'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma',
  'Phi', 'Psi', 'Omega',
]

// LaTeX commands with a spoken form. Anything not listed is read as its bare
// name, which is right for most of the rest (\sin, \log, \max).
const LATEX_WORDS = {
  cdot: ' times ', times: ' times ', div: ' divided by ', pm: ' plus or minus ', mp: ' minus or plus ',
  le: ' is less than or equal to ', leq: ' is less than or equal to ',
  ge: ' is greater than or equal to ', geq: ' is greater than or equal to ',
  ne: ' does not equal ', neq: ' does not equal ', approx: ' is about ', equiv: ' is equivalent to ',
  to: ' to ', rightarrow: ' to ', Rightarrow: ' implies ', implies: ' implies ', iff: ' if and only if ',
  infty: ' infinity ', partial: ' partial ', nabla: ' del ', degree: ' degrees ', circ: ' degrees ',
  in: ' in ', notin: ' not in ', subset: ' subset of ', cup: ' union ', cap: ' intersect ',
  forall: ' for all ', exists: ' there exists ', therefore: ' therefore ', ldots: ' and so on ',
  cdots: ' and so on ', dots: ' and so on ', int: ' the integral of ', sum: ' the sum of ',
  prod: ' the product of ', lim: ' the limit ', ln: ' natural log of ', sin: ' sine ',
  cos: ' cosine ', tan: ' tangent ', sec: ' secant ', csc: ' cosecant ', cot: ' cotangent ',
  perp: ' perpendicular to ', parallel: ' parallel to ', angle: ' angle ', triangle: ' triangle ',
}

const SPOKEN_POWERS = { 2: ' squared', 3: ' cubed' }

/**
 * Turns the inside of a $...$ formula into words. Not a full LaTeX reader:
 * enough that the forms a tutor actually writes come out the way a teacher
 * would say them, and nothing comes out as "backslash".
 */
const latexToWords = (source) => {
  let out = source

  // Formatting wrappers keep their contents.
  out = out.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname|textbf|boxed)\s*\{([^{}]*)\}/g, ' $1 ')
  out = out.replace(/\\(?:left|right|big|Big|bigg|Bigg)\s*/g, '')
  out = out.replace(/\\[,;:! ]|\\q?quad/g, ' ')
  out = out.replace(/\^\s*\{?\s*\\circ\s*\}?/g, ' degrees ')

  // Limits on integrals, sums and products are said as a range, not as a
  // subscript and a power.
  const bound = String.raw`(\{[^{}]*\}|\\?\w+)`
  const unbrace = (value) => value.replace(/^\{|\}$/g, '')
  const ranged = (command, spoken) => {
    out = out.replace(
      new RegExp(String.raw`\\${command}\s*_\s*${bound}\s*\^\s*${bound}`, 'g'),
      (_, from, to) => ` ${spoken} from ${unbrace(from)} to ${unbrace(to)} of `
    )
  }
  ranged('int', 'the integral')
  ranged('sum', 'the sum')
  ranged('prod', 'the product')
  out = out.replace(
    new RegExp(String.raw`\\lim\s*_\s*${bound}`, 'g'),
    (_, under) => ` the limit as ${unbrace(under).replace(/\\to|\\rightarrow|->/, ' approaches ')} of `
  )

  // Innermost first, repeated, so \frac{\sqrt{x}}{2} unwraps from the inside.
  for (let pass = 0; pass < 6; pass += 1) {
    const before = out
    out = out.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, ' $1 over $2 ')
    out = out.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, ' the $1th root of $2 ')
    out = out.replace(/\\sqrt\s*\{([^{}]*)\}/g, ' the square root of $1 ')
    out = out.replace(/\^\s*\{([^{}]*)\}/g, (_, power) => SPOKEN_POWERS[power.trim()] ?? ` to the power of ${power} `)
    out = out.replace(/_\s*\{([^{}]*)\}/g, ' sub $1 ')
    if (out === before) break
  }
  out = out.replace(/\\sqrt\s*(\w)/g, ' the square root of $1 ')
  out = out.replace(/\^\s*(\w)/g, (_, power) => SPOKEN_POWERS[power] ?? ` to the power of ${power} `)
  out = out.replace(/_\s*(\w)/g, ' sub $1 ')

  out = out.replace(/\\([A-Za-z]+)/g, (_, name) => {
    if (LATEX_WORDS[name]) return LATEX_WORDS[name]
    if (GREEK.includes(name)) return ` ${name.replace(/^var/, '').toLowerCase()} `
    return ` ${name} `
  })

  // Operators inside math are always operators, unlike in prose.
  out = out.replace(/\s*\+\s*/g, ' plus ')
  out = out.replace(/(\S)\s*[-−]\s*/g, '$1 minus ')
  out = out.replace(/^\s*[-−]\s*/g, 'negative ')
  out = out.replace(/\s*=\s*/g, ' equals ')
  out = out.replace(/\s*<\s*/g, ' is less than ')
  out = out.replace(/\s*>\s*/g, ' is greater than ')
  out = out.replace(/\s*\*\s*/g, ' times ')
  out = out.replace(/\s*\/\s*/g, ' over ')
  out = out.replace(/!/g, ' factorial ')
  out = out.replace(/[{}]/g, ' ')

  return ` ${out.replace(/\s+/g, ' ').trim()} `
}

/**
 * Rewrites a reply into what a person would actually say aloud.
 *
 * Voices read punctuation literally ("backtick", "open parenthesis") or trip
 * over formatting marks, so this strips markdown, turns asides into pauses, and
 * says symbols as words. Only the spoken copy changes; the text on screen keeps
 * its formatting.
 */
export const toSpeakable = (text) => {
  // An escaped \$ is money, not math: park it so the math patterns skip it.
  let out = text.replace(/\\\$/g, '\u0000')

  // Math first, before the prose rules below can mistake ^ or _ for markdown.
  out = out.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => latexToWords(math))
  out = out.replace(/\$([^$\n]+?)\$/g, (_, math) => latexToWords(math))
  out = out.replace(/\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)/g, (_, display, inline) =>
    latexToWords(display ?? inline)
  )
  out = out.replace(/\u0000/g, '$')

  // Markdown structure: code fences, links, headings, list markers, quotes.
  out = out.replace(/```[\w-]*/g, ' ')
  out = out.replace(/!?\[([^\]]+)\]\((?:[^)]+)\)/g, '$1')
  out = out.replace(/https?:\/\/\S+/g, 'the link')
  out = out.replace(/^\s{0,3}#{1,6}\s+/gm, '')
  out = out.replace(/^\s*[-*+•]\s+/gm, '')
  out = out.replace(/^\s*>\s?/gm, '')

  // Emphasis and inline code marks carry no words.
  out = out.replace(/(\*\*|__|~~)(.+?)\1/g, '$2')
  out = out.replace(/(^|[^\w*])[*_]([^*_\n]+)[*_](?=[^\w*]|$)/g, '$1$2')
  out = out.replace(/`/g, '')

  for (const [pattern, spoken] of SPOKEN_ABBREVIATIONS) {
    out = out.replace(pattern, spoken)
  }

  // Symbols that mean a word. Arithmetic ones only between numbers or single
  // letters, so hyphenated words and slashes in prose are left alone.
  out = out.replace(/([\w)])\s*(?:!=|≠)\s*/g, '$1 does not equal ')
  out = out.replace(/([\w)])\s*(?:<=|≤)\s*/g, '$1 is less than or equal to ')
  out = out.replace(/([\w)])\s*(?:>=|≥)\s*/g, '$1 is greater than or equal to ')
  out = out.replace(/\s*(?:->|→|=>)\s*/g, ' to ')
  out = out.replace(/\s*(?:<-|←)\s*/g, ' from ')
  out = out.replace(/(\w)\s*[≈]\s*/g, '$1 is about ')
  out = out.replace(/(\w)\s+<\s+/g, '$1 is less than ')
  out = out.replace(/(\w)\s+>\s+/g, '$1 is greater than ')
  out = out.replace(/\s*=\s*/g, ' equals ')
  out = out.replace(/(\d|\b[a-z])\s*[×*]\s*(?=\d|[a-z]\b)/gi, '$1 times ')
  out = out.replace(/(\d|\b[a-z])\s*÷\s*/gi, '$1 divided by ')
  out = out.replace(/(\d|\b[a-z])\s+[-−]\s+(?=\d|[a-z]\b)/gi, '$1 minus ')
  out = out.replace(/(\d)\s*\/\s*(?=\d)/g, '$1 over ')
  out = out.replace(/(\w)\^(\w+)/g, '$1 to the power of $2')
  out = out.replace(/([a-z])\/([a-z])/gi, '$1 or $2')
  out = out.replace(/\s*&\s*/g, ' and ')
  out = out.replace(/~\s*(?=\d)/g, 'about ')
  out = out.replace(/±/g, ' plus or minus ')
  out = out.replace(/°/g, ' degrees')

  // Brackets become the short pauses a speaker leaves around an aside. Empty
  // ones, as in "map()", are dropped rather than read as a pause.
  out = out.replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, '')
  out = out.replace(/\s*[([{]\s*/g, ', ')
  out = out.replace(/\s*[)\]}]\s*/g, ', ')

  // Anything decorative left over: stray markdown, emoji, pipes from tables.
  out = out.replace(/[*_#|<>\\]/g, ' ')
  out = out.replace(/\p{Extended_Pictographic}/gu, '')

  // Tidy up the commas the rewrites leave behind.
  out = out.replace(/\s+/g, ' ')
  out = out.replace(/\s+([,.!?;:])/g, '$1')
  out = out.replace(/,(?:\s*,)+/g, ',')
  out = out.replace(/,\s*([.!?;:])/g, '$1')
  out = out.replace(/([.!?;:])\s*,/g, '$1')
  out = out.replace(/^[\s,]+|[\s,]+$/g, '')

  return out
}

/**
 * Queues text to be spoken.
 *
 * Replies are spoken a sentence at a time as they stream in (see splitSentences),
 * because waiting for the whole reply leaves a long silence, and speaking each
 * network chunk breaks words mid-syllable.
 */
export const speak = (text) => {
  if (!synthesisSupported) return
  const spoken = toSpeakable(text)
  if (!spoken) return

  const utterance = new SpeechSynthesisUtterance(spoken)
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
