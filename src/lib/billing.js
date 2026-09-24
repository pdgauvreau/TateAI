import { supabase } from './supabase'

const callBilling = async (path, body) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { error: 'Sign in first.' }

  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body ?? {}),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) return { error: payload.error ?? `Request failed (${response.status}).`, manage: payload.manage }
    return payload
  } catch {
    return { error: 'Could not reach billing. Check your connection and try again.' }
  }
}

/** Sends the user to Stripe Checkout for a plan. Returns only on failure. */
export const startCheckout = async (plan) => {
  const result = await callBilling('/api/billing/checkout', { plan })
  if (result.url) window.location.assign(result.url)
  return result
}

/** Sends the user to Stripe's customer portal. Returns only on failure. */
export const openBillingPortal = async () => {
  const result = await callBilling('/api/billing/portal')
  if (result.url) window.location.assign(result.url)
  return result
}
