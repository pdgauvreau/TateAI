import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { PLAN_PRICE_KEYS } from '../../shared/plans.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

// Tags Checkout Sessions from this flow so they can be told apart in the Stripe
// Dashboard. Stripe asks for a fixed label with an 8-letter random suffix.
export const INTEGRATION_IDENTIFIER = 'tateai_subscription_checkout_qkvbwmrt'

// Plans that hold paid access. past_due keeps access while Stripe retries the
// card, so a single failed renewal does not instantly strip a paying student.
const ACCESS_STATUSES = new Set(['active', 'trialing', 'past_due'])

export class BillingConfigError extends Error {}

let stripeClient
export const stripe = () => {
  if (!STRIPE_SECRET_KEY) throw new BillingConfigError('STRIPE_SECRET_KEY is not set.')
  stripeClient ??= new Stripe(STRIPE_SECRET_KEY)
  return stripeClient
}

/** True while running on sandbox keys, where any test card succeeds. */
export const isTestMode = () => /^(sk|rk)_test_/.test(STRIPE_SECRET_KEY ?? '')

/**
 * In test mode, checkout is limited to an allowlist.
 *
 * Production currently runs on sandbox keys, and in a sandbox the public test
 * card 4242 4242 4242 4242 always succeeds. Without this, anyone could "buy" Pro
 * for free and the webhook would grant it for real, reopening the spend exposure
 * the usage limits exist to close. Once live keys are set, this lifts itself.
 */
export const checkoutAllowed = (email) => {
  if (!isTestMode()) return true
  const allowlist = (process.env.BILLING_TEST_ALLOWLIST ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return Boolean(email) && allowlist.includes(email.toLowerCase())
}

/** Client acting as the caller, so reads stay under row-level security. */
export const userClient = (authHeader) =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

/**
 * Service-role client. Bypasses RLS, so it is used for exactly two writes: saving
 * a user's Stripe customer ID, and applying subscription state from the webhook.
 * Users are deliberately unable to write either (see migration 0004).
 */
export const adminClient = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new BillingConfigError('SUPABASE_SERVICE_ROLE_KEY is not set.')
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Resolves the signed-in user from a bearer token, or null. */
export const authenticate = async (request) => {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return { authHeader: null, user: null }
  const {
    data: { user },
  } = await userClient(authHeader).auth.getUser()
  return { authHeader, user: user ?? null }
}

const planForLookupKey = (lookupKey) =>
  Object.entries(PLAN_PRICE_KEYS).find(([, key]) => key === lookupKey)?.[0] ?? null

/**
 * Derives what a profile should say from a customer's subscriptions.
 *
 * Takes Stripe's current state rather than trusting any one event's payload, so
 * the result is the same no matter how many times, or in what order, events
 * arrive.
 */
export const deriveBillingState = (subscriptions) => {
  // Prefer a subscription that grants access; otherwise the most recent one.
  const ordered = [...subscriptions].sort((a, b) => b.created - a.created)
  const current = ordered.find((s) => ACCESS_STATUSES.has(s.status)) ?? ordered[0]

  if (!current) {
    return { plan: 'free', stripe_subscription_id: null, subscription_status: null, current_period_end: null }
  }

  const item = current.items?.data?.[0]
  const paidPlan = planForLookupKey(item?.price?.lookup_key)
  // On this API version the billing period lives on the subscription item; the
  // subscription-level field no longer exists.
  const periodEnd = item?.current_period_end

  return {
    plan: ACCESS_STATUSES.has(current.status) && paidPlan ? paidPlan : 'free',
    stripe_subscription_id: current.id,
    subscription_status: current.status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  }
}

/**
 * Re-reads a customer's subscriptions from Stripe and writes the result to their
 * profile. Returns the applied state, or null if no profile owns that customer.
 */
export const syncCustomer = async (customerId) => {
  const subscriptions = await stripe().subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  })

  const state = deriveBillingState(subscriptions.data)

  const { data, error } = await adminClient()
    .from('profiles')
    .update(state)
    .eq('stripe_customer_id', customerId)
    .select('id')

  if (error) throw new Error(`Could not update profile: ${error.message}`)
  return data?.length ? state : null
}

export const json = (body, status = 200) => Response.json(body, { status })
