-- 821 — measures of how a translation was made, kept on the events table (Chitonga tool)
--
-- WHY (Chris, 5 Oct 2026): to know how long a line takes (pace, a just wage) and to spot machine translation:
-- time on the line, typing time, keystrokes, and how many times a paste was attempted (pasting is blocked for
-- translators, so an attempt is a signal, not a success).
--
-- SAFE TO RUN WHILE PEOPLE WORK: only adds empty, nullable columns to chitonga_events. No existing row, table,
-- index or policy changes. The function and the page work before and after this runs (the function retries a save
-- without these fields if the columns are missing), so run it BEFORE merging the page change that sends them.
-- Reversible: alter table public.chitonga_events drop column ms_shown, drop column ms_typing, drop column keys, drop column paste_attempts;

alter table public.chitonga_events
  add column if not exists ms_shown       integer check (ms_shown is null or ms_shown between 0 and 3600000),
  add column if not exists ms_typing      integer check (ms_typing is null or ms_typing between 0 and 3600000),
  add column if not exists keys           integer check (keys is null or keys between 0 and 100000),
  add column if not exists paste_attempts integer check (paste_attempts is null or paste_attempts between 0 and 1000);

comment on column public.chitonga_events.ms_shown is
  'Milliseconds the line was open on screen while the page was visible (each stretch capped at 10 min). Mig 821.';
comment on column public.chitonga_events.ms_typing is
  'Milliseconds from the first keystroke to saving (capped at 30 min). Mig 821.';
comment on column public.chitonga_events.paste_attempts is
  'Times a paste or drop into the translation box was blocked on this line. Mig 821.';
