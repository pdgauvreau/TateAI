/**
 * Per-user usage limits.
 *
 * A rolling 24-hour window rather than a calendar day: it avoids a midnight
 * stampede, works the same in every timezone, and lets us tell someone exactly
 * when their next message frees up instead of naming a reset hour that means
 * nothing to them.
 */

export { PLAN_LIMITS, WINDOW_HOURS, limitForPlan } from '../../shared/plans.js'
import { limitForPlan, WINDOW_HOURS } from '../../shared/plans.js'

/**
 * Checks whether this user may send another message.
 *
 * Runs on the caller's own token, so it counts only their rows under RLS. Returns
 * { allowed, limit, used, remaining, resetAt }.
 */
export const checkUsage = async (supabase, userId) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()

  const limit = limitForPlan(profile?.plan ?? 'free')
  if (limit === null) {
    return { allowed: true, limit: null, used: 0, remaining: null, resetAt: null }
  }

  const windowStart = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000).toISOString()

  const { count, error } = await supabase
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', windowStart)

  // Fail open on a counting error rather than locking a paying user out of a
  // service that is otherwise working. The provider-side spend cap is the
  // backstop for the case where this is failing persistently.
  if (error) {
    return { allowed: true, limit, used: 0, remaining: limit, resetAt: null, degraded: true }
  }

  const used = count ?? 0
  if (used < limit) {
    return { allowed: true, limit, used, remaining: limit - used, resetAt: null }
  }

  // At the limit: the oldest event still inside the window is the one whose
  // expiry frees the next slot.
  const { data: oldest } = await supabase
    .from('usage_events')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const resetAt = oldest
    ? new Date(new Date(oldest.created_at).getTime() + WINDOW_HOURS * 3600 * 1000).toISOString()
    : null

  return { allowed: false, limit, used, remaining: 0, resetAt }
}

export const recordUsage = (supabase, userId) =>
  supabase.from('usage_events').insert({ user_id: userId, kind: 'chat_message' })

export const describeReset = (resetAt) => {
  if (!resetAt) return 'shortly'
  const minutes = Math.max(1, Math.round((new Date(resetAt) - Date.now()) / 60000))
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.round(minutes / 60)
  return `in about ${hours} hour${hours === 1 ? '' : 's'}`
}
