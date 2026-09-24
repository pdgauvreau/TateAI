-- When a paid plan is due to end.
--
-- Without this the dashboard kept saying "Renews <date>" after a student
-- cancelled, which reads as the cancellation having failed. Written only by the
-- Stripe webhook: 0004 limited user updates on profiles to full_name, and a new
-- column gets no user update privilege, so this needs no extra grant or revoke.
alter table public.profiles
  add column if not exists cancel_at timestamptz;
