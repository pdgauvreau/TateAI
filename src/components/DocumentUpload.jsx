import React, { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { uploadDocument, validateFile, formatBytes } from '../lib/documents'
import './DocumentUpload.css'

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
      <div
        className={`dropzone ${dragging ? 'dragging' : ''} ${busy ? 'busy' : ''}`}
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
        <input
          ref={inputRef}
          id="document-file"
          type="file"
          accept="application/pdf,.pdf"
          className="dropzone-input"
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <label htmlFor="document-file" className="dropzone-label">
          {busy ? (
            <span className="dropzone-busy">{progressLabel || 'Working…'}</span>
          ) : (
            <>
              <span className="dropzone-primary">Drop a PDF here, or click to choose</span>
              <span className="dropzone-secondary">Slides, assignments, practice exams · up to 25 MB</span>
            </>
          )}
        </label>
      </div>

      {error && <div className="upload-error">{error}</div>}
    </div>
  )
}

export default DocumentUpload
