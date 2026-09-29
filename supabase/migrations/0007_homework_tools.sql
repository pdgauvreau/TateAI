-- Homework tools: photo and scanned-page transcription, reply modes, and
-- passage search over large documents.
--
-- 1. usage_events.kind gains 'transcription'. Reading a photo or a scanned PDF
--    is a model call, so it draws on the same allowance as a reply.
-- 2. messages gain `intent` (the reply mode the student picked: a hint, a worked
--    example on a similar problem, or a check of their work) and `document_id`
--    (a file attached from inside the conversation), so the thread can show both
--    and the server can rebuild the same prompt for every later turn.
-- 3. document_chunks holds each document's text in overlapping passages with a
--    full-text index. The chat API sends a whole document when the materials fit
--    its budget and searches these passages when they do not, so a textbook
--    chapter is no longer silently cut off at the budget.

-- ---------------------------------------------------------------------------
-- 1. Metering transcription
-- ---------------------------------------------------------------------------
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events
  add constraint usage_events_kind_check check (kind in ('chat_message', 'transcription'));

-- ---------------------------------------------------------------------------
-- 2. Reply modes and in-conversation attachments
-- ---------------------------------------------------------------------------
alter table public.messages
  add column if not exists intent text check (intent in ('hint', 'example', 'check')),
  add column if not exists document_id uuid references public.documents (id) on delete set null;

create index if not exists messages_document_id_idx
  on public.messages (document_id) where document_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Passages for search
-- ---------------------------------------------------------------------------
create table if not exists public.document_chunks (
  id          bigint generated always as identity primary key,
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  position    integer not null,
  content     text not null,
  fts         tsvector generated always as (to_tsvector('english', content)) stored,
  unique (document_id, position)
);

alter table public.document_chunks enable row level security;

-- Read-only to users. Rows are derived from documents.extracted_text by the
-- trigger below, which is the only writer.
create policy "document_chunks: read own"
  on public.document_chunks for select using ((select auth.uid()) = user_id);

create index if not exists document_chunks_fts_idx on public.document_chunks using gin (fts);
create index if not exists document_chunks_user_idx on public.document_chunks (user_id);

-- Splits a document into passages of about 1,500 characters that overlap by
-- 200, so a sentence cut at one boundary is whole in the neighbouring passage.
-- Each cut moves back to the nearest line break or space so words stay intact.
create or replace function public.rechunk_document(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  doc_text  text;
  doc_user  uuid;
  total     integer;
  start_pos integer := 1;
  piece     text;
  tail      text;
  cut       integer;
  idx       integer := 0;
begin
  select extracted_text, user_id into doc_text, doc_user
  from documents where id = p_document_id;

  delete from document_chunks where document_id = p_document_id;

  if doc_text is null or length(doc_text) = 0 then
    return;
  end if;

  total := length(doc_text);

  while start_pos <= total loop
    piece := substr(doc_text, start_pos, 1500);

    if start_pos + 1500 <= total then
      -- Cut at the last line break in the final 300 characters, else the last
      -- space, else mid-word as a last resort.
      tail := right(piece, 300);
      if strpos(tail, E'\n') > 0 then
        cut := length(piece) - strpos(reverse(tail), E'\n') + 1;
      elsif strpos(tail, ' ') > 0 then
        cut := length(piece) - strpos(reverse(tail), ' ') + 1;
      else
        cut := length(piece);
      end if;
      piece := left(piece, cut);
    end if;

    insert into document_chunks (document_id, user_id, position, content)
    values (p_document_id, doc_user, idx, piece);

    idx := idx + 1;
    exit when start_pos + length(piece) > total;
    start_pos := start_pos + greatest(length(piece) - 200, 1);
  end loop;
end;
$$;

-- Internal only: reachable through the trigger, never as an RPC endpoint.
revoke execute on function public.rechunk_document(uuid) from public, anon, authenticated;

create or replace function public.documents_rechunk_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform rechunk_document(new.id);
  return new;
end;
$$;

revoke execute on function public.documents_rechunk_trigger() from public, anon, authenticated;

drop trigger if exists documents_rechunk on public.documents;
create trigger documents_rechunk
  after insert or update of extracted_text on public.documents
  for each row
  when (new.extracted_text is not null)
  execute function public.documents_rechunk_trigger();

-- Passages from a conversation's documents that best match a question, best
-- first. Any matching word counts (the words are OR-ed rather than AND-ed):
-- a student's question rarely repeats every term the passage uses. Security
-- invoker, so row-level security limits it to the caller's own conversations
-- and documents.
create or replace function public.match_document_chunks(
  p_conversation_id uuid,
  p_query           text,
  p_limit           integer default 20
)
returns table (
  document_id uuid,
  "position"  integer,
  content     text,
  rank        real
)
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    select nullif(replace(plainto_tsquery('english', p_query)::text, '&', '|'), '')::tsquery as query
  )
  select c.document_id, c.position, c.content, ts_rank_cd(c.fts, q.query) as rank
  from q
  join conversation_documents cd on cd.conversation_id = p_conversation_id
  join document_chunks c on c.document_id = cd.document_id
  where q.query is not null and c.fts @@ q.query
  order by rank desc
  limit least(greatest(p_limit, 1), 60);
$$;

grant execute on function public.match_document_chunks(uuid, text, integer) to authenticated;

-- Existing documents get their passages now rather than on their next edit.
do $$
declare
  d record;
begin
  for d in select id from public.documents where extracted_text is not null loop
    perform public.rechunk_document(d.id);
  end loop;
end;
$$;
