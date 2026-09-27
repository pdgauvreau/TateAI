/**
 * Plan limits, shared by the API (which enforces them) and the dashboard (which
 * displays them). Kept in one file so the number a student is shown can never
 * drift from the number actually enforced.
 *
 * Must stay free of Node- and browser-specific APIs — it is bundled into both.
 */

/**
 * Usage is metered in AI cost, not messages: a message costs several times more
 * with a long document attached or a cold prompt cache, so a message count
 * cannot bound spend. Amounts are micro-dollars (1e-6 USD).
 *
 * A paid plan's monthly allowance is AI_COST_SHARE of its price after setting
 * aside the most sales tax any US state charges, since prices are tax-inclusive.
 * The free allowance is a fixed cost we accept for letting people try it.
 */
export const AI_COST_SHARE = 0.5
const TAX_HEADROOM = 1.1
const FREE_MONTHLY_MICROS = 250_000

/** A day may use at most this share of the monthly allowance. */
export const DAILY_SHARE = 0.25

export const MONTH_DAYS = 30

const monthlyMicros = (plan) => {
  if (plan === 'institution') return null
  if (plan === 'free') return FREE_MONTHLY_MICROS
  return Math.floor((PLAN_DISPLAY[plan].price * 1_000_000 * AI_COST_SHARE) / TAX_HEADROOM)
}

/** { monthly, daily } in micro-dollars, or null for an unmetered plan. */
export const budgetForPlan = (plan) => {
  const known = Object.prototype.hasOwnProperty.call(PLAN_DISPLAY, plan) ? plan : 'free'
  const monthly = monthlyMicros(known)
  return monthly === null ? null : { monthly, daily: Math.floor(monthly * DAILY_SHARE) }
}

/** How many times larger one plan's allowance is than another's, for pricing copy. */
export const allowanceRatio = (plan, relativeTo) =>
  budgetForPlan(plan).monthly / budgetForPlan(relativeTo).monthly

/**
 * Stripe price lookup keys, not price IDs.
 *
 * Lookup keys are stable names we control, so the sandbox and live prices can
 * carry the same key and no price ID ever has to be hardcoded or swapped when
 * going live. Checkout resolves the key to a price at request time.
 */
export const PLAN_PRICE_KEYS = {
  student: 'tateai_student_monthly',
  pro: 'tateai_pro_monthly',
}

/** Display prices, kept beside the limits so the pricing page cannot drift. */
export const PLAN_DISPLAY = {
  free: { label: 'Free', price: null },
  student: { label: 'Student', price: 21 },
  pro: { label: 'Pro', price: 29 },
  institution: { label: 'Institution', price: null },
}
