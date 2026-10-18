-- Day_1 B1: P1 data model. Tables live in the non-exposed `app` schema.
-- Every table: user_id + index, composite FKs (user_id, x_id) so rows can only
-- reference rows of the same tenant, cascade on user delete.

create schema if not exists app;
revoke all on schema app from public;
revoke all on schema app from anon;
grant usage on schema app to authenticated;

-- updated_at maintenance
create or replace function app.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- 1. Accounts (created on first request). plan/terms are not user-writable except terms.
create table app.user_accounts (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  plan               text not null default 'free'
                     check (plan in ('free', 'plus', 'pro', 'pro_plus')),
  terms_version      text check (char_length(terms_version) <= 32),
  terms_accepted_at  timestamptz,
  created_at         timestamptz not null default now()
);

-- 2. Saved profile (PROF-1). One per user.
create table app.personal_profiles (
  user_id       uuid primary key references app.user_accounts (user_id) on delete cascade,
  content       jsonb not null check (pg_column_size(content) <= 262144),
  content_hash  text  not null check (char_length(content_hash) = 64),
  row_version   integer not null default 1 check (row_version >= 1),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger personal_profiles_touch before update on app.personal_profiles
  for each row execute function app.touch_updated_at();

-- 3. CV uploads: pre-fill source only (PROF-2/3).
create table app.cv_uploads (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app.user_accounts (user_id) on delete cascade,
  source_type   text not null check (source_type in ('pdf', 'docx', 'latex')),
  filename      text not null check (char_length(filename) between 1 and 255),
  storage_path  text not null check (char_length(storage_path) <= 512),
  parsed        jsonb check (pg_column_size(parsed) <= 262144),
  created_at    timestamptz not null default now(),
  unique (user_id, id)
);
create index cv_uploads_user_idx on app.cv_uploads (user_id, created_at desc);

-- 4. Job descriptions (TAIL-1: 1..1000 words, checked in app; char cap here).
create table app.job_descriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app.user_accounts (user_id) on delete cascade,
  text          text not null check (char_length(text) between 1 and 20000),
  word_count    integer not null check (word_count between 1 and 1000),
  content_hash  text not null check (char_length(content_hash) = 64),
  company       text check (char_length(company) <= 200),
  role          text check (char_length(role) <= 200),
  created_at    timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, content_hash)
);

-- 5. Agent runs (audit; no prompt or content stored). Before resumes/analyses for FKs.
create table app.agent_runs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references app.user_accounts (user_id) on delete cascade,
  agent_id        text not null check (char_length(agent_id) <= 64),
  agent_version   integer not null,
  provider        text not null check (char_length(provider) <= 32),
  model           text not null check (char_length(model) <= 128),
  status          text not null check (status in ('succeeded', 'failed')),
  attempts        integer not null check (attempts >= 1),
  input_tokens    integer,
  output_tokens   integer,
  latency_ms      integer not null check (latency_ms >= 0),
  error_code      text check (char_length(error_code) <= 64),
  entity_id       uuid,
  correlation_id  text check (char_length(correlation_id) <= 64),
  created_at      timestamptz not null default now(),
  unique (user_id, id)
);
create index agent_runs_user_idx on app.agent_runs (user_id, created_at desc);

-- 6. Resumes: one per dashboard card.
create table app.resumes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references app.user_accounts (user_id) on delete cascade,
  title             text not null check (char_length(title) between 1 and 120),
  template          text not null check (template in ('jake')),
  mode              text not null check (mode in ('tailored', 'scratch')),
  jd_id             uuid,
  content           jsonb not null check (pg_column_size(content) <= 262144),
  missing_skills    jsonb not null default '[]'::jsonb,
  -- Last full tailor: counts + field paths of items kept original (B9). No CV text.
  tailor_report     jsonb check (pg_column_size(tailor_report) <= 16384),
  wizard_step       text not null default 'personal'
                    check (wizard_step in ('personal', 'experience', 'projects', 'education',
                                           'skills', 'done')),
  status            text not null default 'draft'
                    check (status in ('draft', 'tailoring', 'ready', 'failed')),
  job_started_at    timestamptz,
  row_version       integer not null default 1 check (row_version >= 1),
  content_hash      text not null check (char_length(content_hash) = 64),
  pdf_path          text check (char_length(pdf_path) <= 512),
  pdf_content_hash  text check (char_length(pdf_content_hash) = 64),
  page_count        integer check (page_count >= 0),
  error_code        text check (char_length(error_code) <= 64),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, id),
  -- Composite FK: a resume can only point at its owner's JD. Deleting the JD clears jd_id only.
  foreign key (user_id, jd_id) references app.job_descriptions (user_id, id)
    on delete set null (jd_id)
);
create index resumes_user_idx on app.resumes (user_id, updated_at desc);
create trigger resumes_touch before update on app.resumes
  for each row execute function app.touch_updated_at();

-- 7. Analyses: unique (resume_id, content_hash) is the cache (ANA, B6).
create table app.cv_analyses (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references app.user_accounts (user_id) on delete cascade,
  resume_id         uuid not null,
  content_hash      text not null check (char_length(content_hash) = 64),
  jd_content_hash   text not null check (char_length(jd_content_hash) = 64),
  keyword_score     smallint not null check (keyword_score between 0 and 100),
  experience_score  smallint not null check (experience_score between 0 and 100),
  narrative_score   smallint not null check (narrative_score between 0 and 100),
  details           jsonb not null check (pg_column_size(details) <= 131072),
  agent_run_id      uuid,
  created_at        timestamptz not null default now(),
  unique (resume_id, content_hash, jd_content_hash),
  foreign key (user_id, resume_id) references app.resumes (user_id, id) on delete cascade,
  foreign key (user_id, agent_run_id) references app.agent_runs (user_id, id)
    on delete set null (agent_run_id)
);
create index cv_analyses_user_idx on app.cv_analyses (user_id);

-- 8. Usage events: one row per quota-counted action (PLAN-2). Added to Day_1 B1 because the
-- approved PDF quota has no other row to count.
create table app.usage_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app.user_accounts (user_id) on delete cascade,
  action      text not null check (action in ('full_tailor', 'bullet_tailor', 'pdf',
                                               'analysis', 'upload')),
  created_at  timestamptz not null default now()
);
create index usage_events_user_action_idx on app.usage_events (user_id, action, created_at);
