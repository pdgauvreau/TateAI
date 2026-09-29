import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import {
  ASSIGNMENT_KINDS,
  createAssignments,
  deleteAssignment,
  describeDue,
  fromDueAt,
  groupAssignments,
  importFromSyllabus,
  kindLabel,
  toDueAt,
  todayISO,
  updateAssignment,
} from '../lib/assignments'
import { ease, spring } from '../motion/tokens'
import './Study.css'

const GROUPS = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'later', label: 'Later' },
  { id: 'done', label: 'Recently done' },
]

const slide = {
  initial: { opacity: 0, x: 22, filter: 'blur(6px)' },
  animate: { opacity: 1, x: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, x: 22, filter: 'blur(6px)' },
  transition: { duration: 0.3, ease: ease.out },
}

const CourseTag = ({ course }) =>
  course ? (
    <span className="course-tag" data-color={course.color}>
      <span className="course-dot" aria-hidden="true" />
      {course.name}
    </span>
  ) : null

/**
 * The planner: what is due, grouped by when.
 *
 * Three sub-views share the panel, like the conversation picker: the list, a
 * form to add one assignment, and the syllabus import, which reads a document,
 * shows the dates it found, and saves only the ones the student keeps.
 */
const AssignmentsPanel = ({ assignments, courses, documents, courseId, loading, onChanged }) => {
  const { user } = useAuth()
  const [view, setView] = useState('list') // list | add | import | review
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Add form
  const [form, setForm] = useState({ title: '', kind: 'homework', date: todayISO(), time: '', course: '' })

  // Syllabus import
  const [sourceId, setSourceId] = useState(null)
  const [found, setFound] = useState([])
  const [keep, setKeep] = useState([])
  const [importCourse, setImportCourse] = useState(null)
  const [importNote, setImportNote] = useState('')

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])
  const visible = courseId ? assignments.filter((a) => a.course_id === courseId) : assignments
  const groups = groupAssignments(visible)
  const openCount = visible.filter((a) => !a.done_at).length
  const readyDocs = documents.filter(
    (d) => d.status === 'ready' && (!courseId || d.course_id === courseId || !d.course_id)
  )

  const reset = () => {
    setView('list')
    setError('')
    setBusy(false)
    setSourceId(null)
    setFound([])
    setKeep([])
    setImportNote('')
  }

  const openAdd = () => {
    setForm({ title: '', kind: 'homework', date: todayISO(), time: '', course: courseId ?? '' })
    setError('')
    setView('add')
  }

  const handleAdd = async (event) => {
    event.preventDefault()
    if (!form.title.trim() || !form.date || busy) return
    setBusy(true)
    const { error: createError } = await createAssignments({
      userId: user.id,
      rows: [
        {
          title: form.title.trim().slice(0, 200),
          kind: form.kind,
          due_at: toDueAt(form.date, form.time),
          course_id: form.course || null,
        },
      ],
    })
    setBusy(false)
    if (createError) {
      setError(createError.message)
      return
    }
    reset()
    onChanged?.()
  }

  const handleImport = async () => {
    if (!sourceId || busy) return
    setBusy(true)
    setError('')
    const result = await importFromSyllabus({ documentId: sourceId, courseId })
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }

    // Anything already in the planner with the same title and day is left out,
    // so importing the same syllabus twice does not double every deadline.
    const existing = new Set(assignments.map((a) => `${a.title.toLowerCase()}|${fromDueAt(a.due_at).date}`))
    const fresh = result.assignments.filter((a) => !existing.has(`${a.title.toLowerCase()}|${a.due_date}`))

    setFound(fresh)
    setKeep(fresh.map((_, i) => i))
    setImportCourse(result.courseId ?? courseId ?? null)
    setImportNote(
      result.assignments.length === 0
        ? 'No dated assignments were found in that document.'
        : fresh.length < result.assignments.length
          ? `${result.assignments.length - fresh.length} already in your planner were left out.`
          : (result.note ?? '')
    )
    setView('review')
  }

  const handleSaveImport = async () => {
    const rows = keep
      .map((i) => found[i])
      .map((a) => ({
        title: a.title,
        kind: a.kind,
        due_at: toDueAt(a.due_date, a.due_time),
        notes: a.notes || null,
        course_id: importCourse,
        source_document_id: sourceId,
      }))
    if (!rows.length) {
      reset()
      return
    }
    setBusy(true)
    const { error: createError } = await createAssignments({ userId: user.id, rows })
    setBusy(false)
    if (createError) {
      setError(createError.message)
      return
    }
    reset()
    onChanged?.()
  }

  const toggleDone = async (assignment) => {
    const { error: updateError } = await updateAssignment(assignment.id, {
      done_at: assignment.done_at ? null : new Date().toISOString(),
    })
    if (updateError) setError(updateError.message)
    else onChanged?.()
  }

  const handleDelete = async (id) => {
    const { error: deleteError } = await deleteAssignment(id)
    if (deleteError) setError(deleteError.message)
    else onChanged?.()
  }

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
        {view === 'list' && (
          <motion.div key="list" className="study-view" {...slide} initial={{ ...slide.initial, x: -20 }} exit={{ ...slide.exit, x: -20 }}>
            {loading ? (
              <div className="conv-loading">
                {[0, 1, 2].map((i) => (
                  <div className="skeleton conv-skel" key={i} />
                ))}
              </div>
            ) : openCount === 0 && groups.done.length === 0 ? (
              <p className="panel-empty">
                Nothing due. Add an assignment, or import the dates from your syllabus in one go.
              </p>
            ) : (
              GROUPS.filter((g) => groups[g.id].length > 0).map((group) => (
                <section key={group.id} className={`due-group is-${group.id}`}>
                  <h3 className="due-group-title">
                    {group.label}
                    <span className="due-group-count">{groups[group.id].length}</span>
                  </h3>
                  <ul className="due-list">
                    <AnimatePresence initial={false}>
                      {groups[group.id].map((a) => (
                        <motion.li
                          key={a.id}
                          layout
                          className={`due-item ${a.done_at ? 'is-done' : ''}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={spring.glide}
                        >
                          <button
                            type="button"
                            className={`due-check ${a.done_at ? 'is-on' : ''}`}
                            onClick={() => toggleDone(a)}
                            aria-label={a.done_at ? `Mark ${a.title} not done` : `Mark ${a.title} done`}
                            aria-pressed={Boolean(a.done_at)}
                          >
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
                              animate={{ scale: a.done_at ? 1 : 0.4, opacity: a.done_at ? 1 : 0 }}
                              transition={spring.pop}
                            >
                              <path d="M3 8.5l3.5 3.5L13 5" />
                            </motion.svg>
                          </button>
                          <div className="due-body">
                            <span className="due-title">{a.title}</span>
                            <span className="due-meta">
                              <span className={`due-when is-${group.id}`}>
                                {a.done_at ? 'Done' : describeDue(a.due_at)}
                              </span>
                              <span className="due-kind">{kindLabel(a.kind)}</span>
                              {!courseId && <CourseTag course={courseById.get(a.course_id)} />}
                            </span>
                            {a.notes && <span className="due-notes">{a.notes}</span>}
                          </div>
                          <button
                            type="button"
                            className="row-delete due-delete"
                            onClick={() => handleDelete(a.id)}
                            aria-label={`Delete ${a.title}`}
                          >
                            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                              <path d="M4 4l8 8M12 4l-8 8" />
                            </svg>
                          </button>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                </section>
              ))
            )}

            <div className="study-actions">
              <button type="button" className="btn btn-ghost panel-button" onClick={openAdd}>
                Add assignment
              </button>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  setError('')
                  setView('import')
                }}
              >
                Import from syllabus
              </button>
            </div>
          </motion.div>
        )}

        {view === 'add' && (
          <motion.form key="add" className="study-view study-form" onSubmit={handleAdd} {...slide}>
            <label className="form-row">
              <span className="form-label">What is it?</span>
              <input
                autoFocus
                className="form-input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Problem Set 4"
                maxLength={200}
                required
              />
            </label>
            <div className="form-grid">
              <label className="form-row">
                <span className="form-label">Due</span>
                <input
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </label>
              <label className="form-row">
                <span className="form-label">Time (optional)</span>
                <input
                  type="time"
                  className="form-input"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </label>
              <label className="form-row">
                <span className="form-label">Type</span>
                <select className="form-input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  {ASSIGNMENT_KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                <span className="form-label">Course</span>
                <select className="form-input" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>
                  <option value="">No course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="study-actions">
              <button type="submit" className="btn btn-primary study-go" disabled={busy || !form.title.trim()}>
                {busy ? 'Saving…' : 'Add'}
              </button>
              <button type="button" className="conv-cancel" onClick={reset}>
                Cancel
              </button>
            </div>
          </motion.form>
        )}

        {view === 'import' && (
          <motion.div key="import" className="study-view" {...slide}>
            <p className="conv-prompt">
              {readyDocs.length
                ? 'Which document is the syllabus or schedule? TATE AI will find every due date in it, and you choose which to keep.'
                : 'Upload your syllabus under “Your materials” first, then import its dates here.'}
            </p>
            <div className="pick-list" role="radiogroup" aria-label="Syllabus document">
              {readyDocs.map((doc) => (
                <label key={doc.id} className={`pick-row ${sourceId === doc.id ? 'is-on' : ''}`}>
                  <input
                    type="radio"
                    name="syllabus"
                    checked={sourceId === doc.id}
                    onChange={() => setSourceId(doc.id)}
                  />
                  <span className="pick-radio" aria-hidden="true" />
                  <span className="check-label">{doc.title}</span>
                </label>
              ))}
            </div>
            <div className="study-actions">
              <button
                type="button"
                className="btn btn-primary study-go"
                onClick={handleImport}
                disabled={!sourceId || busy}
              >
                {busy ? 'Reading the dates…' : 'Find due dates'}
              </button>
              <button type="button" className="conv-cancel" onClick={reset} disabled={busy}>
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {view === 'review' && (
          <motion.div key="review" className="study-view" {...slide}>
            <p className="conv-prompt">
              {found.length
                ? `Found ${found.length}. Untick anything that's wrong, then add the rest.`
                : 'Nothing new to add.'}
              {importNote && <span className="study-note"> {importNote}</span>}
            </p>
            <div className="pick-list">
              {found.map((a, i) => {
                const on = keep.includes(i)
                return (
                  <label key={`${a.title}-${a.due_date}`} className={`pick-row is-review ${on ? 'is-on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setKeep((prev) => (on ? prev.filter((x) => x !== i) : [...prev, i]))}
                    />
                    <span className="check-box" aria-hidden="true">
                      {on && (
                        <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 8.5l3.5 3.5L13 5" />
                        </svg>
                      )}
                    </span>
                    <span className="pick-text">
                      <span className="check-label">{a.title}</span>
                      <span className="due-meta">
                        <span className="due-when">{describeDue(toDueAt(a.due_date, a.due_time))}</span>
                        <span className="due-kind">{kindLabel(a.kind)}</span>
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
            <div className="study-actions">
              <button
                type="button"
                className="btn btn-primary study-go"
                onClick={handleSaveImport}
                disabled={busy}
              >
                {busy ? 'Saving…' : keep.length ? `Add ${keep.length}` : 'Done'}
              </button>
              <button type="button" className="conv-cancel" onClick={reset} disabled={busy}>
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AssignmentsPanel
