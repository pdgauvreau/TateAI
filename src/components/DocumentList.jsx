import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { deleteDocument, formatBytes } from '../lib/documents'
import './DocumentList.css'

const STATUS_LABEL = {
  pending: 'Queued',
  processing: 'Reading…',
  ready: 'Ready',
  failed: 'Failed',
}

const DocumentList = ({ documents, loading, onChanged }) => {
  const { user } = useAuth()
  const [removingId, setRemovingId] = useState(null)
  const [error, setError] = useState('')

  const handleDelete = async (id) => {
    setError('')
    setRemovingId(id)
    const { error: deleteError } = await deleteDocument({ id, userId: user.id })
    setRemovingId(null)

    if (deleteError) setError(deleteError)
    else onChanged?.()
  }

  if (loading) {
    return <p className="panel-empty">Loading your materials…</p>
  }

  if (!documents.length) {
    return (
      <p className="panel-empty">
        No documents yet. Upload a PDF above and TATE AI will read it.
      </p>
    )
  }

  return (
    <>
      {error && <div className="doc-error">{error}</div>}
      <ul className="doc-list">
        {documents.map((doc) => (
          <li key={doc.id} className="doc-item">
            <div className="doc-main">
              <span className="doc-title">{doc.title}</span>
              <span className="doc-meta">
                {formatBytes(doc.size_bytes)} ·{' '}
                {new Date(doc.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              {doc.status === 'failed' && doc.status_detail && (
                <span className="doc-detail">{doc.status_detail}</span>
              )}
            </div>

            <span className={`doc-status status-${doc.status}`}>
              {STATUS_LABEL[doc.status] ?? doc.status}
            </span>

            <button
              type="button"
              className="doc-delete"
              onClick={() => handleDelete(doc.id)}
              disabled={removingId === doc.id}
              aria-label={`Delete ${doc.title}`}
            >
              {removingId === doc.id ? '…' : '×'}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

export default DocumentList
