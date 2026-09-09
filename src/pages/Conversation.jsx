import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DotBackground from '../components/DotBackground'
import {
  getConversation,
  listConversationDocuments,
  listMessages,
  sendMessage,
} from '../lib/conversations'
import './Conversation.css'

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

  const abortRef = useRef(null)
  const bottomRef = useRef(null)

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
    }
  }, [id])

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
      // Show the student's own turn immediately; the server persists the
      // authoritative copy.
      setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', content: text }])

      const controller = new AbortController()
      abortRef.current = controller

      const result = await sendMessage({
        conversationId: id,
        message: text,
        signal: controller.signal,
        onDelta: (chunk) => setStreaming((prev) => prev + chunk),
      })

      abortRef.current = null
      setBusy(false)
      setStreaming('')

      if (result.error) {
        setError(result.error)
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
            placeholder="Explain a concept, or ask a question…"
            rows={2}
            disabled={busy}
          />
          <button className="composer-send" type="submit" disabled={busy || !draft.trim()}>
            {busy ? '…' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Conversation
