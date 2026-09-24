import {
  INTEGRATION_IDENTIFIER,
  BillingConfigError,
  adminClient,
  authenticate,
  checkoutAllowed,
  json,
  stripe,
} from '../_lib/billing.js'
import { PLAN_PRICE_KEYS } from '../../shared/plans.js'

// Statuses that mean the user already pays; they belong in the portal, not a
// second checkout that would leave them with two subscriptions.
const SUBSCRIBED = new Set(['active', 'trialing', 'past_due'])

export async function POST(request) {
  try {
    const { user } = await authenticate(request)
    if (!user) return json({ error: 'Sign in to choose a plan.' }, 401)

    const { plan } = await request.json().catch(() => ({}))
    const lookupKey = PLAN_PRICE_KEYS[plan]
    if (!lookupKey) return json({ error: 'Unknown plan.' }, 400)

    if (!checkoutAllowed(user.email)) {
      return json(
        { error: "Billing isn't open yet. TATE AI is free during early access — we'll let you know when plans go on sale." },
        403
      )
    }

    const admin = adminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('stripe_customer_id, subscription_status')
      .eq('id', user.id)
      .single()
    if (profileError) return json({ error: 'Could not load your account.' }, 500)

    if (SUBSCRIBED.has(profile.subscription_status)) {
      return json(
        { error: 'You already have a subscription. Use "Manage billing" to change plans.', manage: true },
        409
      )
    }

    let customerId = profile.stripe_customer_id
    if (!customerId) {
      // Keyed on the user, so a double-click or retry reuses one customer instead
      // of creating two.
      const customer = await stripe().customers.create(
        { email: user.email, metadata: { supabase_user_id: user.id } },
        { idempotencyKey: `tateai-customer-${user.id}` }
      )

      // Only claim the slot if it is still empty. If a concurrent request got
      // there first, use whatever it stored rather than overwriting it.
      const { data: claimed } = await admin
        .from('profiles')
        .update({ stripe_customer_id: customer.id })
        .eq('id', user.id)
        .is('stripe_customer_id', null)
        .select('stripe_customer_id')

      if (claimed?.length) {
        customerId = claimed[0].stripe_customer_id
      } else {
        const { data: current } = await admin
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', user.id)
          .single()
        customerId = current?.stripe_customer_id ?? customer.id
      }
    }

    const { data: prices } = await stripe().prices.list({ lookup_keys: [lookupKey], active: true })
    if (!prices.length) return json({ error: 'That plan is not available right now.' }, 500)

    // Expire any checkout this customer left open. An abandoned session keeps a
    // working payment link for 24 hours, so two tabs, or a stale link from an
    // earlier attempt, could each be paid and leave the student with two
    // subscriptions billing every month. Only the newest session stays payable.
    const open = await stripe().checkout.sessions.list({ customer: customerId, status: 'open', limit: 10 })
    await Promise.all(open.data.map((s) => stripe().checkout.sessions.expire(s.id).catch(() => null)))

    const origin = new URL(request.url).origin
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: prices[0].id, quantity: 1 }],
      // payment_method_types is deliberately omitted so Stripe offers whichever
      // methods are enabled in the Dashboard.
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      client_reference_id: user.id,
      integration_identifier: INTEGRATION_IDENTIFIER,
    })

    return json({ url: session.url })
  } catch (error) {
    if (error instanceof BillingConfigError) return json({ error: error.message }, 500)
    return json({ error: error?.message ?? 'Could not start checkout.' }, 500)
  }
}
