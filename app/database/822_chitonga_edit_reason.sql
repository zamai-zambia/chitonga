-- 822 — why a line was changed, and which phone a save came from (Chitonga tool)
--
-- WHY (Chris, 5 Oct 2026):
-- (1) translators can change their own lines until they are checked; the page asks why, and the reason is kept.
-- (2) on 5 Oct three people were sent the first translator's link by mistake and worked inside his account; nothing in the
--     data could tell them apart. Every save now carries a random id kept on the phone and the phone type
--     (iPhone/Android/...), so two phones on one account show at once and work can be attributed.
--     No personal data: the id is random, not a phone number or name.
--
-- SAFE TO RUN WHILE PEOPLE WORK: adds three empty, nullable text columns to chitonga_events. Nothing else changes.
-- The function retries a save without these fields if the columns are missing.
-- Reversible: alter table public.chitonga_events drop column edit_reason, drop column device, drop column platform;

alter table public.chitonga_events
  add column if not exists edit_reason text check (edit_reason is null or length(edit_reason) <= 300),
  add column if not exists device      text check (device is null or length(device) <= 40),
  add column if not exists platform    text check (platform is null or length(platform) <= 20);

create index if not exists chitonga_events_device_idx on public.chitonga_events (person, device);

comment on column public.chitonga_events.edit_reason is 'Why the translator changed a line that was already saved. Mig 822.';
comment on column public.chitonga_events.device is 'Random id kept on the phone that made the save (not personal data). Mig 822.';
comment on column public.chitonga_events.platform is 'Phone type of that save: iPhone, Android, Windows, Mac or other. Mig 822.';
