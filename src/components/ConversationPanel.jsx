import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createConversation, deleteConversation } from '../lib/conversations'
import './ConversationPanel.css'

const ConversationPanel = ({ conversations, documents, loading, onChanged }) => {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [picking, setPicking] = useState(false)
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const readyDocuments = documents.filter((doc) => doc.status === 'ready')

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const handleCreate = async () => {
    setError('')
    setBusy(true)

    // Name the conversation after the material it covers — far more useful in a
    // list than "New conversation" repeated.
    const title =
      selected.length === 1
        ? readyDocuments.find((doc) => doc.id === selected[0])?.title
        : selected.length > 1
          ? `${selected.length} documents`
          : 'New conversation'

    const { id, error: createError } = await createConversation({
      userId: user.id,
      title,
      documentIds: selected,
    })
    setBusy(false)

    if (createError) {
      setError(createError)
      return
    }
    navigate(`/chat/${id}`)
  }

  const handleDelete = async (id) => {
    const { error: deleteError } = await deleteConversation(id)
    if (deleteError) setError(deleteError)
    else onChanged?.()
  }

  return (
    <>
      {error && <div className="conv-error">{error}</div>}

      {picking ? (
        <div className="conv-picker">
          <p className="conv-picker-label">
            {readyDocuments.length
              ? 'Which materials should this cover?'
              : 'No documents are ready yet. You can still start a general conversation.'}
          </p>

          {readyDocuments.map((doc) => (
            <label key={doc.id} className="conv-check">
              <input
                type="checkbox"
                checked={selected.includes(doc.id)}
                onChange={() => toggle(doc.id)}
              />
              <span>{doc.title}</span>
            </label>
          ))}

          <div className="conv-picker-actions">
            <button className="panel-button" type="button" onClick={handleCreate} disabled={busy}>
              {busy ? 'Starting…' : 'Start'}
            </button>
            <button
              className="conv-cancel"
              type="button"
              onClick={() => {
                setPicking(false)
                setSelected([])
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {loading ? (
            <p className="panel-empty">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="panel-empty">
              No conversations yet. Talking through your materials is how the studying actually
              happens.
            </p>
          ) : (
            <ul className="conv-list">
              {conversations.map((conv) => (
                <li key={conv.id} className="conv-item">
                  <button
                    type="button"
                    className="conv-open"
                    onClick={() => navigate(`/chat/${conv.id}`)}
                  >
                    <span className="conv-title">{conv.title}</span>
                    <span className="conv-date">
                      {new Date(conv.updated_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="doc-delete"
                    onClick={() => handleDelete(conv.id)}
                    aria-label={`Delete ${conv.title}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button className="panel-button" type="button" onClick={() => setPicking(true)}>
            Start a conversation
          </button>
        </>
      )}
    </>
  )
}

export default ConversationPanel
