import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import DotBackground from '../components/DotBackground'
import MessageContent from '../components/MessageContent'
import { getGuide } from '../lib/study'
import { ease } from '../motion/tokens'
import { BackLink } from './StudyCards'
import './StudyPage.css'

/** A generated study guide, rendered for reading and printing. */
const StudyGuide = () => {
  const { id } = useParams()
  const [guide, setGuide] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getGuide(id).then((result) => {
      if (!active) return
      if (result.error) setError(result.error)
      else setGuide(result.guide)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [id])

  return (
    <div className="page study-page">
      <DotBackground variant="bare" />
      <div className="page-narrow">
        <div className="guide-bar">
          <BackLink />
          {guide && (
            <button type="button" className="btn btn-quiet" onClick={() => window.print()}>
              Print
            </button>
          )}
        </div>

        <header className="study-head">
          <span className="eyebrow">Study guide</span>
          <h1 className="study-title">{loading ? <span className="skeleton study-title-skel" /> : guide?.title}</h1>
        </header>

        {error && (
          <div className="note note-error" role="alert">
            {error}
          </div>
        )}

        {guide && (
          <motion.article
            className="guide panel rim"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: ease.out }}
          >
            <MessageContent text={guide.content} />
          </motion.article>
        )}
      </div>
    </div>
  )
}

export default StudyGuide
