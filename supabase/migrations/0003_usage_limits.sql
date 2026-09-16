-- Per-user usage metering, so one account cannot spend without limit against the
-- AI provider key.
--
-- This is a separate table rather than counting rows in `messages` because:
--   * counting messages means joining through `conversations` to reach user_id,
--     which gets slower exactly as usage grows;
--   * a user can delete their own conversations, which would erase the evidence
--     of usage along with them;
--   * billing will need a metering primitive anyway, and this is it.
--
-- Tamper model: users may read and insert their own rows, but there is
-- deliberately no update or delete policy. RLS denies by default, so a user can
-- only ever add to their own usage, never remove it. Adding usage only costs
-- them quota, so insert-own is safe.

create table if not exists public.usage_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null default 'chat_message' check (kind in ('chat_message')),
  created_at timestamptz not null default now()
);

alter table public.usage_events enable row level security;

create policy "usage_events: read own"
  on public.usage_events for select using ((select auth.uid()) = user_id);
create policy "usage_events: insert own"
  on public.usage_events for insert with check ((select auth.uid()) = user_id);

-- No update or delete policies: usage must not be erasable by the user.

-- Serves the only query that matters: this user's events inside a rolling window.
create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);
