import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { deleteStudyItem, generateStudy, STUDY_KINDS } from '../lib/study'
import { ease, spring } from '../motion/tokens'
import './Study.css'

const MAKE = [
  {
    kind: 'flashcards',
    label: 'Flashcards',
    blurb: 'About 20 cards on the key ideas, reviewed on a schedule so they stick.',
    working: 'Writing flashcards…',
  },
  {
    kind: 'quiz',
    label: 'Practice quiz',
    blurb: '10 exam-style multiple-choice questions, with an explanation for each.',
    working: 'Writing the quiz…',
  },
  {
    kind: 'guide',
    label: 'Study guide',
    blurb: 'A one-page summary: main ideas, formulas, and questions to check yourself.',
    working: 'Writing the study guide…',
  },
]

const MAX_DOCUMENTS = 10

const itemMeta = (item) => {
  if (item.kind === 'flashcards') {
    return item.due > 0 ? `${item.due} due of ${item.total}` : `${item.total} cards · all caught up`
  }
  if (item.kind === 'quiz') {
    return item.attempts
      ? `${item.total} questions · best ${item.best}/${item.total}`
      : `${item.total} questions · not taken yet`
  }
  return new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const KindIcon = ({ kind }) => {
  const paths = {
    flashcards: (
      <>
        <rect x="3.5" y="6" width="13" height="10" rx="2" />
        <path d="M7.5 6V5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 19.5 5v8a1.5 1.5 0 0 1-1.5 1.5h-1.5" />
      </>
    ),
    quiz: (
      <>
        <circle cx="11" cy="11" r="7.5" />
        <path d="M8.8 8.8a2.3 2.3 0 1 1 3.1 2.2c-.6.2-.9.7-.9 1.3v.4" />
        <path d="M11 15.4h.01" />
      </>
    ),
    guide: (
      <>
        <path d="M5 4.5h8.5L17 8v9.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z" />
        <path d="M7.5 10h6M7.5 13h6M7.5 16h4" />
      </>
    ),
  }
  return (
    <svg viewBox="0 0 22 22" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[kind]}
    </svg>
  )
}

/**
 * Flashcards, quizzes, and study guides made from the student's materials.
 *
 * The list leads with decks that have cards due, since reviewing those today is
 * the most useful thing on the panel. Making a new one is two steps in the same
 * space: choose what to make, then which documents to make it from.
 */
