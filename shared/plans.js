/**
 * Plan limits, shared by the API (which enforces them) and the dashboard (which
 * displays them). Kept in one file so the number a student is shown can never
 * drift from the number actually enforced.
 *
 * Must stay free of Node- and browser-specific APIs — it is bundled into both.
 */

// null means unlimited.
export const PLAN_LIMITS = {
  free: 25,
  student: 250,
  pro: 1000,
  institution: null,
}

export const WINDOW_HOURS = 24

export const limitForPlan = (plan) =>
  Object.prototype.hasOwnProperty.call(PLAN_LIMITS, plan) ? PLAN_LIMITS[plan] : PLAN_LIMITS.free

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
  student: { label: 'Student', price: 18 },
  pro: { label: 'Pro', price: 26 },
  institution: { label: 'Institution', price: null },
}
