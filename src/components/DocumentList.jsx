import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { deleteDocument, formatBytes } from '../lib/documents'
import { ease, spring } from '../motion/tokens'
import './DocumentList.css'

const STATUS_LABEL = {
  pending: 'Queued',
  processing: 'Reading…',
  ready: 'Ready',
  failed: 'Failed',
}

/**
 * The uploaded documents.
 *
 * The motion here is doing real work rather than decorating a list:
 *
 * - Rows enter staggered and leave by collapsing their own height, so deleting
 *   one visibly closes the gap instead of the rest of the list jumping up.
 * - `layout` on each row means a removal animates the survivors into their new
 *   positions.
 * - The two in-progress statuses pulse; `ready` and `failed` sit still. A status
 *   that moves means "still happening", which is information.
 */
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
    return (
      <div className="doc-loading">
        {/* Placeholders in the shape of the rows they become, so the panel does
            not resize when the data lands. */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="skeleton doc-skel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.08 }}
          />
        ))}
      </div>
    )
  }

  if (!documents.length) {
    return (
      <motion.p
        className="panel-empty"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: ease.out }}
      >
        No documents yet. Upload a PDF above and TATE AI will read it.
      </motion.p>
    )
  }

  return (
    <>
      <AnimatePresence>
        {error && (
          <motion.div
            className="note note-error"
            role="alert"
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 10 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.28, ease: ease.out }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <ul className="doc-list">
        <AnimatePresence initial={false}>
          {documents.map((doc, i) => (
            <motion.li
              key={doc.id}
              className="doc-item"
              layout
              initial={{ opacity: 0, x: -14, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 24, height: 0, marginBottom: 0 }}
              transition={{
                ...spring.glide,
                // Only the first render staggers; a later insert should appear at
                // once rather than waiting behind rows that are already there.
                delay: i < 6 ? i * 0.04 : 0,
              }}
            >
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

              <span className={`doc-status is-${doc.status}`}>
                {(doc.status === 'pending' || doc.status === 'processing') && (
                  <motion.span
                    className="doc-status-dot"
                    animate={{ opacity: [0.35, 1, 0.35], scale: [0.85, 1.15, 0.85] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    aria-hidden="true"
                  />
                )}
                {STATUS_LABEL[doc.status] ?? doc.status}
              </span>

              <motion.button
                type="button"
                className="row-delete"
                onClick={() => handleDelete(doc.id)}
                disabled={removingId === doc.id}
                aria-label={`Delete ${doc.title}`}
                whileHover={{ scale: 1.12, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                transition={spring.snap}
              >
                {removingId === doc.id ? (
                  <span className="auth-spinner row-spinner" aria-hidden="true" />
                ) : (
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                )}
              </motion.button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </>
  )
}

export default DocumentList
