-- TATE AI — initial schema
-- Run this in the Supabase dashboard: SQL Editor > New query > paste > Run.
--
-- Every table is protected by row-level security. The browser talks to Supabase
-- directly using the public anon key, so RLS is the only thing standing between
-- one user's study materials and another's. Do not disable it.

-- ---------------------------------------------------------------------------
-- profiles: one row per authenticated user, created automatically on signup
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  plan        text not null default 'free'
              check (plan in ('free', 'student', 'pro', 'institution')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select using (auth.uid() = id);
create policy "profiles: update own"
  on public.profiles for update using (auth.uid() = id);

-- Populate a profile whenever a new auth user appears. security definer is
-- required: the trigger runs before the new user has a session of their own.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- documents: uploaded slides, assignments, practice exams
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  title          text not null,
  storage_path   text not null unique,
  mime_type      text,
  size_bytes     bigint,
  -- pending -> processing -> ready, or failed with a reason in status_detail
  status         text not null default 'pending'
                 check (status in ('pending', 'processing', 'ready', 'failed')),
  status_detail  text,
  extracted_text text,
  created_at     timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "documents: read own"
  on public.documents for select using (auth.uid() = user_id);
create policy "documents: insert own"
  on public.documents for insert with check (auth.uid() = user_id);
create policy "documents: update own"
  on public.documents for update using (auth.uid() = user_id);
create policy "documents: delete own"
  on public.documents for delete using (auth.uid() = user_id);

create index if not exists documents_user_created_idx
  on public.documents (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- conversations + messages
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null default 'New conversation',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.conversations enable row level security;

create policy "conversations: read own"
  on public.conversations for select using (auth.uid() = user_id);
create policy "conversations: insert own"
  on public.conversations for insert with check (auth.uid() = user_id);
create policy "conversations: update own"
  on public.conversations for update using (auth.uid() = user_id);
create policy "conversations: delete own"
  on public.conversations for delete using (auth.uid() = user_id);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

-- Which documents a conversation draws on.
create table if not exists public.conversation_documents (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  document_id     uuid not null references public.documents (id) on delete cascade,
  primary key (conversation_id, document_id)
);

alter table public.conversation_documents enable row level security;

-- No user_id column here, so ownership is checked through the parent conversation.
create policy "conversation_documents: read own"
  on public.conversation_documents for select
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  ));
create policy "conversation_documents: insert own"
  on public.conversation_documents for insert
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = auth.uid()
    )
  );
create policy "conversation_documents: delete own"
  on public.conversation_documents for delete
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  ));

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  created_at      timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "messages: read own"
  on public.messages for select
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  ));
create policy "messages: insert own"
  on public.messages for insert
  with check (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  ));

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists conversations_touch_updated_at on public.conversations;
create trigger conversations_touch_updated_at
  before update on public.conversations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- storage: private bucket for uploaded materials
-- Files are stored at <user-id>/<document-id>.<ext>, so the first path segment
-- is the owner and the policies below key off it.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents bucket: read own"
  on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents bucket: insert own"
  on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents bucket: delete own"
  on storage.objects for delete
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
