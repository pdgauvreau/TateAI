import React, { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { uploadDocument, validateFile, formatBytes } from '../lib/documents'
import { ease, spring } from '../motion/tokens'
import './DocumentUpload.css'

/**
 * The PDF drop zone.
 *
 * Three states, each with its own motion, because a drop target that does not
 * visibly react is a drop target people do not trust:
 *
 * - **idle** — the icon breathes very slightly, enough to read as live.
 * - **dragging** — the zone lifts, the border goes brand-coloured, and a ring
 *   pulses outward from the centre. The reaction is on `dragover`, so it appears
 *   before the file is released.
 * - **busy** — a shimmer runs along the bottom edge. Deliberately not a progress
 *   bar: the upload reports no progress, and a bar that invents one is a lie.
 */
const DocumentUpload = ({ onUploaded }) => {
  const { user } = useAuth()
  const inputRef = useRef(null)

  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progressLabel, setProgressLabel] = useState('')
  const [error, setError] = useState('')

  const handleFiles = async (fileList) => {
    setError('')
    const file = fileList?.[0]
    if (!file) return

    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setBusy(true)
    setProgressLabel(`Uploading ${file.name} (${formatBytes(file.size)})…`)

    const result = await uploadDocument({ file, userId: user.id })

    if (result.error) {
      setError(result.error)
    } else {
      setProgressLabel('')
    }

    setBusy(false)
    // Refresh the list either way — a failed row should still appear, with its reason.
    onUploaded?.()

    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="upload">
      <motion.div
        className={`drop ${dragging ? 'is-dragging' : ''} ${busy ? 'is-busy' : ''}`}
        animate={{
          scale: dragging ? 1.015 : 1,
          y: dragging ? -2 : 0,
        }}
        transition={spring.snap}
        onDragOver={(e) => {
          e.preventDefault()
          if (!busy) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!busy) handleFiles(e.dataTransfer.files)
        }}
      >
        {/* Pulsing ring while a file is over the zone. */}
        <AnimatePresence>
          {dragging && (
            <motion.span
              className="drop-pulse"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: [0.8, 1.15], opacity: [0.6, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        <input
          ref={inputRef}
          id="document-file"
          type="file"
          accept="application/pdf,.pdf"
          className="drop-input"
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files)}
        />

        <label htmlFor="document-file" className="drop-label">
          <AnimatePresence mode="wait" initial={false}>
            {busy ? (
              <motion.span
                key="busy"
                className="drop-state"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: ease.out }}
              >
                <span className="drop-icon is-busy">
                  <span className="auth-spinner" aria-hidden="true" />
                </span>
                <span className="drop-primary">{progressLabel || 'Working…'}</span>
                <span className="drop-secondary">
                  Extracting the text — this takes a moment on a big deck
                </span>
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                className="drop-state"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: ease.out }}
              >
                <motion.span
                  className="drop-icon"
                  animate={
                    dragging
                      ? { y: -4, scale: 1.12, rotate: 0 }
                      : { y: [0, -3, 0], scale: 1 }
                  }
                  transition={
                    dragging
                      ? spring.pop
                      : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }
                  }
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 15.5V4" />
                    <path d="M7.5 8.5 12 4l4.5 4.5" />
                    <path d="M4 14.5v3A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5v-3" />
                  </svg>
                </motion.span>
                <span className="drop-primary">
                  {dragging ? 'Drop it' : 'Drop a PDF here, or click to choose'}
                </span>
                <span className="drop-secondary">
                  Slides, assignments, practice exams · up to 25 MB
                </span>
              </motion.span>
            )}
          </AnimatePresence>
        </label>

        {busy && <span className="drop-shimmer" aria-hidden="true" />}
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            className="note note-error upload-note"
            role="alert"
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 10, x: [0, -6, 5, -3, 0] }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{
              height: { duration: 0.28, ease: ease.out },
              x: { duration: 0.4, delay: 0.08 },
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default DocumentUpload
