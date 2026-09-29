import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import DotBackground from '../components/DotBackground'
import MessageContent from '../components/MessageContent'
import { deleteCard, getDeck, reviewCard } from '../lib/study'
import { describeNext, RATINGS } from '../lib/srs'
import { ease, spring } from '../motion/tokens'
import './StudyPage.css'

const byDue = (a, b) => new Date(a.due_at) - new Date(b.due_at)

export const BackLink = () => (
  <Link to="/dashboard" className="study-back">
    <span className="study-back-arrow" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 8H4M7.5 4l-4 4 4 4" />
      </svg>
    </span>
    Dashboard
  </Link>
)

const describeWhen = (iso) => {
  const ms = new Date(iso) - Date.now()
  if (ms <= 0) return 'now'
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.round(hours / 24)
  return days === 1 ? 'tomorrow' : `in ${days} days`
}

/**
 * Reviewing a deck.
 *
 * The session is the cards due now, soonest first. Each is shown front first;
 * the student recalls the answer, reveals it, and says how well they knew it,
 * which sets when the card comes back. "Again" puts it back at the end of this
 * session as well, so a forgotten card is seen once more before they stop.
 *
 * Keyboard: Space or Enter reveals, 1-4 rates.
 */
const StudyCards = () => {
  const { id } = useParams()
  const [deck, setDeck] = useState(null)
  const [cards, setCards] = useState([])
  const [queue, setQueue] = useState([])
  const [flipped, setFlipped] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let active = true
    getDeck(id).then((result) => {
      if (!active) return
      if (result.error) setError(result.error)
      else {
        setDeck(result.deck)
        setCards(result.cards)
        const now = Date.now()
        setQueue(result.cards.filter((c) => new Date(c.due_at) <= now).sort(byDue).map((c) => c.id))
      }
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [id])

  const current = useMemo(() => cards.find((c) => c.id === queue[0]) ?? null, [cards, queue])

  const rate = useCallback(
    async (rating) => {
      if (!current || !flipped) return
      const result = await reviewCard(current, rating)
      if (result.error) {
        setError(result.error)
        return
      }
      setCards((prev) => prev.map((c) => (c.id === current.id ? result.card : c)))
      setQueue((prev) => (rating === 'again' ? [...prev.slice(1), prev[0]] : prev.slice(1)))
      setReviewed((n) => n + 1)
      setFlipped(false)
    },
    [current, flipped]
  )

  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest('input, textarea, select')) return
      if (!current) return
      if (!flipped && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault()
        setFlipped(true)
      } else if (flipped && ['1', '2', '3', '4'].includes(event.key)) {
        rate(RATINGS[Number(event.key) - 1].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, flipped, rate])

  const reviewAll = () => {
    setQueue([...cards].sort(byDue).map((c) => c.id))
    setFlipped(false)
  }

  const handleDelete = async (cardId) => {
    const { error: deleteError } = await deleteCard(cardId)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setCards((prev) => prev.filter((c) => c.id !== cardId))
    setQueue((prev) => prev.filter((x) => x !== cardId))
  }

  const nextDue = cards.length ? [...cards].sort(byDue)[0].due_at : null

  return (
    <div className="page study-page">
      <DotBackground variant="bare" />
      <div className="page-narrow">
        <BackLink />

        <header className="study-head">
          <span className="eyebrow">Flashcards</span>
          <h1 className="study-title">{loading ? <span className="skeleton study-title-skel" /> : deck?.title}</h1>
          {!loading && deck && (
            <p className="study-sub">
              {current
                ? `${queue.length} to review${reviewed ? ` · ${reviewed} done` : ''}`
                : `${cards.length} cards`}
            </p>
          )}
        </header>

        {error && (
          <div className="note note-error" role="alert">
            {error}
          </div>
        )}

        {!loading && deck && (
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div
                key={`${current.id}-${reviewed}`}
                className="flashcard-wrap"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.98 }}
                transition={{ duration: 0.28, ease: ease.out }}
              >
                <button
                  type="button"
                  className={`flashcard panel rim ${flipped ? 'is-flipped' : ''}`}
                  onClick={() => setFlipped(true)}
                  aria-label={flipped ? 'Answer shown' : 'Show the answer'}
                >
                  <span className="flashcard-side">Question</span>
                  <div className="flashcard-front">
                    <MessageContent text={current.front} />
                  </div>
                  <AnimatePresence>
                    {flipped && (
                      <motion.div
                        className="flashcard-back"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ duration: 0.3, ease: ease.out }}
                      >
                        <span className="flashcard-side">Answer</span>
                        <MessageContent text={current.back} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {!flipped && <span className="flashcard-hint">Recall it, then tap to check · Space</span>}
                </button>

                <AnimatePresence>
                  {flipped && (
                    <motion.div
                      className="ratings"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: ease.out }}
                    >
                      {RATINGS.map((r, i) => (
                        <motion.button
                          key={r.id}
                          type="button"
                          className={`rating is-${r.id}`}
                          onClick={() => rate(r.id)}
                          whileTap={{ scale: 0.95 }}
                          transition={spring.snap}
                        >
                          <span className="rating-label">
                            {r.label}
                            <kbd>{i + 1}</kbd>
                          </span>
                          <span className="rating-next">{describeNext(current, r.id)}</span>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="done"
                className="study-done panel rim"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: ease.out }}
              >
                <p className="study-done-title">{reviewed ? 'Session done' : 'All caught up'}</p>
                <p className="study-done-body">
                  {reviewed ? `You reviewed ${reviewed} card${reviewed === 1 ? '' : 's'}. ` : ''}
                  {nextDue ? `The next card is due ${describeWhen(nextDue)}.` : ''} Spacing reviews out
                  like this is what moves them into long-term memory.
                </p>
                {cards.length > 0 && (
                  <button type="button" className="btn btn-quiet" onClick={reviewAll}>
                    Review all {cards.length} anyway
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {!loading && cards.length > 0 && (
          <section className="card-index">
            <button type="button" className="card-index-toggle" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Hide' : 'Show'} all {cards.length} cards
            </button>
            <AnimatePresence>
              {showAll && (
                <motion.ul
                  className="card-index-list"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {cards.map((card) => (
                    <li key={card.id} className="card-index-item">
                      <div className="card-index-text">
                        <MessageContent text={card.front} />
                        <div className="card-index-back">
                          <MessageContent text={card.back} />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="card-delete"
                        onClick={() => handleDelete(card.id)}
                        aria-label="Delete this card"
                      >
                        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </section>
        )}
      </div>
    </div>
  )
}

export default StudyCards
