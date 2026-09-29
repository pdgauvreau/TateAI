import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import DotBackground from '../components/DotBackground'
import MessageContent from '../components/MessageContent'
import { ThinkingDots, Waveform } from '../components/motion/Interactive'
import { useAuth } from '../context/AuthContext'
import { ease, spring } from '../motion/tokens'
import {
  getConversation,
  listConversationDocuments,
  listMessages,
  sendMessage,
} from '../lib/conversations'
import { ACCEPT, uploadDocument, validateFile } from '../lib/documents'
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
const DEEP_PREF_KEY = 'tateai:deeper-thinking'
const VOICE_PREF_KEY = 'tateai:voice-uri'

// Reply modes. Each changes how the tutor answers the next message; the
// instruction behind it lives on the server. `ask` is what gets sent when the
// student picks a mode and sends without typing anything.
const MODES = [
  {
    id: 'hint',
    label: 'Hint',
    tag: 'Asked for a hint',
    ask: 'Can I have a hint?',
    placeholder: 'Where are you stuck? Or just send for a nudge.',
  },
  {
    id: 'example',
    label: 'Similar example',
    tag: 'Asked for a similar example',
    ask: 'Can you show me a similar example?',
    placeholder: 'Paste the problem, or send to use the one you are on.',
  },
  {
    id: 'check',
    label: 'Check my work',
    tag: 'Asked for a check',
    ask: null,
    placeholder: 'Paste your steps, or attach a photo of your working.',
  },
  {
    id: 'essay',
    label: 'Essay feedback',
    tag: 'Asked for writing feedback',
    ask: null,
    placeholder: 'Paste your draft, or attach it as a Word file.',
    // Feedback, not a rewrite: see INTENT_INSTRUCTIONS.essay in api/chat.js.
  },
]

// Modes that need something to look at before they can be sent.
const NEEDS_WORK = { check: 'your working', essay: 'your draft' }

const modeById = (id) => MODES.find((mode) => mode.id === id)

const PaperclipIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.5 11.5 12.4 19.6a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" />
  </svg>
)

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
  const { user } = useAuth()

  const [conversation, setConversation] = useState(null)
  const [documents, setDocuments] = useState([])
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [composerFocus, setComposerFocus] = useState(false)

  // The reply mode for the next message, or null for an ordinary one.
  const [intent, setIntent] = useState(null)
  // A file attached from the composer: { status: 'reading' | 'ready', title,
  // documentId }. It is read and linked to the conversation before sending, so
  // the tutor has its text by the time the message arrives.
  const [attachment, setAttachment] = useState(null)
  const attachInputRef = useRef(null)

  const [listening, setListening] = useState(false)
  const [speakReplies, setSpeakReplies] = useState(() => {
    // Reading storage can throw in private windows, so never let it break the page.
    try {
      return localStorage.getItem(SPEAK_PREF_KEY) === '1'
    } catch {
      return false
    }
  })

  // Off by default: it is the more expensive tier, so the student opts in for a
  // hard topic rather than paying for it on every question.
  const [deepThinking, setDeepThinking] = useState(() => {
    try {
      return localStorage.getItem(DEEP_PREF_KEY) === '1'
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

  useEffect(() => {
    try {
      localStorage.setItem(DEEP_PREF_KEY, deepThinking ? '1' : '0')
    } catch {
      /* private window — the toggle still works for this session */
    }
  }, [deepThinking])

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

  const handleAttach = useCallback(
    async (fileList) => {
      const file = fileList?.[0]
      if (attachInputRef.current) attachInputRef.current.value = ''
      if (!file || !user) return

      const invalid = validateFile(file)
      if (invalid) {
        setError(invalid)
        return
      }

      setError('')
      setAttachment({ status: 'reading', title: file.name })
      const result = await uploadDocument({
        file,
        userId: user.id,
        conversationId: id,
        courseId: conversation?.course_id ?? null,
      })

      if (result.error) {
        setAttachment(null)
        setError(result.error)
        return
      }

      setAttachment({ status: 'ready', title: result.title, documentId: result.documentId })
      setDocuments((prev) => (prev.includes(result.title) ? prev : [...prev, result.title]))
    },
    [id, user, conversation]
  )

  // Keep the newest turn in view as the reply streams in.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, streaming])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      if (busy || attachment?.status === 'reading') return

      const typed = draft.trim()
      const mode = modeById(intent)
      const attached = attachment?.status === 'ready' ? attachment : null

      if (NEEDS_WORK[mode?.id] && !typed && !attached) {
        setError(`Paste ${NEEDS_WORK[mode.id]}, or attach it, and then send.`)
        return
      }

      // With nothing typed, a mode or an attachment still says what is wanted.
      const text =
        typed ||
        (mode?.id === 'check' && attached ? `Can you check my work in "${attached.title}"?` : null) ||
        (mode?.id === 'essay' && attached ? `Can you give me feedback on "${attached.title}"?` : null) ||
        mode?.ask ||
        (attached ? `I've attached "${attached.title}".` : '')
      if (!text) return

      const sentIntent = intent
      const sentAttachment = attached

      setError('')
      setDraft('')
      setIntent(null)
      setAttachment(null)
      setBusy(true)
      setStreaming('')
      spokenBufferRef.current = ''
      cancelSpeech()
      // Show the student's own turn immediately; the server persists the
      // authoritative copy.
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          role: 'user',
          content: text,
          intent: sentIntent,
          attachment: sentAttachment ? { title: sentAttachment.title } : null,
        },
      ])

      const controller = new AbortController()
      abortRef.current = controller

      const result = await sendMessage({
        conversationId: id,
        message: text,
        deep: deepThinking,
        intent: sentIntent,
        documentId: sentAttachment?.documentId ?? null,
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
          setDraft(typed)
          setIntent(sentIntent)
          setAttachment(sentAttachment)
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
    [draft, busy, id, intent, attachment, deepThinking]
  )

  const activeMode = modeById(intent)
  const canSend =
    !busy &&
    attachment?.status !== 'reading' &&
    Boolean(draft.trim() || attachment?.status === 'ready' || (activeMode && activeMode.ask))

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

          <div className="chat-controls">
            <button
              type="button"
              className={`speak-toggle ${deepThinking ? 'is-on' : ''}`}
              role="switch"
              aria-checked={deepThinking}
              aria-describedby="deep-hint"
              title="Uses a more capable model that reasons longer before answering. Replies are slower and use your allowance several times faster."
              onClick={() => setDeepThinking((v) => !v)}
            >
              <motion.span className="speak-knob" layout transition={spring.pop} />
              <span className="speak-text">Deeper thinking</span>
            </button>
            <span id="deep-hint" className="sr-only">
              Uses a more capable model that reasons longer before answering. Replies are
              slower and use your allowance several times faster.
            </span>

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
          </div>
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
                work. Stuck on a problem? Snap a photo of it with the camera button.
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
                {msg.role === 'user' && (msg.intent || msg.attachment) && (
                  <span className="turn-tags">
                    {msg.intent && modeById(msg.intent) && (
                      <span className="turn-tag">{modeById(msg.intent).tag}</span>
                    )}
                    {msg.attachment?.title && (
                      <span className="turn-tag">
                        <PaperclipIcon />
                        {msg.attachment.title}
                      </span>
                    )}
                  </span>
                )}
                {msg.role === 'assistant' ? (
                  <MessageContent text={msg.content} />
                ) : (
                  <p className="turn-text">{msg.content}</p>
                )}
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
              <MessageContent text={streaming} streaming />
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
          <div className="composer-top">
            <div className="modes" role="group" aria-label="Reply mode">
              {MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={`mode-chip ${intent === mode.id ? 'is-on' : ''}`}
                  aria-pressed={intent === mode.id}
                  onClick={() => setIntent((current) => (current === mode.id ? null : mode.id))}
                  disabled={busy}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {attachment && (
                <motion.span
                  className={`attach-chip ${attachment.status === 'reading' ? 'is-reading' : ''}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={spring.snap}
                >
                  {attachment.status === 'reading' ? (
                    <span className="auth-spinner attach-spinner" aria-hidden="true" />
                  ) : (
                    <PaperclipIcon />
                  )}
                  <span className="attach-name">
                    {attachment.status === 'reading' ? `Reading ${attachment.title}…` : attachment.title}
                  </span>
                  {attachment.status === 'ready' && (
                    // Removes it from this message only. The file stays attached
                    // to the conversation, so the tutor can still refer to it.
                    <button
                      type="button"
                      className="attach-remove"
                      onClick={() => setAttachment(null)}
                      aria-label={`Don't mention ${attachment.title} in this message`}
                    >
                      ×
                    </button>
                  )}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

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
            placeholder={
              listening
                ? 'Listening…'
                : (activeMode?.placeholder ?? 'Explain a concept, or ask a question…')
            }
            rows={2}
            disabled={busy}
          />

          <div className="composer-tools">
            <input
              ref={attachInputRef}
              type="file"
              accept={ACCEPT}
              className="attach-input"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => handleAttach(e.target.files)}
            />
            <motion.button
              type="button"
              className="mic"
              onClick={() => attachInputRef.current?.click()}
              disabled={busy || attachment?.status === 'reading'}
              aria-label="Attach a photo or file"
              title="Attach a photo of your homework, or a file"
              whileHover={{ scale: 1.07 }}
              whileTap={{ scale: 0.92 }}
              transition={spring.snap}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
                <circle cx="12" cy="12.5" r="3.4" />
              </svg>
            </motion.button>

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
              disabled={!canSend}
              whileHover={canSend ? { scale: 1.05 } : undefined}
              whileTap={canSend ? { scale: 0.94 } : undefined}
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
