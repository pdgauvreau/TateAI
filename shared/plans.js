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
