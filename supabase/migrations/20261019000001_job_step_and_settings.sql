-- Day 2: frontend wiring.
--  * resumes.job_step: the tailor job's current step, so the UI shows real progress (TAIL-3).
--    Set only while status = 'tailoring'; cleared when the job finishes or fails.
--  * user_settings: per-user preferences from the Settings page. One row per user, created on
--    first save; no row = defaults.

alter table app.resumes
  add column job_step text check (job_step in ('reading', 'rewriting', 'checking'));

create table app.user_settings (
  user_id          uuid primary key references app.user_accounts (user_id) on delete cascade,
  -- null = show the name from the sign-in provider
  display_name     text check (char_length(display_name) between 1 and 120),
  ask_before_save  boolean not null default true,
  product_emails   boolean not null default false,
  updated_at       timestamptz not null default now()
);

create trigger user_settings_touch before update on app.user_settings
  for each row execute function app.touch_updated_at();

-- Same isolation as every other table (20261018000002): RLS enabled and forced, one policy
-- per verb pinned to auth.uid(), only the verbs the backend needs.
alter table app.user_settings enable row level security;
alter table app.user_settings force row level security;
revoke all on app.user_settings from public, anon, authenticated;

create policy user_settings_select on app.user_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_settings_insert on app.user_settings for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy user_settings_update on app.user_settings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on app.user_settings to authenticated;
