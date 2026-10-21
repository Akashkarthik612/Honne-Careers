-- Day 2: the application Database (SAVE-1/2/3, IQ-1/2/3).
--  * applications: one row per job applied to. A download for a JD saves the JD (by id), a JSON
--    snapshot of the CV sent and our own copy of its PDF. One JD = one row.
--  * application_events: status history (from -> to, when), append-only (IQ-2).
--  * storage_trash: PDF paths whose delete failed; the daily clean-up retries them.
--  * maintenance_runs: last run of each background job, so it runs once a day across instances.
--  * Retention: rows hold only last_sent_at. The number of days lives in the API's settings
--    (APPLICATION_RETENTION_DAYS); reads hide older rows, the daily job deletes them.
--  * The clean-up is the only thing that touches every user's rows. It goes through SECURITY
--    DEFINER functions that only honne_backend may execute directly; request transactions run
--    as `authenticated`, which can't call them.

create table app.applications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references app.user_accounts (user_id) on delete cascade,
  jd_id            uuid,
  resume_id        uuid,
  source           text not null check (source in ('honne', 'manual')),
  company          text check (char_length(company) <= 200),
  role             text check (char_length(role) <= 200),
  applied_on       date not null default current_date,   -- "Date sent" shown to the user
  status           text not null default 'applied'
                   check (status in ('applied', 'interview', 'offer', 'rejected', 'no_reply')),
  referral         text check (referral in ('yes', 'asked', 'no')),   -- null = "—"
  notes            text check (char_length(notes) <= 5000),
  cv_content       jsonb check (pg_column_size(cv_content) <= 262144),
  cv_content_hash  text check (char_length(cv_content_hash) = 64),
  pdf_path         text check (char_length(pdf_path) <= 512),
  page_count       integer check (page_count >= 0),
  last_sent_at     timestamptz not null default now(),    -- retention clock
  row_version      integer not null default 1 check (row_version >= 1),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, jd_id),
  -- A Honne row always carries the CV it sent; a manual row may have neither.
  check (source = 'manual' or (jd_id is not null and cv_content is not null)),
  foreign key (user_id, jd_id) references app.job_descriptions (user_id, id)
    on delete restrict,
  foreign key (user_id, resume_id) references app.resumes (user_id, id)
    on delete set null (resume_id)
);
create index applications_user_idx on app.applications (user_id, last_sent_at desc);
create index applications_expiry_idx on app.applications (last_sent_at);  -- daily clean-up
create trigger applications_touch before update on app.applications
  for each row execute function app.touch_updated_at();

create table app.application_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references app.user_accounts (user_id) on delete cascade,
  application_id  uuid not null,
  from_status     text check (from_status in ('applied', 'interview', 'offer', 'rejected',
                                              'no_reply')),
  to_status       text not null check (to_status in ('applied', 'interview', 'offer',
                                                     'rejected', 'no_reply')),
  created_at      timestamptz not null default now(),
  foreign key (user_id, application_id) references app.applications (user_id, id)
    on delete cascade
);
create index application_events_app_idx on app.application_events (application_id, created_at);

create table app.storage_trash (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app.user_accounts (user_id) on delete cascade,
  path        text not null check (char_length(path) <= 512),
  created_at  timestamptz not null default now()
);

create table app.maintenance_runs (
  job          text primary key check (char_length(job) <= 64),
  last_run_at  timestamptz not null
);

-- Same isolation as every other table (20261018000002).
do $$
declare
  t text;
begin
  foreach t in array array['applications', 'application_events', 'storage_trash']
  loop
    execute format('alter table app.%I enable row level security', t);
    execute format('alter table app.%I force row level security', t);
    execute format('revoke all on app.%I from public, anon, authenticated', t);
    execute format($p$create policy %I on app.%I for select to authenticated
                      using (user_id = (select auth.uid()))$p$, t || '_select', t);
    execute format($p$create policy %I on app.%I for insert to authenticated
                      with check (user_id = (select auth.uid()))$p$, t || '_insert', t);
    execute format($p$create policy %I on app.%I for update to authenticated
                      using (user_id = (select auth.uid()))
                      with check (user_id = (select auth.uid()))$p$, t || '_update', t);
    execute format($p$create policy %I on app.%I for delete to authenticated
                      using (user_id = (select auth.uid()))$p$, t || '_delete', t);
  end loop;
