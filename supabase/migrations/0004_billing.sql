-- Billing columns, and a fix for a privilege escalation in 0001.
--
-- SECURITY FIX. 0001 gave signed-in users an "update own" policy on profiles with
-- no column restriction, so any user could PATCH their own row and set
-- plan = 'institution'. That became exploitable the moment usage limits started
-- reading `plan` (0003): it bypassed the message cap entirely, and with billing it
-- would let anyone grant themselves a paid tier without paying.
--
-- RLS decides which *rows* a user may touch; column privileges decide which
-- *columns*. Both are needed here. Users keep the ability to edit their display
-- name and nothing else. plan and every billing column are written only by the
-- Stripe webhook, which uses the service role and bypasses these grants.

revoke update on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Billing state, mirrored from Stripe
-- ---------------------------------------------------------------------------
-- The Stripe Customer is the ownership boundary: webhook events are resolved
-- through Stripe's object graph to a customer ID, then mapped to a profile here.
-- That is deliberately not done through metadata, which is easy to omit and
-- cannot be trusted as the primary link.
alter table public.profiles
  add column if not exists stripe_customer_id     text unique,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status    text,
  add column if not exists current_period_end     timestamptz;

-- `stripe_customer_id text unique` already creates a unique index, which is what
-- the webhook looks profiles up by, so no separate index is needed.
