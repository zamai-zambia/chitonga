-- 820 — the Chitonga translation tool (DRAFT, not applied, not yet among the database migrations)
--
-- WHY (Chris, 5 Oct 2026): the SMOL Chitonga translation work (Phase 0) outgrows a shared Google
-- Sheet. Young rural translators work on cheap Android phones, the first translator checks. This is the store
-- behind the PWA at zamai.pro/chitonga. Public text plus anonymous translator codes (T01 ...) only.
--
-- ACCESS MODEL: nothing here is readable by the anon or authenticated roles. RLS is on with NO
-- policies. The only reader/writer is the Netlify function `chitonga`, using the service role key,
-- which looks the person up by their personal link token and shows them only what their role may see
-- (a translator: their own lines; the checker: all translated lines). The browser never talks to
-- Supabase directly.
--
-- Touches no other table. New tables only; nothing existing is altered. Reversible with
-- `drop table chitonga_events, chitonga_lines, chitonga_people cascade; drop view chitonga_pay;`.

create table if not exists public.chitonga_people (
  code        text primary key check (code ~ '^(T[0-9]{2,3}|CHK[0-9]{1,2})$'),  -- T01..., CHK1 = the first checker
  role        text not null check (role in ('translator', 'checker')),
  token       text not null unique check (length(token) >= 20),                  -- the personal link; long random
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz
);

create table if not exists public.chitonga_lines (
  line_id        text primary key,            -- smoldoc:<doc>:<nn> | smolsent:<nnnn> | gatitos:<id>; never edited
  part           text not null check (part in ('smoldoc', 'smolsent', 'gatitos')),
  doc_id         text,                        -- SmolDoc document, so a translator gets whole dialogues
  seq            int,                         -- line number inside the document
  ord            int not null,                -- global order, the order the SMOL maintainers asked for (first 66 docs first)
  block          int not null default 1,      -- 1 = first 825 lines; opened one block at a time
  en             text not null,
  translation    text,                        -- Plateau Tonga; this is the ONLY column that goes to Google
  loanwords      text,                        -- word=lang:reason ; ...
  valley_variant text,
  check_status   text check (check_status in ('ok', 'corrected', 'flagged')),
  assigned_to    text references public.chitonga_people (code),
  translated_by  text references public.chitonga_people (code),
  checked_by     text references public.chitonga_people (code),
  note           text,                        -- translator's note / flag reason
  check_note     text,                        -- checker's note
  original_translation text,                  -- what the translator wrote, kept when the checker corrects it
  translated_at  timestamptz,
  checked_at     timestamptz,
  updated_at     timestamptz not null default now()
);
create index if not exists chitonga_lines_assigned_idx on public.chitonga_lines (assigned_to, ord);
create index if not exists chitonga_lines_doc_idx      on public.chitonga_lines (doc_id, seq);
create index if not exists chitonga_lines_block_idx    on public.chitonga_lines (block, ord);

-- Every save, kept: the audit trail for pay, and for the minutes-per-line check on the first batch.
create table if not exists public.chitonga_events (
  id          bigint generated always as identity primary key,
  line_id     text not null references public.chitonga_lines (line_id),
  person      text not null references public.chitonga_people (code),
  action      text not null check (action in ('translate', 'flag', 'ok', 'correct', 'check_flag', 'note')),
  text        text,
  client_at   timestamptz,                    -- phone clock, when it was typed (offline saves arrive later)
  created_at  timestamptz not null default now()
);
create index if not exists chitonga_events_line_idx   on public.chitonga_events (line_id);
create index if not exists chitonga_events_person_idx on public.chitonga_events (person, created_at);

alter table public.chitonga_people enable row level security;
alter table public.chitonga_lines  enable row level security;
alter table public.chitonga_events enable row level security;
-- deliberately no policies: service role only.

-- What each person is owed. Translators are paid per line once it is checked (ok or corrected);
-- the checker per line checked. Rates: Chris, 3 Oct 2026 (K1.50 translating, K1 checking).
-- GATITOS has its own lower rate, NOT set yet, so it is left out of this view until it is.
create or replace view public.chitonga_pay with (security_invoker = true) as
  select translated_by as code, 'translated and checked'::text as basis,
         count(*) as lines, round(count(*) * 1.50, 2) as kwacha
    from public.chitonga_lines
   where check_status in ('ok', 'corrected') and translated_by is not null and part <> 'gatitos'
   group by translated_by
  union all
  select checked_by, 'checked', count(*), round(count(*) * 1.00, 2)
    from public.chitonga_lines
   where check_status in ('ok', 'corrected') and checked_by is not null and part <> 'gatitos'
   group by checked_by;

comment on table public.chitonga_lines is
  'SMOL Chitonga (toi) working lines for the zamai.pro/chitonga tool. Mirrors the Zamai working copy '
  'sheet. Only checked translations go into Google''s sheet; nothing else is ever added to it. Mig 820 (draft).';
