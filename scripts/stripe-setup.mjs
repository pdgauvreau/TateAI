/**
 * Creates everything TATE AI's billing expects in a Stripe account: one Product
 * per plan, tax-inclusive monthly Prices carrying the lookup keys the code
 * resolves (shared/plans.js), the customer portal configuration, and the webhook
 * endpoint.
 *
 * Safe to re-run: anything that already exists (matched by lookup key or webhook
 * URL) is left alone. If a plan's price in shared/plans.js no longer matches
 * Stripe, a new Price replaces it and the old one is archived. Works for test or
 * live mode, depending on the key.
 *
 *   node --env-file=.env.stripe-live scripts/stripe-setup.mjs
 *
 * The env file needs STRIPE_SECRET_KEY. Never commit it; .gitignore covers .env*.
 * A newly created webhook's signing secret is written to .env.stripe-webhook
 * rather than printed, since Stripe shows it only once.
 */

import Stripe from 'stripe'
import { writeFileSync } from 'node:fs'
import { PLAN_PRICE_KEYS, PLAN_DISPLAY } from '../shared/plans.js'

const SITE = 'https://tateai.app'
const WEBHOOK_URL = `${SITE}/api/billing/webhook`
// Artificial Intelligence as a Service - cloud based - personal use. Required by
// Managed Payments, and the right classification for Stripe Tax either way.
const TAX_CODE = 'txcd_10105001'

const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.paid',
  'invoice.payment_failed',
]

const DESCRIPTIONS = {
  student: 'Study with TATE AI on your own course materials, with a larger daily allowance.',
  pro: "TATE AI's highest allowance, for heavy study periods.",
}

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('STRIPE_SECRET_KEY is not set. Pass it with --env-file.')
  process.exit(1)
}
const stripe = new Stripe(key)
const mode = /_live_/.test(key) ? 'LIVE' : 'test'
console.log(`Setting up Stripe in ${mode} mode.`)

// Products and prices.
const priceIds = {}
let pricesChanged = false
for (const [plan, lookupKey] of Object.entries(PLAN_PRICE_KEYS)) {
  const { label, price } = PLAN_DISPLAY[plan]
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })

  if (existing.data.length) {
    const current = existing.data[0]
    if (current.unit_amount === price * 100) {
      priceIds[plan] = { price: current.id, product: current.product }
      console.log(`  ${label}: $${price}/month (${lookupKey}) already exists, skipped`)
      continue
    }

    // Prices are immutable, so a new amount is a new Price on the same Product.
    // transfer_lookup_key moves the key over, so checkout picks up the new price
    // with no code change. Existing subscribers stay on the old price until they
    // are moved deliberately.
    const replacement = await stripe.prices.create(
      {
        product: current.product,
        currency: 'usd',
        unit_amount: price * 100,
        recurring: { interval: 'month' },
        tax_behavior: 'inclusive',
        lookup_key: lookupKey,
        transfer_lookup_key: true,
        nickname: `TATE AI ${label} monthly`,
      },
      { idempotencyKey: `tateai-setup-price-${plan}-${price}` }
    )
    await stripe.prices.update(current.id, { active: false })
    priceIds[plan] = { price: replacement.id, product: current.product }
    pricesChanged = true
    console.log(`  ${label}: $${current.unit_amount / 100} -> $${price}/month (${lookupKey}); old price archived`)
    continue
  }

  const product = await stripe.products.create(
    {
      name: `TATE AI ${label}`,
      description: DESCRIPTIONS[plan],
      tax_code: TAX_CODE,
      metadata: { plan },
    },
    { idempotencyKey: `tateai-setup-product-${plan}` }
  )
  const created = await stripe.prices.create(
    {
      product: product.id,
      currency: 'usd',
      unit_amount: price * 100,
      recurring: { interval: 'month' },
      // The advertised price is what the student pays; tax comes out of it.
      tax_behavior: 'inclusive',
      lookup_key: lookupKey,
      nickname: `TATE AI ${label} monthly`,
    },
    { idempotencyKey: `tateai-setup-price-${plan}-${price}` }
  )
  priceIds[plan] = { price: created.id, product: product.id }
  console.log(`  ${label}: created $${price}/month (${lookupKey})`)
}

// One account is one seat, so a customer must not be able to buy more.
const portalProducts = Object.values(priceIds).map(({ product, price }) => ({
  product,
  prices: [price],
  adjustable_quantity: { enabled: false },
}))

// Customer portal. Created only when the account has no default yet, so settings
// adjusted in the Dashboard are never overwritten. When a price changed, only the
// plan-switching list is updated to offer the new prices.
const portals = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 })
if (portals.data.length && pricesChanged) {
  await stripe.billingPortal.configurations.update(portals.data[0].id, {
    features: { subscription_update: { products: portalProducts } },
  })
  console.log('  Customer portal: plan switching updated to the new prices')
} else if (portals.data.length) {
  console.log('  Customer portal: default configuration exists, skipped')
} else {
  await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: 'Manage your TATE AI plan',
      privacy_policy_url: `${SITE}/privacy`,
      terms_of_service_url: `${SITE}/terms`,
    },
    default_return_url: `${SITE}/dashboard`,
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ['email'] },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        cancellation_reason: {
          enabled: true,
          options: ['too_expensive', 'unused', 'low_quality', 'missing_features', 'other'],
        },
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
        products: portalProducts,
        // Downgrades wait for renewal; upgrades apply immediately.
        schedule_at_period_end: { conditions: [{ type: 'decreasing_item_amount' }] },
      },
    },
  })
  console.log('  Customer portal: created')
}

// Webhook endpoint.
const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
if (endpoints.data.some((e) => e.url === WEBHOOK_URL)) {
  console.log(`  Webhook: ${WEBHOOK_URL} already exists, skipped`)
} else {
  const endpoint = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    description: 'TATE AI subscription sync',
    enabled_events: WEBHOOK_EVENTS,
  })
  writeFileSync('.env.stripe-webhook', `STRIPE_WEBHOOK_SECRET=${endpoint.secret}\n`)
  console.log('  Webhook: created; signing secret written to .env.stripe-webhook')
}

console.log('Done.')
