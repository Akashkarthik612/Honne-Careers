-- Day 3: custom career agents + chat (CUST-1..7, PLAN-2).
--  * chat_agents: one row per user-made agent (identity, handle, current version). Delete =
--    archive, so old chats keep their agent; the handle is free again once archived.
--  * chat_agent_versions: the agent's config, one immutable row per edit (as in Dust's
--    agent_configurations). Old chat messages point at the version that answered them.
--  * chats / chat_messages: chat history. An assistant message is the background job of one
--    turn: running -> ok | failed, with live steps (like resumes.job_step for the tailor job).
--    At most one running turn per chat (partial unique index), so two tabs can't overlap.
--  * Retention: chats are deleted APPLICATION_RETENTION_DAYS after they were *created*, so a
--    chat never keeps a JD it quoted longer than the Database keeps the JD itself.
--  * Built-in agents (@analyst, @advisor) are config files in the API, not rows here.

create table app.chat_agents (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references app.user_accounts (user_id) on delete cascade,
  handle           text not null check (handle ~ '^[a-z0-9][a-z0-9-]{1,29}$'),
  current_version  integer not null default 1 check (current_version >= 1),
  archived_at      timestamptz,
  row_version      integer not null default 1 check (row_version >= 1),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, id)
);
create unique index chat_agents_active_handle on app.chat_agents (user_id, handle)
  where archived_at is null;
create trigger chat_agents_touch before update on app.chat_agents
  for each row execute function app.touch_updated_at();

create table app.chat_agent_versions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app.user_accounts (user_id) on delete cascade,
  agent_id      uuid not null,
  version       integer not null check (version >= 1),
  description   text not null check (char_length(description) between 1 and 140),
  instructions  text not null check (char_length(instructions) between 1 and 4000),
  guardrails    text not null default '' check (char_length(guardrails) <= 1000),
  knowledge     text[] not null
                check (cardinality(knowledge) >= 1
                       and knowledge <@ array['profile', 'resumes', 'applications']),
  created_at    timestamptz not null default now(),
  unique (agent_id, version),
  unique (user_id, id),
  foreign key (user_id, agent_id) references app.chat_agents (user_id, id) on delete cascade
);

create table app.chats (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references app.user_accounts (user_id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 80),
  turn_count       integer not null default 0 check (turn_count >= 0),
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  unique (user_id, id)
);
create index chats_user_idx on app.chats (user_id, last_message_at desc);
create index chats_expiry_idx on app.chats (created_at);  -- daily clean-up

create table app.chat_messages (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references app.user_accounts (user_id) on delete cascade,
  chat_id           uuid not null,
  seq               integer not null check (seq >= 1),
  role              text not null check (role in ('user', 'assistant')),
  status            text not null default 'ok' check (status in ('running', 'ok', 'failed')),
  content           text not null default '' check (char_length(content) <= 20000),
  agent_handle      text check (agent_handle ~ '^[a-z0-9][a-z0-9-]{1,29}$'),
  agent_kind        text check (agent_kind in ('user', 'builtin')),
  agent_version_id  uuid,          -- user agents: the version that answered
  builtin_version   integer,       -- built-in agents: their config version
  sources           jsonb not null default '[]' check (pg_column_size(sources) <= 65536),
  drafts            jsonb not null default '[]' check (pg_column_size(drafts) <= 65536),
  steps             jsonb not null default '[]' check (pg_column_size(steps) <= 16384),
  error_code        text check (char_length(error_code) <= 64),
  started_at        timestamptz,
  finished_at       timestamptz,
  created_at        timestamptz not null default now(),
  unique (chat_id, seq),
  check (role = 'user' or agent_handle is not null),
  foreign key (user_id, chat_id) references app.chats (user_id, id) on delete cascade,
  -- An archived agent's versions stay; a deleted account removes both via user_accounts.
  foreign key (user_id, agent_version_id) references app.chat_agent_versions (user_id, id)
);
create index chat_messages_chat_idx on app.chat_messages (chat_id, seq);
create unique index chat_messages_one_running on app.chat_messages (chat_id)
  where status = 'running';

-- Chat turns count against their own daily limit (PLAN-2), Try-it included.
alter table app.usage_events drop constraint usage_events_action_check;
alter table app.usage_events add constraint usage_events_action_check
  check (action in ('full_tailor', 'bullet_tailor', 'pdf', 'analysis', 'upload',
                    'chat_message'));

-- Day_3 §3.1: every turn records which tools it called (names only, never arguments).
alter table app.agent_runs
  add column tool_calls integer check (tool_calls >= 0),
  add column tool_names text[] check (cardinality(tool_names) <= 32);

-- Same isolation as every other table (20261018000002).
do $$
declare
  t text;
begin
  foreach t in array array['chat_agents', 'chat_agent_versions', 'chats', 'chat_messages']
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

grant select, insert on app.chat_agents to authenticated;
grant update (handle, current_version, archived_at, row_version)
  on app.chat_agents to authenticated;                               -- rename: old messages
                                                                     -- keep their snapshot
grant select, insert on app.chat_agent_versions to authenticated;    -- versions: append-only
grant select, insert, delete on app.chats to authenticated;
grant update (title, turn_count, last_message_at) on app.chats to authenticated;
grant select, insert on app.chat_messages to authenticated;
grant update (status, content, sources, drafts, steps, error_code, started_at, finished_at)
  on app.chat_messages to authenticated;                             -- the turn job only

-- ---------- daily clean-up (SECURITY DEFINER, honne_backend only) ----------
-- Same guard as the application janitor: refuses a cut-off newer than one day.

create function app.janitor_purge_chats(p_cutoff timestamptz, p_limit integer)
returns integer
language plpgsql security definer set search_path = '' set row_security = off as $$
declare
  n integer;
begin
  if p_cutoff > now() - interval '1 day' then
    raise exception 'cut-off too recent: %', p_cutoff;
  end if;
  delete from app.chats c
   where c.id in (select x.id from app.chats x where x.created_at < p_cutoff
                   order by x.created_at limit p_limit);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function app.janitor_purge_chats(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function app.janitor_purge_chats(timestamptz, integer) to honne_backend;
