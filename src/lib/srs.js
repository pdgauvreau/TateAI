/**
 * Flashcard scheduling: a small variant of SM-2, the algorithm behind most
 * spaced-repetition apps.
 *
 * Each card carries an interval (days until it is next due) and an ease (how
 * fast that interval grows). Remembering a card multiplies its interval by its
 * ease; forgetting it resets the interval and makes the card a little harder,
 * so it comes back sooner from then on.
 */

const DAY_MS = 24 * 3600 * 1000
const MIN_EASE = 1.3
const MAX_EASE = 5

// A forgotten card comes back within the same sitting.
const RELEARN_MS = 10 * 60 * 1000

export const RATINGS = [
  { id: 'again', label: 'Again', hint: 'Forgot it' },
  { id: 'hard', label: 'Hard', hint: 'Got it, barely' },
  { id: 'good', label: 'Good', hint: 'Got it' },
  { id: 'easy', label: 'Easy', hint: 'Knew it instantly' },
]

const clampEase = (ease) => Math.min(MAX_EASE, Math.max(MIN_EASE, ease))

/**
 * The card's next scheduling state after a review.
 *
 * card: { interval_days, ease, reps, lapses }; rating: 'again' | 'hard' |
 * 'good' | 'easy'. Returns the fields to write back, including due_at.
 */
export const schedule = (card, rating, now = new Date()) => {
  const interval = card.interval_days ?? 0
  const ease = card.ease ?? 2.5
  const reps = card.reps ?? 0
  const lapses = card.lapses ?? 0
  const at = now.getTime()

  if (rating === 'again') {
    return {
      interval_days: 0,
      ease: clampEase(ease - 0.2),
      reps: 0,
      lapses: lapses + 1,
      due_at: new Date(at + RELEARN_MS).toISOString(),
      last_reviewed_at: now.toISOString(),
    }
  }

  let nextInterval
  let nextEase = ease

  if (rating === 'hard') {
    nextInterval = reps === 0 ? 1 : Math.max(1, interval * 1.2)
    nextEase = ease - 0.15
  } else if (rating === 'good') {
    nextInterval = reps === 0 ? 1 : reps === 1 ? 3 : interval * ease
  } else if (rating === 'easy') {
    nextInterval = reps === 0 ? 3 : Math.max(4, interval * ease * 1.3)
    nextEase = ease + 0.15
  } else {
    throw new Error(`Unknown rating: ${rating}`)
  }

  // Whole days, and never longer than a year: a card set for a course should
  // not disappear past the end of it.
  nextInterval = Math.min(365, Math.round(nextInterval))

  return {
    interval_days: nextInterval,
    ease: clampEase(nextEase),
    reps: reps + 1,
    lapses,
    due_at: new Date(at + nextInterval * DAY_MS).toISOString(),
    last_reviewed_at: now.toISOString(),
  }
}

/** "in 10 minutes", "tomorrow", "in 3 days": when a rating would bring the card back. */
export const describeNext = (card, rating, now = new Date()) => {
  const ms = new Date(schedule(card, rating, now).due_at) - now
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes} min`
  const days = Math.round(ms / DAY_MS)
  if (days <= 1) return '1 day'
  if (days < 31) return `${days} days`
  const months = Math.round(days / 30)
  return months < 12 ? `${months} mo` : '1 yr'
}
