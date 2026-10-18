-- Multi-tenant isolation enforced by the database (Day_1 A2 #1, security plan §1.4).
--  * RLS enabled AND forced on every table (table owner is filtered too).
--  * One policy per verb; USING and WITH CHECK both pin user_id to the caller, so a user
--    can neither read nor write a row as someone else.
--  * anon gets nothing. authenticated gets only the verbs each table needs.
--  * The backend logs in as honne_backend, which owns nothing and can only SET ROLE
--    authenticated. Forgetting the role switch fails with "permission denied", never leaks.

do $$
declare
  t text;
begin
  foreach t in array array['user_accounts', 'personal_profiles', 'cv_uploads',
                           'job_descriptions', 'agent_runs', 'resumes', 'cv_analyses',
                           'usage_events']
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

-- Least-privilege grants. A policy without a grant does nothing, so the grant list is the
-- real allowlist of what a signed-in user can do.
grant select, insert on app.user_accounts to authenticated;
grant update (terms_version, terms_accepted_at) on app.user_accounts to authenticated;  -- not plan

grant select, insert, update, delete on app.personal_profiles to authenticated;
grant select, insert, delete on app.cv_uploads to authenticated;
grant select, insert, delete on app.job_descriptions to authenticated;
grant update (company, role) on app.job_descriptions to authenticated;
grant select, insert on app.agent_runs to authenticated;                -- audit: append-only
grant select, insert, update, delete on app.resumes to authenticated;
grant select, insert, delete on app.cv_analyses to authenticated;
grant select, insert on app.usage_events to authenticated;               -- append-only

grant execute on function app.touch_updated_at() to authenticated;

-- Backend login role. Password is set out of band (never in a migration):
--   alter role honne_backend password '...';
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'honne_backend') then
    create role honne_backend login noinherit;
  end if;
end $$;
grant authenticated to honne_backend;
