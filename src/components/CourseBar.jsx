import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { createCourse, deleteCourse, nextColor, updateCourse, COURSE_COLORS } from '../lib/courses'
import { ease, spring } from '../motion/tokens'
import './Study.css'

/**
 * The course filter across the top of the dashboard.
 *
 * "All" plus one chip per course. Picking a course filters every panel below
 * and files anything new made there under it. The selected course can be
 * renamed, recoloured, or deleted from the small editor that opens under it;
 * deleting unfiles its contents rather than deleting them.
 */
const CourseBar = ({ courses, selectedId, onSelect, onChanged }) => {
  const { user } = useAuth()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selected = courses.find((c) => c.id === selectedId) ?? null

  const handleAdd = async (event) => {
    event.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError('')
    const { data, error: createError } = await createCourse({
      userId: user.id,
      name,
      color: nextColor(courses),
    })
    setBusy(false)
    if (createError) {
      setError(createError.message)
      return
    }
    setName('')
    setAdding(false)
    await onChanged?.()
    onSelect(data.id)
  }

  const handleUpdate = async (fields) => {
    setError('')
    const { error: updateError } = await updateCourse(selected.id, fields)
    if (updateError) setError(updateError.message)
    else onChanged?.()
  }

  const handleDelete = async () => {
    setError('')
    const { error: deleteError } = await deleteCourse(selected.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setEditing(false)
    onSelect(null)
    onChanged?.()
  }

  return (
    <div className="course-bar-wrap">
      <div className="course-bar" role="tablist" aria-label="Courses">
        <button
          type="button"
          role="tab"
          aria-selected={!selectedId}
          className={`course-chip ${!selectedId ? 'is-on' : ''}`}
          onClick={() => {
            onSelect(null)
            setEditing(false)
          }}
        >
          All courses
        </button>

        {courses.map((course) => (
          <button
            key={course.id}
            type="button"
            role="tab"
            aria-selected={selectedId === course.id}
            className={`course-chip ${selectedId === course.id ? 'is-on' : ''}`}
            data-color={course.color}
            onClick={() => {
              if (selectedId === course.id) setEditing((v) => !v)
              else {
                onSelect(course.id)
                setEditing(false)
              }
            }}
            title={selectedId === course.id ? 'Click again to edit this course' : undefined}
          >
            <span className="course-dot" aria-hidden="true" />
            {course.name}
          </button>
        ))}

        <AnimatePresence mode="wait" initial={false}>
          {adding ? (
            <motion.form
              key="form"
              className="course-add-form"
              onSubmit={handleAdd}
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.25, ease: ease.out }}
            >
              <input
                autoFocus
                className="form-input course-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Course name, e.g. BIO 101"
                maxLength={80}
                aria-label="New course name"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setAdding(false)
                    setName('')
                  }
                }}
              />
              <button type="submit" className="course-chip is-add" disabled={busy || !name.trim()}>
                {busy ? 'Adding…' : 'Add'}
              </button>
              <button
                type="button"
                className="course-chip is-plain"
                onClick={() => {
                  setAdding(false)
                  setName('')
                }}
              >
                Cancel
              </button>
            </motion.form>
          ) : (
            <motion.button
              key="add"
              type="button"
              className="course-chip is-add"
              onClick={() => setAdding(true)}
              whileTap={{ scale: 0.95 }}
              transition={spring.snap}
            >
              + Add course
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {editing && selected && (
          <motion.div
            className="course-editor"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: ease.out }}
          >
            <input
              className="form-input course-input"
              defaultValue={selected.name}
              key={selected.id}
              maxLength={80}
              aria-label="Course name"
              onBlur={(e) => {
                const next = e.target.value.trim()
                if (next && next !== selected.name) handleUpdate({ name: next })
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
            />
            <div className="course-swatches" role="radiogroup" aria-label="Course colour">
              {COURSE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={selected.color === color}
                  aria-label={color}
                  className={`course-swatch ${selected.color === color ? 'is-on' : ''}`}
                  data-color={color}
                  onClick={() => handleUpdate({ color })}
                />
              ))}
            </div>
            <button type="button" className="course-delete" onClick={handleDelete}>
              Delete course
            </button>
            <span className="course-editor-note">
              Deleting keeps its materials, conversations, and study sets; they move to “All courses”.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="note note-error course-error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}

export default CourseBar
