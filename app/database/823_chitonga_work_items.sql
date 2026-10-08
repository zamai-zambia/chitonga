-- 823 — work is given item by item: review and reverse-translation items (Chitonga tool)
--
-- WHY (Chris, 5 Oct 2026): "the app doesn't need to switch, we are the ones that give the tasks: either English -
-- Tonga translation, review of an existing translation, and then Tonga - English reverse." Translation work stays
-- as it is (chitonga_lines.assigned_to, whole documents). Review and reverse work are rows here, one per line per
-- person, given with tools/chitonga/admin.mjs (which refuses to give anyone their own line, or reverse work in a
-- document whose English they have seen). The server never sends the English of a reverse line.
--
-- SAFE TO RUN WHILE PEOPLE WORK: one new table, and two more allowed values for chitonga_events.action. Nothing
-- existing changes. Reversible: drop table public.chitonga_tasks; and restore the old action check.

create table if not exists public.chitonga_tasks (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('review', 'reverse')),
  line_id     text not null references public.chitonga_lines (line_id),
  person      text not null references public.chitonga_people (code),
  status      text not null default 'open' check (status in ('open', 'done')),
  result      text check (result is null or length(result) <= 2000),   -- reverse: the English the person wrote
  note        text check (note is null or length(note) <= 2000),
  created_at  timestamptz not null default now(),
  done_at     timestamptz,
  unique (kind, line_id, person)
);
create index if not exists chitonga_tasks_person_idx on public.chitonga_tasks (person, status, id);
create index if not exists chitonga_tasks_line_idx   on public.chitonga_tasks (line_id, kind);
alter table public.chitonga_tasks enable row level security;   -- no policies: the service role (the function) only

alter table public.chitonga_events drop constraint if exists chitonga_events_action_check;
alter table public.chitonga_events add constraint chitonga_events_action_check
  check (action in ('translate', 'flag', 'ok', 'correct', 'check_flag', 'note', 'reverse', 'reverse_flag'));

comment on table public.chitonga_tasks is
  'Review and reverse-translation work given to a person, one row per line. Translation work is chitonga_lines.assigned_to. Mig 823.';
