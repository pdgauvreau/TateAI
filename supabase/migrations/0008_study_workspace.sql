-- Study workspace: courses, an assignment tracker, flashcards with spaced
-- repetition, practice quizzes, and study guides.
--
-- Every new table follows the same pattern as 0001/0002: a user_id column, row
-- level security enabled, and policies keyed on (select auth.uid()) so the
-- check runs once per statement. Rows cascade away with the user.
--
-- 1. courses, and a nullable course_id on documents and conversations so both
--    can be filed under a course. Deleting a course unfiles its contents rather
--    than deleting them.
-- 2. assignments: title, due time, kind, done/undone. source_document_id marks
--    rows imported from a syllabus.
-- 3. flashcard decks and cards, with the scheduling state the review screen
--    needs (due_at, interval, ease, reps, lapses).
-- 4. quizzes: generated multiple-choice questions, kept with the best score.
-- 5. study_guides: a generated Markdown summary of a set of materials.
-- 6. usage_events.kind gains 'generation', and messages.intent gains 'essay'
--    (feedback on a piece of writing).

-- ---------------------------------------------------------------------------
-- 1. Courses
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  -- A key into the app's own palette, not a free colour: every value has to
  -- read in both themes.
  color       text not null default 'green'
              check (color in ('green', 'blue', 'violet', 'amber', 'rose', 'cyan', 'slate')),
  created_at  timestamptz not null default now()
);

alter table public.courses enable row level security;

create policy "courses: read own" on public.courses for select using ((select auth.uid()) = user_id);
create policy "courses: insert own" on public.courses for insert with check ((select auth.uid()) = user_id);
create policy "courses: update own" on public.courses for update using ((select auth.uid()) = user_id);
create policy "courses: delete own" on public.courses for delete using ((select auth.uid()) = user_id);

create index if not exists courses_user_idx on public.courses (user_id, created_at);

alter table public.documents
  add column if not exists course_id uuid references public.courses (id) on delete set null;
alter table public.conversations
  add column if not exists course_id uuid references public.courses (id) on delete set null;

create index if not exists documents_course_idx on public.documents (course_id) where course_id is not null;
create index if not exists conversations_course_idx on public.conversations (course_id) where course_id is not null;

-- A course can only be set to one of the caller's own courses. Without this a
-- user could point a row at someone else's course id; nothing would leak, but
-- the reference would be meaningless.
create or replace function public.course_is_own(p_course_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select p_course_id is null or exists (select 1 from courses where id = p_course_id)
$$;

-- Restrictive, so they add the course check on top of the existing ownership
-- policies from 0002 instead of replacing them.
create policy "documents: own course only (insert)" on public.documents
  as restrictive for insert with check (public.course_is_own(course_id));
create policy "documents: own course only (update)" on public.documents
  as restrictive for update with check (public.course_is_own(course_id));
create policy "conversations: own course only (insert)" on public.conversations
  as restrictive for insert with check (public.course_is_own(course_id));
create policy "conversations: own course only (update)" on public.conversations
  as restrictive for update with check (public.course_is_own(course_id));

-- ---------------------------------------------------------------------------
-- 2. Assignments
-- ---------------------------------------------------------------------------
create table if not exists public.assignments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  course_id          uuid references public.courses (id) on delete set null,
  title              text not null check (char_length(title) between 1 and 200),
  kind               text not null default 'homework'
                     check (kind in ('homework', 'reading', 'quiz', 'exam', 'project', 'essay', 'other')),
  due_at             timestamptz not null,
  notes              text check (char_length(notes) <= 2000),
  done_at            timestamptz,
  source_document_id uuid references public.documents (id) on delete set null,
  created_at         timestamptz not null default now()
);

alter table public.assignments enable row level security;

create policy "assignments: read own" on public.assignments for select using ((select auth.uid()) = user_id);
create policy "assignments: insert own" on public.assignments for insert
  with check ((select auth.uid()) = user_id and public.course_is_own(course_id));
create policy "assignments: update own" on public.assignments for update
  using ((select auth.uid()) = user_id) with check (public.course_is_own(course_id));
create policy "assignments: delete own" on public.assignments for delete using ((select auth.uid()) = user_id);

create index if not exists assignments_user_due_idx on public.assignments (user_id, due_at);
create index if not exists assignments_course_idx on public.assignments (course_id) where course_id is not null;
create index if not exists assignments_source_idx on public.assignments (source_document_id) where source_document_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Flashcards
-- ---------------------------------------------------------------------------
create table if not exists public.decks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  course_id   uuid references public.courses (id) on delete set null,
  title       text not null check (char_length(title) between 1 and 200),
  created_at  timestamptz not null default now()
);

alter table public.decks enable row level security;

