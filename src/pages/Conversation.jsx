import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import DotBackground from '../components/DotBackground'
import { ThinkingDots, Waveform } from '../components/motion/Interactive'
import { ease, spring } from '../motion/tokens'
import {
  getConversation,
  listConversationDocuments,
  listMessages,
  sendMessage,
} from '../lib/conversations'
import {
  cancelSpeech,
  listVoices,
  onVoicesChanged,
  recognitionSupported,
  setPreferredVoice,
  speak,
  splitSentences,
  synthesisSupported,
  startDictation,
} from '../lib/speech'
import './Conversation.css'

const SPEAK_PREF_KEY = 'tateai:speak-replies'
const VOICE_PREF_KEY = 'tateai:voice-uri'

/**
 * The conversation view.
 *
 * All of the behaviour here is unchanged from before the redesign — streaming,
 * dictation, sentence-at-a-time speech, the rate-limit recovery that puts the
 * message back in the box. What is new is that each of those states now has a
 * visible form: turns spring in from their own side, the streaming reply carries
 * a caret, the mic shows a live level while it is listening, and the composer
 * lifts when it has focus.
 */
const Conversation = () => {
  const { id } = useParams()

  const [conversation, setConversation] = useState(null)
  const [documents, setDocuments] = useState([])
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [composerFocus, setComposerFocus] = useState(false)

  const [listening, setListening] = useState(false)
  const [speakReplies, setSpeakReplies] = useState(() => {
    // Reading storage can throw in private windows, so never let it break the page.
    try {
      return localStorage.getItem(SPEAK_PREF_KEY) === '1'
    } catch {
      return false
    }
  })

  const [voices, setVoices] = useState([])
  const [voiceURI, setVoiceURI] = useState(() => {
    try {
      return localStorage.getItem(VOICE_PREF_KEY) ?? ''
    } catch {
      return ''
    }
  })

  const abortRef = useRef(null)
  const bottomRef = useRef(null)
  const dictationRef = useRef(null)
  // Text spoken so far, plus the tail that hasn't reached a sentence boundary.
  const spokenBufferRef = useRef('')
  // Read inside the streaming callback, which closes over the value at send time.
  const speakRef = useRef(speakReplies)
  speakRef.current = speakReplies

  useEffect(() => {
    let active = true

    Promise.all([getConversation(id), listMessages(id), listConversationDocuments(id)]).then(
      ([conv, msgs, docs]) => {
        if (!active) return
        if (conv.error) setError(conv.error.message)
        else setConversation(conv.data)
        setMessages(msgs.data ?? [])
        setDocuments((docs.data ?? []).map((row) => row.documents?.title).filter(Boolean))
        setLoading(false)
      }
    )

    return () => {
      active = false
      abortRef.current?.abort()
      dictationRef.current?.stop()
      // Otherwise the browser keeps talking after the student navigates away.
      cancelSpeech()
    }
  }, [id])

  // Voices arrive asynchronously, and in some browsers only after the first
  // getVoices() call, so read once and then again on the change event.
  useEffect(() => {
    if (!synthesisSupported) return
    const load = () => setVoices(listVoices())
    load()
    return onVoicesChanged(load)
  }, [])

  useEffect(() => {
    setPreferredVoice(voiceURI)
    try {
      if (voiceURI) localStorage.setItem(VOICE_PREF_KEY, voiceURI)
      else localStorage.removeItem(VOICE_PREF_KEY)
    } catch {
      /* private window — selection still applies for this session */
    }
  }, [voiceURI])

  const handleVoiceChange = (nextURI) => {
    setVoiceURI(nextURI)
    setPreferredVoice(nextURI)
    // Speak a sample so the choice can be judged by ear rather than by name.
    cancelSpeech()
    speak('Right — walk me through that idea in your own words.')
  }

  useEffect(() => {
    try {
      localStorage.setItem(SPEAK_PREF_KEY, speakReplies ? '1' : '0')
    } catch {
      /* private window — the toggle still works for this session */
    }
    if (!speakReplies) cancelSpeech()
  }, [speakReplies])

  const toggleDictation = useCallback(() => {
    if (listening) {
      dictationRef.current?.stop()
      return
    }

    setError('')
    // Speaking and listening at once makes the mic hear the reply.
    cancelSpeech()

    dictationRef.current = startDictation({
      onResult: ({ transcript, isFinal }) => {
        if (isFinal) setDraft((prev) => (prev ? `${prev} ${transcript}` : transcript))
      },
      onError: (message) => setError(message),
      onEnd: () => setListening(false),
    })

    if (dictationRef.current) setListening(true)
  }, [listening])

  // Keep the newest turn in view as the reply streams in.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, streaming])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      const text = draft.trim()
      if (!text || busy) return

      setError('')
      setDraft('')
      setBusy(true)
      setStreaming('')
      spokenBufferRef.current = ''
      cancelSpeech()
      // Show the student's own turn immediately; the server persists the
      // authoritative copy.
      setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', content: text }])

      const controller = new AbortController()
      abortRef.current = controller

      const result = await sendMessage({
        conversationId: id,
        message: text,
        signal: controller.signal,
        onDelta: (chunk) => {
          setStreaming((prev) => prev + chunk)
          if (!speakRef.current) return
          // Speak whole sentences as they complete rather than each network chunk.
          spokenBufferRef.current += chunk
          const [sentences, remainder] = splitSentences(spokenBufferRef.current)
          spokenBufferRef.current = remainder
          sentences.forEach(speak)
        },
      })

      abortRef.current = null
      setBusy(false)
      setStreaming('')

      // Anything left over never hit a sentence boundary — speak it so the reply
      // does not end mid-thought.
      if (speakRef.current && spokenBufferRef.current.trim()) {
        speak(spokenBufferRef.current)
      }
      spokenBufferRef.current = ''

      if (result.error) {
        setError(result.error)
        // Hitting the cap is not a failure to retry — put their message back in
        // the box rather than losing it, and drop the optimistic turn.
        if (result.rateLimited) {
          setDraft(text)
          setMessages((prev) => prev.filter((m) => !String(m.id).startsWith('local-')))
        }
        return
      }

      if (result.text) {
        setMessages((prev) => [
          ...prev,
          { id: `local-reply-${Date.now()}`, role: 'assistant', content: result.text },
        ])
      }
    },
    [draft, busy, id]
  )

  return (
    <div className="chat-page">
      <DotBackground variant="bare" />

      <div className="chat-frame">
        {/* ----------------------------------------------------- header --- */}
        <motion.header
          className="chat-head"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: ease.out }}
        >
          <Link to="/dashboard" className="chat-back">
            <span className="chat-back-arrow" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 8H4M7.5 4l-4 4 4 4" />
              </svg>
            </span>
            Dashboard
          </Link>

          <div className="chat-titles">
            <h1 className="chat-title">
              {loading ? (
                <span className="skeleton chat-title-skel" />
              ) : (
                conversation?.title ?? 'Conversation'
              )}
            </h1>
            {documents.length > 0 && (
              <motion.p
                className="chat-sources"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {documents.map((d) => (
                  <span className="source-chip" key={d}>
                    {d}
                  </span>
                ))}
              </motion.p>
            )}
          </div>

          {synthesisSupported && (
            <div className="chat-voice">
              <button
                type="button"
                className={`speak-toggle ${speakReplies ? 'is-on' : ''}`}
                role="switch"
                aria-checked={speakReplies}
                onClick={() => setSpeakReplies((v) => !v)}
              >
                <motion.span className="speak-knob" layout transition={spring.pop} />
                <span className="speak-text">Read aloud</span>
              </button>

              {/* Only offered once reading aloud is on — a voice picker for
                  speech nobody is hearing is a control that does nothing. */}
              <AnimatePresence>
                {speakReplies && voices.length > 0 && (
                  <motion.label
                    className="voice-pick"
                    initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                    animate={{ opacity: 1, width: 'auto', marginLeft: 8 }}
                    exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                    transition={{ duration: 0.3, ease: ease.out }}
                  >
                    <span className="sr-only">Voice</span>
                    <select
                      value={voiceURI}
                      onChange={(e) => handleVoiceChange(e.target.value)}
                    >
                      <option value="">Browser default</option>
                      {voices.map((voice) => (
                        <option key={voice.voiceURI} value={voice.voiceURI}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))}
                    </select>
                  </motion.label>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.header>

        {/* ------------------------------------------------------ thread --- */}
        <div className="thread">
          <AnimatePresence>
            {error && (
              <motion.div
                className="note note-error thread-error"
                role="alert"
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.3, ease: ease.out }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {!loading && messages.length === 0 && !streaming && (
            <motion.div
              className="thread-empty"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: ease.out, delay: 0.15 }}
            >
              <motion.span
                className="empty-mark"
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                  <path d="M4 9.5a5.5 5.5 0 0 1 5.5-5.5h1" />
                  <path d="M20 14.5a5.5 5.5 0 0 1-5.5 5.5h-1" />
                  <circle cx="8" cy="16" r="2.4" />
                  <circle cx="16" cy="8" r="2.4" />
                </svg>
              </motion.span>
              <p className="empty-title">Start by getting it wrong</p>
              <p className="empty-body">
                Explain a concept from your materials in your own words, roughly. It
                will push back where it needs to — that is the part that does the
                work.
              </p>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                className={`turn turn-${msg.role}`}
                layout="position"
                /* Turns arrive from the side they belong to, so the direction of
                   travel encodes who is speaking before the label is read. */
                initial={{
                  opacity: 0,
                  y: 18,
                  x: msg.role === 'user' ? 18 : -18,
                  scale: 0.97,
                }}
                animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                transition={spring.glide}
              >
                <span className="turn-who">{msg.role === 'user' ? 'You' : 'TATE AI'}</span>
                <p className="turn-text">{msg.content}</p>
              </motion.div>
            ))}
          </AnimatePresence>

          {streaming && (
            <motion.div
              className="turn turn-assistant is-streaming"
              layout="position"
              initial={{ opacity: 0, y: 14, x: -14 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              transition={spring.glide}
            >
              <span className="turn-who">TATE AI</span>
              <p className="turn-text">
                {streaming}
                <span className="caret" aria-hidden="true" />
              </p>
            </motion.div>
          )}

          <AnimatePresence>
            {busy && !streaming && (
              <motion.div
                className="turn turn-assistant is-thinking"
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={spring.glide}
              >
                <span className="turn-who">TATE AI</span>
                <span className="thinking">
                  <ThinkingDots />
                  <span className="thinking-word">Thinking</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} className="thread-anchor" />
        </div>

        {/* ---------------------------------------------------- composer --- */}
        <motion.form
          className={`composer ${composerFocus ? 'is-focused' : ''} ${
            listening ? 'is-listening' : ''
          }`}
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: ease.out, delay: 0.1 }}
        >
          <textarea
            className="composer-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setComposerFocus(true)}
            onBlur={() => setComposerFocus(false)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — chat convention.
              if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e)
            }}
            placeholder={listening ? 'Listening…' : 'Explain a concept, or ask a question…'}
            rows={2}
            disabled={busy}
          />

          <div className="composer-tools">
            {recognitionSupported && (
              <motion.button
                type="button"
                className={`mic ${listening ? 'is-live' : ''}`}
                onClick={toggleDictation}
                disabled={busy}
                aria-pressed={listening}
                aria-label={listening ? 'Stop dictating' : 'Dictate your message'}
                title={listening ? 'Stop dictating' : 'Dictate your message'}
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.92 }}
                transition={spring.snap}
              >
                {/* A ring pulsing out of the button while the mic is open — the
                    strongest possible "you are being heard" signal. */}
                <AnimatePresence>
                  {listening && (
                    <motion.span
                      className="mic-halo"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: [0.9, 1.7], opacity: [0.7, 0] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                      aria-hidden="true"
                    />
                  )}
                </AnimatePresence>

                {listening ? (
                  <Waveform active bars={4} />
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 3.5a2.6 2.6 0 0 1 2.6 2.6v5a2.6 2.6 0 0 1-5.2 0v-5A2.6 2.6 0 0 1 12 3.5z" />
                    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
                    <path d="M12 17.5V21" />
                  </svg>
                )}
              </motion.button>
            )}

            <motion.button
              className="send"
              type="submit"
              disabled={busy || !draft.trim()}
              whileHover={busy || !draft.trim() ? undefined : { scale: 1.05 }}
              whileTap={busy || !draft.trim() ? undefined : { scale: 0.94 }}
              transition={spring.snap}
              aria-label="Send"
            >
              <AnimatePresence mode="wait" initial={false}>
                {busy ? (
                  <motion.span
                    key="busy"
                    className="auth-spinner send-spinner"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.16 }}
                    aria-hidden="true"
                  />
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 6 }}
                    transition={{ duration: 0.16 }}
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 10h13M11 5l5 5-5 5" />
                    </svg>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          <span className="composer-hint">
            Enter to send · Shift+Enter for a new line
          </span>
        </motion.form>
      </div>
    </div>
  )
}

export default Conversation
