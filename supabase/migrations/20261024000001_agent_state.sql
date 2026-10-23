-- Chat memory (Day 3 follow-up): the run state of a chat turn, for LangGraph's
-- AsyncPostgresSaver (langgraph-checkpoint-postgres==3.2.0).
--  * Memory is not kept here: chat history stays in app.chat_messages (RLS, retention,
--    DELETE /me). A checkpoint holds only the turn that is running or failed, so Retry can
--    continue from the last saved step. thread_id = the assistant message's id.
--  * The tables are the saver's own (copied from its MIGRATIONS list, versions 0..9), so its
--    setup() is never run in production. CONCURRENTLY is dropped: the tables are new and a
--    migration runs in a transaction. AgentStateStore checks the version count at startup.
--  * No user_id column (the saver owns the shape). Tenancy: a thread id is only ever a message
--    id the app read through UnitOfWork (RLS) first. The saver connects as honne_backend, the
--    only role with grants here; anon/authenticated get nothing.
--  * Clean-up is done by the database: a trigger on app.chat_messages deletes a turn's
--    checkpoints when the message turns 'ok' or is deleted (chat delete, DELETE /me cascade,
--    the janitor's chat purge). app.janitor_purge_agent_state sweeps any orphan (F5).

create schema agent_state;
revoke all on schema agent_state from public, anon, authenticated;
grant usage on schema agent_state to honne_backend;

create table agent_state.checkpoint_migrations (
  v integer primary key
);

create table agent_state.checkpoints (
  thread_id text not null,
  checkpoint_ns text not null default '',
  checkpoint_id text not null,
  parent_checkpoint_id text,
  type text,
  checkpoint jsonb not null,
  metadata jsonb not null default '{}',
  primary key (thread_id, checkpoint_ns, checkpoint_id)
);

create table agent_state.checkpoint_blobs (
  thread_id text not null,
  checkpoint_ns text not null default '',
  channel text not null,
  version text not null,
  type text not null,
  blob bytea,
  primary key (thread_id, checkpoint_ns, channel, version)
);

create table agent_state.checkpoint_writes (
  thread_id text not null,
  checkpoint_ns text not null default '',
  checkpoint_id text not null,
  task_id text not null,
  idx integer not null,
  channel text not null,
  type text,
  blob bytea not null,
  task_path text not null default '',
  primary key (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);

create index checkpoints_thread_id_idx on agent_state.checkpoints (thread_id);
create index checkpoint_blobs_thread_id_idx on agent_state.checkpoint_blobs (thread_id);
create index checkpoint_writes_thread_id_idx on agent_state.checkpoint_writes (thread_id);

-- Every saver migration (0..9) is in the tables above.
insert into agent_state.checkpoint_migrations (v)
  select generate_series(0, 9);

do $$
declare
  t text;
begin
  foreach t in array array['checkpoint_migrations', 'checkpoints', 'checkpoint_blobs',
                           'checkpoint_writes']
  loop
    execute format('alter table agent_state.%I enable row level security', t);
    execute format('alter table agent_state.%I force row level security', t);
    execute format('revoke all on agent_state.%I from public, anon, authenticated', t);
    execute format($p$create policy %I on agent_state.%I for all to honne_backend
                      using (true) with check (true)$p$, t || '_backend', t);
  end loop;
end $$;

grant select on agent_state.checkpoint_migrations to honne_backend;
grant select, insert, update, delete
  on agent_state.checkpoints, agent_state.checkpoint_blobs, agent_state.checkpoint_writes
  to honne_backend;

-- ---------- clean-up ----------

create function app.drop_agent_state(p_thread text)
returns void
language plpgsql security definer set search_path = '' set row_security = off as $$
begin
  delete from agent_state.checkpoint_writes where thread_id = p_thread;
  delete from agent_state.checkpoint_blobs where thread_id = p_thread;
  delete from agent_state.checkpoints where thread_id = p_thread;
end $$;
revoke all on function app.drop_agent_state(text) from public, anon, authenticated;

-- A finished or deleted turn keeps no run state. O(rows of that thread), by index.
create function app.chat_messages_drop_agent_state()
returns trigger
language plpgsql security definer set search_path = '' set row_security = off as $$
begin
  if old.role = 'assistant' then
    perform app.drop_agent_state(old.id::text);
  end if;
  return null;
end $$;
revoke all on function app.chat_messages_drop_agent_state() from public, anon, authenticated;

create trigger chat_messages_drop_agent_state_on_delete
  after delete on app.chat_messages
  for each row execute function app.chat_messages_drop_agent_state();

create trigger chat_messages_drop_agent_state_on_ok
  after update of status on app.chat_messages
  for each row when (new.status = 'ok' and old.status <> 'ok')
  execute function app.chat_messages_drop_agent_state();

-- F5: run state whose message is gone or finished (a run that kept writing after its chat
-- was deleted). Up to p_limit threads per call; the janitor calls it daily.
create function app.janitor_purge_agent_state(p_limit integer)
returns integer
language plpgsql security definer set search_path = '' set row_security = off as $$
declare
  t text;
  n integer := 0;
begin
  for t in
    select distinct c.thread_id from agent_state.checkpoints c
     where not exists (select 1 from app.chat_messages m
                        where m.id::text = c.thread_id and m.status <> 'ok')
     limit p_limit
  loop
    perform app.drop_agent_state(t);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function app.janitor_purge_agent_state(integer)
  from public, anon, authenticated;
grant execute on function app.janitor_purge_agent_state(integer) to honne_backend;
