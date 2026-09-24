import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DotBackground from '../components/DotBackground'
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
    <div className="conversation-page">
      <DotBackground />
      <div className="conversation-container">
        <header className="conversation-header">
          <Link to="/dashboard" className="conversation-back">
            ← Dashboard
          </Link>
          <h1 className="conversation-title">
            {loading ? 'Loading…' : (conversation?.title ?? 'Conversation')}
          </h1>
          {documents.length > 0 && (
            <p className="conversation-docs">Using: {documents.join(', ')}</p>
          )}
          {synthesisSupported && (
            <div className="voice-controls">
              <label className="speak-toggle">
                <input
                  type="checkbox"
                  checked={speakReplies}
                  onChange={(e) => setSpeakReplies(e.target.checked)}
                />
                <span>Read replies aloud</span>
              </label>

              {speakReplies && voices.length > 0 && (
                <label className="voice-picker">
                  <span className="voice-picker-label">Voice</span>
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
                </label>
              )}
            </div>
          )}
        </header>

        {error && <div className="conversation-error">{error}</div>}

        <div className="thread">
          {!loading && messages.length === 0 && !streaming && (
            <p className="thread-empty">
              Start by explaining a concept from your materials in your own words — TATE AI will
              push back where it needs to.
            </p>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`turn turn-${msg.role}`}>
              <span className="turn-role">{msg.role === 'user' ? 'You' : 'TATE AI'}</span>
              <p className="turn-text">{msg.content}</p>
            </div>
          ))}

          {streaming && (
            <div className="turn turn-assistant">
              <span className="turn-role">TATE AI</span>
              <p className="turn-text">{streaming}</p>
            </div>
          )}

          {busy && !streaming && <p className="thread-thinking">Thinking…</p>}
          <div ref={bottomRef} />
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            className="composer-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — chat convention.
              if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e)
            }}
            placeholder={listening ? 'Listening…' : 'Explain a concept, or ask a question…'}
            rows={2}
            disabled={busy}
          />
          {recognitionSupported && (
            <button
              type="button"
              className={`composer-mic ${listening ? 'listening' : ''}`}
              onClick={toggleDictation}
              disabled={busy}
              aria-pressed={listening}
              aria-label={listening ? 'Stop dictating' : 'Dictate your message'}
              title={listening ? 'Stop dictating' : 'Dictate your message'}
            >
              ●
            </button>
          )}
          <button className="composer-send" type="submit" disabled={busy || !draft.trim()}>
            {busy ? '…' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Conversation
