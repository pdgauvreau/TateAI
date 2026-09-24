import { BillingConfigError, adminClient, authenticate, json, stripe } from '../_lib/billing.js'

export async function POST(request) {
  try {
    const { user } = await authenticate(request)
    if (!user) return json({ error: 'Sign in to manage billing.' }, 401)

    const { data: profile } = await adminClient()
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return json({ error: 'There is no billing account to manage yet.' }, 400)
    }

    const session = await stripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${new URL(request.url).origin}/dashboard`,
    })

    return json({ url: session.url })
  } catch (error) {
    if (error instanceof BillingConfigError) return json({ error: error.message }, 500)
    return json({ error: error?.message ?? 'Could not open billing.' }, 500)
  }
}
