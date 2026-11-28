create table app.beta_cv_jobs (
    user_id uuid not null references app.user_accounts(user_id) on delete cascade,
    resume_id uuid not null,
    job_version integer not null,
    started_at timestamptz not null default now(),
    completed boolean not null default false,
    primary key (user_id, resume_id, job_version)
);
create index beta_cv_jobs_user_day_idx on app.beta_cv_jobs(user_id, started_at);
alter table app.beta_cv_jobs enable row level security;
alter table app.beta_cv_jobs force row level security;
create policy beta_cv_jobs_owner on app.beta_cv_jobs
    for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on app.beta_cv_jobs to authenticated;
