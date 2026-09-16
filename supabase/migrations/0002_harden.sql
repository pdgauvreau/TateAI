-- Fixes flagged by the Supabase security and performance advisors against 0001.
--
-- 1. Every RLS policy called auth.uid() per row. Wrapping it in a subselect lets
--    Postgres evaluate it once per statement instead of once per row — the
--    difference grows with table size, and `messages` is the table that grows.
-- 2. handle_new_user is SECURITY DEFINER and was reachable as an RPC endpoint by
--    anon and authenticated. It is a trigger function and has no business being
--    callable directly.
-- 3. touch_updated_at had a mutable search_path.
-- 4. conversation_documents.document_id had no covering index.
--
-- Policy names and predicates are otherwise unchanged from 0001.

-- ---------------------------------------------------------------------------
-- 1. Re-create policies with (select auth.uid())
-- ---------------------------------------------------------------------------
drop policy if exists "profiles: read own" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;

create policy "profiles: read own"
  on public.profiles for select using ((select auth.uid()) = id);
create policy "profiles: update own"
  on public.profiles for update using ((select auth.uid()) = id);

drop policy if exists "documents: read own" on public.documents;
drop policy if exists "documents: insert own" on public.documents;
drop policy if exists "documents: update own" on public.documents;
drop policy if exists "documents: delete own" on public.documents;

create policy "documents: read own"
  on public.documents for select using ((select auth.uid()) = user_id);
create policy "documents: insert own"
  on public.documents for insert with check ((select auth.uid()) = user_id);
create policy "documents: update own"
  on public.documents for update using ((select auth.uid()) = user_id);
create policy "documents: delete own"
  on public.documents for delete using ((select auth.uid()) = user_id);

drop policy if exists "conversations: read own" on public.conversations;
drop policy if exists "conversations: insert own" on public.conversations;
drop policy if exists "conversations: update own" on public.conversations;
drop policy if exists "conversations: delete own" on public.conversations;

create policy "conversations: read own"
  on public.conversations for select using ((select auth.uid()) = user_id);
create policy "conversations: insert own"
  on public.conversations for insert with check ((select auth.uid()) = user_id);
create policy "conversations: update own"
  on public.conversations for update using ((select auth.uid()) = user_id);
create policy "conversations: delete own"
  on public.conversations for delete using ((select auth.uid()) = user_id);

drop policy if exists "conversation_documents: read own" on public.conversation_documents;
drop policy if exists "conversation_documents: insert own" on public.conversation_documents;
drop policy if exists "conversation_documents: delete own" on public.conversation_documents;

create policy "conversation_documents: read own"
  on public.conversation_documents for select
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())
  ));
create policy "conversation_documents: insert own"
  on public.conversation_documents for insert
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );
create policy "conversation_documents: delete own"
  on public.conversation_documents for delete
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())
  ));

drop policy if exists "messages: read own" on public.messages;
drop policy if exists "messages: insert own" on public.messages;

create policy "messages: read own"
  on public.messages for select
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())
  ));
create policy "messages: insert own"
  on public.messages for insert
  with check (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- 2. handle_new_user should only ever run from its trigger
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Pin touch_updated_at's search_path
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Cover the remaining foreign key
-- ---------------------------------------------------------------------------
create index if not exists conversation_documents_document_id_idx
  on public.conversation_documents (document_id);