create policy "decks: read own" on public.decks for select using ((select auth.uid()) = user_id);
create policy "decks: insert own" on public.decks for insert
  with check ((select auth.uid()) = user_id and public.course_is_own(course_id));
create policy "decks: update own" on public.decks for update
  using ((select auth.uid()) = user_id) with check (public.course_is_own(course_id));
create policy "decks: delete own" on public.decks for delete using ((select auth.uid()) = user_id);

create index if not exists decks_user_idx on public.decks (user_id, created_at desc);
create index if not exists decks_course_idx on public.decks (course_id) where course_id is not null;

create table if not exists public.cards (
  id                uuid primary key default gen_random_uuid(),
  deck_id           uuid not null references public.decks (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  front             text not null check (char_length(front) between 1 and 2000),
  back              text not null check (char_length(back) between 1 and 4000),
  position          integer not null default 0,
  -- Scheduling state. A new card is due immediately.
  due_at            timestamptz not null default now(),
  interval_days     real not null default 0 check (interval_days >= 0),
  ease              real not null default 2.5 check (ease between 1.3 and 5),
  reps              integer not null default 0 check (reps >= 0),
  lapses            integer not null default 0 check (lapses >= 0),
  last_reviewed_at  timestamptz,
  created_at        timestamptz not null default now()
);

alter table public.cards enable row level security;

-- A card's deck must be the caller's own, checked through the parent.
create policy "cards: read own" on public.cards for select using ((select auth.uid()) = user_id);
create policy "cards: insert own" on public.cards for insert
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.decks d where d.id = deck_id and d.user_id = (select auth.uid()))
  );
create policy "cards: update own" on public.cards for update
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.decks d where d.id = deck_id and d.user_id = (select auth.uid()))
  );
create policy "cards: delete own" on public.cards for delete using ((select auth.uid()) = user_id);

create index if not exists cards_deck_due_idx on public.cards (deck_id, due_at);
create index if not exists cards_user_due_idx on public.cards (user_id, due_at);

-- ---------------------------------------------------------------------------
-- 4. Quizzes
-- ---------------------------------------------------------------------------
create table if not exists public.quizzes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  course_id    uuid references public.courses (id) on delete set null,
  title        text not null check (char_length(title) between 1 and 200),
  -- [{ question, choices: [4 strings], answer: index, explanation }]
  questions    jsonb not null check (jsonb_typeof(questions) = 'array'),
  best_score   integer check (best_score >= 0),
  attempts     integer not null default 0 check (attempts >= 0),
  created_at   timestamptz not null default now()
);

alter table public.quizzes enable row level security;

create policy "quizzes: read own" on public.quizzes for select using ((select auth.uid()) = user_id);
create policy "quizzes: insert own" on public.quizzes for insert
  with check ((select auth.uid()) = user_id and public.course_is_own(course_id));
create policy "quizzes: update own" on public.quizzes for update
  using ((select auth.uid()) = user_id) with check (public.course_is_own(course_id));
create policy "quizzes: delete own" on public.quizzes for delete using ((select auth.uid()) = user_id);

create index if not exists quizzes_user_idx on public.quizzes (user_id, created_at desc);
create index if not exists quizzes_course_idx on public.quizzes (course_id) where course_id is not null;

-- ---------------------------------------------------------------------------
-- 5. Study guides
-- ---------------------------------------------------------------------------
create table if not exists public.study_guides (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  course_id   uuid references public.courses (id) on delete set null,
  title       text not null check (char_length(title) between 1 and 200),
  content     text not null,
  created_at  timestamptz not null default now()
);

alter table public.study_guides enable row level security;

create policy "study_guides: read own" on public.study_guides for select using ((select auth.uid()) = user_id);
create policy "study_guides: insert own" on public.study_guides for insert
  with check ((select auth.uid()) = user_id and public.course_is_own(course_id));
create policy "study_guides: update own" on public.study_guides for update
  using ((select auth.uid()) = user_id) with check (public.course_is_own(course_id));
create policy "study_guides: delete own" on public.study_guides for delete using ((select auth.uid()) = user_id);

create index if not exists study_guides_user_idx on public.study_guides (user_id, created_at desc);
create index if not exists study_guides_course_idx on public.study_guides (course_id) where course_id is not null;

-- ---------------------------------------------------------------------------
-- 6. Metering generation, and the essay-feedback reply mode
-- ---------------------------------------------------------------------------
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events
  add constraint usage_events_kind_check check (kind in ('chat_message', 'transcription', 'generation'));

alter table public.messages drop constraint if exists messages_intent_check;
alter table public.messages
  add constraint messages_intent_check check (intent in ('hint', 'example', 'check', 'essay'));
