import { supabase } from './supabase'

/**
 * POSTs JSON to one of our /api routes with the student's session token.
 *
 * Resolves to the parsed body, or { error } with the server's own message. A
 * 429 is the usage limit, flagged so callers can show it as a quota notice.
 */
export const authedFetch = async (path, body) => {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) return { error: 'Your session expired. Sign in again.' }

  let response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    })
  } catch {
    return {
      error:
        'Could not reach the API. If you are running `npm run dev`, use `npm run dev:api` instead — plain Vite does not serve /api routes.',
    }
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      error: payload.error ?? `Request failed (${response.status}).`,
      rateLimited: response.status === 429,
    }
  }
  return payload
}
