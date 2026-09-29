/**
 * Per-user usage limits, metered in AI cost.
 *
 * Two rolling windows, 30 days and 24 hours, rather than calendar periods: they
 * avoid a midnight or first-of-the-month stampede, work the same in every
 * timezone, and let us say when allowance next frees up instead of naming a
 * reset time that means nothing to the student. The daily window caps how much
 * of the month one sitting can use.
 */

import { budgetForPlan } from '../../shared/plans.js'

const DAY_MS = 24 * 3600 * 1000
const MONTH_MS = 30 * DAY_MS

/**
 * Checks whether this user may start another reply.
 *
 * Runs on the caller's own token, so it sees only their rows under RLS. Returns
 * { allowed, budget, monthUsed, dayUsed, window, resetAt } with amounts in
 * micro-dollars; window names the limit that was hit ('day' or 'month').
 *
 * A reply's cost is only known once it finishes, so a user just under the limit
 * can go over by one reply. That overshoot is bounded by a single message.
 */
export const checkUsage = async (supabase, userId) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()

  const budget = budgetForPlan(profile?.plan ?? 'free')
  if (budget === null) {
    return { allowed: true, budget: null, monthUsed: 0, dayUsed: 0, window: null, resetAt: null }
  }

  const { data, error } = await supabase.rpc('usage_summary').single()

  // Fail open on a metering error rather than locking a paying user out of a
  // service that is otherwise working. The provider-side spend cap is the
  // backstop for the case where this is failing persistently.
  if (error) {
    return { allowed: true, budget, monthUsed: 0, dayUsed: 0, window: null, resetAt: null, degraded: true }
  }

  const monthUsed = Number(data.month_micros)
  const dayUsed = Number(data.day_micros)

  // The month is checked first: if both are exhausted, the day freeing up does
  // not help, so the month's reset is the honest answer.
  if (monthUsed >= budget.monthly) {
    return { allowed: false, budget, monthUsed, dayUsed, window: 'month', resetAt: freesAt(data.month_oldest, MONTH_MS) }
  }
  if (dayUsed >= budget.daily) {
    return { allowed: false, budget, monthUsed, dayUsed, window: 'day', resetAt: freesAt(data.day_oldest, DAY_MS) }
  }
  return { allowed: true, budget, monthUsed, dayUsed, window: null, resetAt: null }
}

// The oldest event still inside a window is the first to age out of it, which is
// when some allowance comes back.
const freesAt = (oldest, windowMs) =>
  oldest ? new Date(new Date(oldest).getTime() + windowMs).toISOString() : null

/**
 * Records one model call's usage. usage is the provider-neutral shape from
 * streamChat or transcribe; a missing usage (the request failed before the
 * provider billed anything) records a zero-cost event so the attempt is still
 * visible. kind is 'chat_message' for a reply, 'transcription' for reading an
 * uploaded photo or scan.
 */
export const recordUsage = (supabase, userId, usage, kind = 'chat_message') =>
  supabase.from('usage_events').insert({
    user_id: userId,
    kind,
    model: usage?.model ?? null,
    input_tokens: usage?.inputTokens ?? 0,
    output_tokens: usage?.outputTokens ?? 0,
    cache_read_tokens: usage?.cacheReadTokens ?? 0,
    cache_write_tokens: usage?.cacheWriteTokens ?? 0,
    cost_micros: usage?.costMicros ?? 0,
  })

export const describeReset = (resetAt) => {
  if (!resetAt) return 'shortly'
  const minutes = Math.max(1, Math.round((new Date(resetAt) - Date.now()) / 60000))
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `in about ${hours} hour${hours === 1 ? '' : 's'}`
  return `in about ${Math.round(hours / 24)} days`
}

/** The student-facing message for a refused turn. */
export const limitMessage = ({ window, resetAt }) =>
  window === 'month'
    ? `You've used this month's study allowance. More frees up ${describeReset(resetAt)}, or you can upgrade your plan for a larger one.`
    : `You've used today's share of your allowance, so the rest of your month isn't used up in one sitting. More frees up ${describeReset(resetAt)}.`
