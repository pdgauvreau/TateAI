import { json, stripe, syncCustomer } from '../_lib/billing.js'

// Every event here is resolved to its Stripe Customer, then the customer's
// subscriptions are re-read and applied. Payloads are never trusted for state,
// which makes handling idempotent and immune to out-of-order delivery.
const HANDLED = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.paid',
  'invoice.payment_failed',
])

const customerOf = (object) =>
  typeof object?.customer === 'string' ? object.customer : (object?.customer?.id ?? null)

export async function POST(request) {
  // Trimmed because an invisible prefix or suffix makes every signature check
  // fail. Windows PowerShell prepends a UTF-8 byte-order mark when piping text
  // into `vercel env add`, which is exactly how this broke the first time.
  // String.prototype.trim removes U+FEFF as well as ordinary whitespace, and no
  // whsec_ value legitimately contains either.
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) return json({ error: 'STRIPE_WEBHOOK_SECRET is not set.' }, 500)

  // The signature covers the exact bytes Stripe sent, so this must be the raw
  // body. Parsing it first — even to JSON and back — makes verification fail.
  const raw = await request.text()
  const signature = request.headers.get('stripe-signature')

  let event
  try {
    event = await stripe().webhooks.constructEventAsync(raw, signature, secret)
  } catch (error) {
    return json({ error: `Signature verification failed: ${error.message}` }, 400)
  }

  if (!HANDLED.has(event.type)) return json({ received: true, ignored: event.type })

  const customerId = customerOf(event.data.object)
  if (!customerId) return json({ received: true, skipped: 'no customer on event' })

  try {
    const applied = await syncCustomer(customerId)
    // A customer no profile owns is not worth retrying forever; acknowledge it.
    return json({ received: true, applied: applied ?? 'no matching profile' })
  } catch (error) {
    // Anything else is transient from Stripe's point of view: a non-2xx makes it
    // retry with backoff, which is what we want if the database blinked.
    return json({ error: error.message }, 500)
  }
}
