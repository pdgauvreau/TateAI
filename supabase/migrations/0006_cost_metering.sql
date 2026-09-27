-- Meter usage by what it costs, not by message count.
--
-- A message's cost varies roughly fivefold with how much course material is in
-- the prompt and whether the prompt cache is warm, so a message cap cannot bound
-- spend. Each usage_events row now carries the token counts the provider reported
-- and the cost worked out from them, in micro-dollars (1e-6 USD) so sums stay
-- exact integers.
--
-- Tamper model is unchanged from 0003: users may insert their own rows but never
-- update or delete them. The new checks keep an inserted row from carrying a
-- negative amount, so a user writing rows directly can only ever add to their own
-- usage, which only costs them allowance.

alter table public.usage_events
  add column if not exists model              text,
  add column if not exists input_tokens       integer not null default 0 check (input_tokens >= 0),
  add column if not exists output_tokens      integer not null default 0 check (output_tokens >= 0),
  add column if not exists cache_read_tokens  integer not null default 0 check (cache_read_tokens >= 0),
  add column if not exists cache_write_tokens integer not null default 0 check (cache_write_tokens >= 0),
  add column if not exists cost_micros        bigint  not null default 0 check (cost_micros >= 0);

-- Totals for the caller over the two windows the limits use.
--
-- Summed in the database rather than by fetching rows: a heavy month is
-- thousands of events, and PostgREST caps a response at 1,000 rows, so a
-- client-side sum would silently undercount exactly the users it matters most
-- for. Security invoker, so row-level security scopes it to the caller's rows.
--
-- The *_oldest columns are the earliest event still inside each window, which is
-- when that window's allowance next starts to free up.
create or replace function public.usage_summary()
returns table (
  month_micros bigint,
  day_micros   bigint,
  month_oldest timestamptz,
  day_oldest   timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(cost_micros), 0)::bigint,
    coalesce(sum(cost_micros) filter (where created_at >= now() - interval '24 hours'), 0)::bigint,
    min(created_at),
    min(created_at) filter (where created_at >= now() - interval '24 hours')
  from public.usage_events
  where user_id = (select auth.uid())
    and created_at >= now() - interval '30 days';
$$;

revoke execute on function public.usage_summary() from public, anon;
grant execute on function public.usage_summary() to authenticated;