end $$;

-- No user may touch maintenance_runs: RLS on, no policy, no grant.
alter table app.maintenance_runs enable row level security;
alter table app.maintenance_runs force row level security;
revoke all on app.maintenance_runs from public, anon, authenticated;

grant select, insert, update, delete on app.applications to authenticated;
grant select, insert on app.application_events to authenticated;   -- history: append-only
grant select, insert, delete on app.storage_trash to authenticated;

-- ---------- daily clean-up (SECURITY DEFINER, honne_backend only) ----------
-- Each function refuses a cut-off newer than one day, so a bug in the caller can never purge
-- fresh rows. `row_security = off` makes a missing BYPASSRLS on the owner fail loudly instead
-- of silently matching nothing.

create function app.janitor_claim(p_job text, p_every interval) returns boolean
language plpgsql security definer set search_path = '' set row_security = off as $$
declare
  claimed boolean;
begin
  insert into app.maintenance_runs as m (job, last_run_at) values (p_job, now())
  on conflict (job) do update set last_run_at = now()
   where m.last_run_at < now() - p_every
  returning true into claimed;
  return coalesce(claimed, false);
end $$;

create function app.janitor_expired_applications(p_cutoff timestamptz, p_limit integer)
returns table (id uuid, user_id uuid, pdf_path text)
language plpgsql security definer set search_path = '' set row_security = off as $$
begin
  if p_cutoff > now() - interval '1 day' then
    raise exception 'cut-off too recent: %', p_cutoff;
  end if;
  return query
    select a.id, a.user_id, a.pdf_path from app.applications a
     where a.last_sent_at < p_cutoff
     order by a.last_sent_at
     limit p_limit;
end $$;

create function app.janitor_purge_applications(p_ids uuid[], p_cutoff timestamptz)
returns table (rows_deleted integer, jds_deleted integer)
language plpgsql security definer set search_path = '' set row_security = off as $$
declare
  n_rows integer;
  n_jds integer;
  jd_ids uuid[];
begin
  if p_cutoff > now() - interval '1 day' then
    raise exception 'cut-off too recent: %', p_cutoff;
  end if;
  -- Re-checks the cut-off: a row re-downloaded since it was listed is kept.
  with gone as (
    delete from app.applications a
     where a.id = any(p_ids) and a.last_sent_at < p_cutoff
    returning a.jd_id
  )
  select count(*), coalesce(array_agg(distinct g.jd_id) filter (where g.jd_id is not null),
                            '{}')
    into n_rows, jd_ids from gone g;
  -- JDs nothing else uses (no application, no resume).
  delete from app.job_descriptions j
   where j.id = any(jd_ids)
     and not exists (select 1 from app.applications a
                      where a.user_id = j.user_id and a.jd_id = j.id)
     and not exists (select 1 from app.resumes r
                      where r.user_id = j.user_id and r.jd_id = j.id);
  get diagnostics n_jds = row_count;
  return query select n_rows, n_jds;
end $$;

create function app.janitor_trash(p_limit integer)
returns table (id uuid, path text)
language sql security definer set search_path = '' set row_security = off as $$
  select t.id, t.path from app.storage_trash t order by t.created_at limit p_limit
$$;

create function app.janitor_trash_done(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' set row_security = off as $$
declare
  n integer;
begin
  delete from app.storage_trash t where t.id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;

do $$
declare
  f text;
begin
  foreach f in array array['app.janitor_claim(text, interval)',
                           'app.janitor_expired_applications(timestamptz, integer)',
                           'app.janitor_purge_applications(uuid[], timestamptz)',
                           'app.janitor_trash(integer)',
                           'app.janitor_trash_done(uuid[])']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to honne_backend', f);
  end loop;
end $$;
-- honne_backend is NOINHERIT, so it needs schema usage of its own to call the functions.
-- It still has no table grants: without SET ROLE every table read is denied.
grant usage on schema app to honne_backend;
