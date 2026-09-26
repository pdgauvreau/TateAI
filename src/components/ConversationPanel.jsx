import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { createConversation, deleteConversation } from '../lib/conversations'
import { ease, spring } from '../motion/tokens'
import './ConversationPanel.css'

/**
 * The conversation list, and the picker that starts a new one.
 *
 * The two views occupy the same space, so they are crossfaded with
 * `AnimatePresence mode="wait"` and the picker slides in from the right — the
 * direction says "forward into a sub-step", and cancelling reverses it. Keeping
 * them in one box, rather than pushing the list down, means the panel does not
 * change height while the reader is choosing.
 */
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
    <div className="conv">
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

      <AnimatePresence mode="wait" initial={false}>
        {picking ? (
          <motion.div
            key="picker"
            className="conv-picker"
            initial={{ opacity: 0, x: 26, filter: 'blur(6px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: 26, filter: 'blur(6px)' }}
            transition={{ duration: 0.32, ease: ease.out }}
          >
            <p className="conv-prompt">
              {readyDocuments.length
                ? 'Which materials should this cover?'
                : 'No documents are ready yet. You can still start a general conversation.'}
            </p>

            <motion.div
              className="conv-checks"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.05 } },
              }}
              initial="hidden"
              animate="show"
            >
              {readyDocuments.map((doc) => {
                const on = selected.includes(doc.id)
                return (
                  <motion.label
                    key={doc.id}
                    className={`conv-check ${on ? 'is-on' : ''}`}
                    variants={{
                      hidden: { opacity: 0, x: -10 },
                      show: { opacity: 1, x: 0 },
                    }}
                    transition={{ duration: 0.3, ease: ease.out }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(doc.id)}
                    />
                    {/* A real checkbox, visually hidden, with this box drawn in its
                        place so the tick can be animated. */}
                    <span className="check-box" aria-hidden="true">
                      <motion.svg
                        viewBox="0 0 16 16"
                        width="11"
                        height="11"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={false}
                        animate={{ scale: on ? 1 : 0.4, opacity: on ? 1 : 0 }}
                        transition={spring.pop}
                      >
                        <path d="M3 8.5l3.5 3.5L13 5" />
                      </motion.svg>
                    </span>
                    <span className="check-label">{doc.title}</span>
                  </motion.label>
                )
              })}
            </motion.div>

            <div className="conv-picker-actions">
              <motion.button
                className="btn btn-primary conv-go"
                type="button"
                onClick={handleCreate}
                disabled={busy}
                whileHover={busy ? undefined : { scale: 1.02 }}
                whileTap={busy ? undefined : { scale: 0.98 }}
                transition={spring.snap}
              >
                {busy ? 'Starting…' : 'Start'}
                {selected.length > 0 && !busy && (
                  <motion.span
                    className="conv-count"
                    key={selected.length}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={spring.pop}
                  >
                    {selected.length}
                  </motion.span>
                )}
              </motion.button>

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
          </motion.div>
        ) : (
          <motion.div
            key="list"
            className="conv-listwrap"
            initial={{ opacity: 0, x: -20, filter: 'blur(6px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -20, filter: 'blur(6px)' }}
            transition={{ duration: 0.32, ease: ease.out }}
          >
            {loading ? (
              <div className="conv-loading">
                {[0, 1].map((i) => (
                  <div className="skeleton conv-skel" key={i} />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <p className="panel-empty">
                No conversations yet. Talking through your materials is where the
                studying actually happens.
              </p>
            ) : (
              <ul className="conv-list">
                <AnimatePresence initial={false}>
                  {conversations.map((conv, i) => (
                    <motion.li
                      key={conv.id}
                      className="conv-item"
                      layout
                      initial={{ opacity: 0, x: -14, height: 0 }}
                      animate={{ opacity: 1, x: 0, height: 'auto' }}
                      exit={{ opacity: 0, x: 24, height: 0, marginBottom: 0 }}
                      transition={{ ...spring.glide, delay: i < 6 ? i * 0.04 : 0 }}
                    >
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
                        <span className="conv-arrow" aria-hidden="true">
                          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 8h9M8.5 4l4 4-4 4" />
                          </svg>
                        </span>
                      </button>

                      <motion.button
                        type="button"
                        className="row-delete"
                        onClick={() => handleDelete(conv.id)}
                        aria-label={`Delete ${conv.title}`}
                        whileHover={{ scale: 1.12, rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                        transition={spring.snap}
                      >
                        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                      </motion.button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}

            <motion.button
              className="btn btn-ghost panel-button"
              type="button"
              onClick={() => setPicking(true)}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              transition={spring.snap}
            >
              Start a conversation
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ConversationPanel