const StudyPanel = ({ items, documents, courseId, loading, onChanged }) => {
  const navigate = useNavigate()
  const [view, setView] = useState('list') // list | make
  const [kind, setKind] = useState('flashcards')
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const visible = useMemo(() => {
    const filtered = courseId ? items.filter((i) => i.course_id === courseId) : items
    // Decks with cards due first, then everything else newest first.
    return [...filtered].sort((a, b) => (b.due > 0) - (a.due > 0))
  }, [items, courseId])

  const readyDocs = documents.filter(
    (d) => d.status === 'ready' && (!courseId || d.course_id === courseId || !d.course_id)
  )
  const dueTotal = visible.reduce((sum, i) => sum + (i.due ?? 0), 0)

  const open = (item) => navigate(`/study/${STUDY_KINDS[item.kind].path}/${item.id}`)

  const startMaking = () => {
    // Pre-select the course's documents: "make flashcards for BIO 101" usually
    // means from everything filed there.
    setSelected(courseId ? readyDocs.filter((d) => d.course_id === courseId).slice(0, MAX_DOCUMENTS).map((d) => d.id) : [])
    setError('')
    setView('make')
  }

  const handleMake = async () => {
    if (!selected.length || busy) return
    setBusy(true)
    setError('')
    const result = await generateStudy({ kind, documentIds: selected, courseId })
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setView('list')
    onChanged?.()
    navigate(`/study/${STUDY_KINDS[kind].path}/${result.id}`)
  }

  const handleDelete = async (item) => {
    const { error: deleteError } = await deleteStudyItem(item.kind, item.id)
    if (deleteError) setError(deleteError.message)
    else onChanged?.()
  }

  const toggle = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_DOCUMENTS ? prev : [...prev, id]
    )

  const making = MAKE.find((m) => m.kind === kind)

  return (
    <div className="study-panel">
      <AnimatePresence>
        {error && (
          <motion.div
            className="note note-error"
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {view === 'list' ? (
          <motion.div
            key="list"
            className="study-view"
            initial={{ opacity: 0, x: -20, filter: 'blur(6px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -20, filter: 'blur(6px)' }}
            transition={{ duration: 0.3, ease: ease.out }}
          >
            {dueTotal > 0 && (
              <p className="study-due-banner">
                <strong>{dueTotal}</strong> flashcard{dueTotal === 1 ? '' : 's'} due for review today.
              </p>
            )}

            {loading ? (
              <div className="conv-loading">
                {[0, 1].map((i) => (
                  <div className="skeleton conv-skel" key={i} />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <p className="panel-empty">
                Turn your materials into flashcards, a practice quiz, or a study guide. Each is made
                from your own documents, so it covers what your course covers.
              </p>
            ) : (
              <ul className="conv-list">
                <AnimatePresence initial={false}>
                  {visible.map((item) => (
                    <motion.li
                      key={`${item.kind}-${item.id}`}
                      className="conv-item"
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={spring.glide}
                    >
                      <button type="button" className="conv-open" onClick={() => open(item)}>
                        <span className={`study-icon is-${item.kind}`}>
                          <KindIcon kind={item.kind} />
                        </span>
                        <span className="study-item-text">
                          <span className="conv-title">{item.title}</span>
                          <span className={`study-item-meta ${item.due > 0 ? 'is-due' : ''}`}>
                            {STUDY_KINDS[item.kind].label} · {itemMeta(item)}
                          </span>
                        </span>
                      </button>
                      <motion.button
                        type="button"
                        className="row-delete"
                        onClick={() => handleDelete(item)}
                        aria-label={`Delete ${item.title}`}
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

            <button type="button" className="btn btn-ghost panel-button" onClick={startMaking}>
              Make study material
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="make"
            className="study-view"
            initial={{ opacity: 0, x: 22, filter: 'blur(6px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: 22, filter: 'blur(6px)' }}
            transition={{ duration: 0.3, ease: ease.out }}
          >
            <div className="make-kinds" role="radiogroup" aria-label="What to make">
              {MAKE.map((m) => (
                <button
                  key={m.kind}
                  type="button"
                  role="radio"
                  aria-checked={kind === m.kind}
                  className={`make-kind ${kind === m.kind ? 'is-on' : ''}`}
                  onClick={() => setKind(m.kind)}
                  disabled={busy}
                >
                  <span className={`study-icon is-${m.kind}`}>
                    <KindIcon kind={m.kind} />
                  </span>
                  <span className="make-kind-label">{m.label}</span>
                  <span className="make-kind-blurb">{m.blurb}</span>
                </button>
              ))}
            </div>

            <p className="conv-prompt">
              {readyDocs.length
                ? `From which materials? (up to ${MAX_DOCUMENTS})`
                : 'No documents are ready yet. Upload some under “Your materials” first.'}
            </p>
            <div className="pick-list">
              {readyDocs.map((doc) => {
                const on = selected.includes(doc.id)
                return (
                  <label key={doc.id} className={`pick-row ${on ? 'is-on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(doc.id)} disabled={busy} />
                    <span className="check-box" aria-hidden="true">
                      {on && (
                        <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 8.5l3.5 3.5L13 5" />
                        </svg>
                      )}
                    </span>
                    <span className="check-label">{doc.title}</span>
                  </label>
                )
              })}
            </div>

            <div className="study-actions">
              <button
                type="button"
                className="btn btn-primary study-go"
                onClick={handleMake}
                disabled={!selected.length || busy}
              >
                {busy ? making.working : `Make ${making.label.toLowerCase()}`}
              </button>
              <button type="button" className="conv-cancel" onClick={() => setView('list')} disabled={busy}>
                Cancel
              </button>
            </div>
            {busy && <p className="study-note">This takes up to a minute for a big set of materials.</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default StudyPanel
