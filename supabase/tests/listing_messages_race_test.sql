-- Two messages sent at the same moment can't both slip under a daily limit: the race the lock in
-- record_listing_message() (supabase/migrations/20261127195203_listing_messages.sql) is there for
-- (backlog K-3, decision 0009). listing_messages_test.sql shows the lock is taken; this shows it is
-- taken before the counts, so a message being recorded counts against the next one.
--
-- pgTAP runs in one session, and the race needs two, so this test runs it through dblink between
-- two more sessions, in a throwaway database on the same server, as membership_status_race_test.sql
-- does. Under a limit of one message a day, from the same email address:
--   - the first message is recorded, then its transaction stays open until the second is waiting
--     for a lock, and commits;
--   - the second starts while the first is still open, so if it counted before taking the lock, it
--     would find no message yet and be recorded too.
-- Each waits for the other's lock, not for a set time, so the race happens the same way on every
-- run.
--
-- The throwaway database gets a copy of the real function, taken from this database's catalog, and
-- listings and listing_messages tables with the columns it uses. So the race never touches this
-- database's listings, and other test runs on the same stack don't see it. It's dropped at the end;
-- one left by an aborted run is dropped by the next run.
begin;
select plan(3);

create extension if not exists dblink with schema extensions;

-- The throwaway database, named after this session.
create function pg_temp.race_database() returns text
language sql
as $$ select 'listing_messages_race_' || pg_backend_pid() $$;

-- How the sessions connect to a database on this server, as in membership_status_race_test.sql: as
-- postgres with the local stack's password, to the address this session came in on (dblink accepts
-- a role that isn't a superuser only on a connection that asked for a password). A statement that
-- hangs fails after 30 seconds.
create function pg_temp.connection(database text) returns text
language sql
as $$
  select format(
    'host=%s port=%s dbname=%s user=postgres password=postgres '
      || 'options=''-c statement_timeout=30s''',
    host(inet_server_addr()), inet_server_port(), database
  )
$$;

do $$
declare
  here constant text := pg_temp.connection(current_database());
begin
  -- Throwaway databases of aborted runs: their sessions are gone.
  perform extensions.dblink_exec(here, format('drop database %I with (force)', datname))
  from pg_database
  where datname ~ '^listing_messages_race_[0-9]+$'
    and substring(datname from '[0-9]+$')::integer not in (select pid from pg_stat_activity);
  perform extensions.dblink_exec(here, format('create database %I', pg_temp.race_database()));

  perform extensions.dblink_connect('race_setup', pg_temp.connection(pg_temp.race_database()));
  perform extensions.dblink_exec('race_setup', format(
    'create type public.listing_status as enum (%s)',
    (
      select string_agg(quote_literal(enumlabel), ', ' order by enumsortorder)
      from pg_enum
      where enumtypid = 'public.listing_status'::regtype
    )
  ));
  perform extensions.dblink_exec('race_setup', $sql$
    create table public.listings (
      id uuid primary key,
      status public.listing_status not null,
      expires_at timestamptz
    )
  $sql$);
  perform extensions.dblink_exec('race_setup', $sql$
    create table public.listing_messages (
      id bigint generated always as identity primary key,
      listing_id uuid not null,
      sender_email_hash text not null,
      sender_ip_hash text not null,
      sent_at timestamptz not null default now()
    )
  $sql$);
  perform extensions.dblink_exec('race_setup', pg_get_functiondef(
    'public.record_listing_message(uuid, text, text, integer, integer)'::regprocedure
  ));
  -- The second message, from the same email address on another network: 'recorded', or the error
  -- code that refused it.
  perform extensions.dblink_exec('race_setup', $sql$
    create function public.second_message() returns text
    language plpgsql
    as $function$
    begin
      perform public.record_listing_message(
        '00000000-0000-4000-8990-000000000001', repeat('a', 64), repeat('2', 64), 1, 20
      );
      return 'recorded';
    exception
      when others then return sqlstate;
    end
    $function$
  $sql$);
  perform extensions.dblink_exec('race_setup', $sql$
    insert into public.listings (id, status, expires_at)
    values ('00000000-0000-4000-8990-000000000001', 'live', now() + interval '30 days')
  $sql$);

  perform extensions.dblink_connect('race_first', pg_temp.connection(pg_temp.race_database()));
  perform extensions.dblink_connect('race_second', pg_temp.connection(pg_temp.race_database()));
end
$$;

do $$
declare
  first_pid constant integer := (
    select pid from extensions.dblink('race_first', 'select pg_backend_pid()') as t (pid integer)
  );
  second_pid constant integer := (
    select pid from extensions.dblink('race_second', 'select pg_backend_pid()') as t (pid integer)
  );
begin
  -- The first message, in one transaction: record it, which takes the messages' lock, wait until
  -- the second is waiting for a lock (giving up after 10 seconds), commit.
  perform extensions.dblink_send_query('race_first', format($sql$
    do $first$
    begin
      perform public.record_listing_message(
        '00000000-0000-4000-8990-000000000001', repeat('a', 64), repeat('1', 64), 1, 20
      );
      for attempt in 1..1000 loop
        exit when exists (select from pg_locks where pid = %1$s and not granted);
        perform pg_sleep(0.01);
      end loop;
      if not exists (select from pg_locks where pid = %1$s and not granted) then
        raise exception 'the second message never waited for the first';
      end if;
    end
    $first$
  $sql$, second_pid));

  -- Send the second once the first holds the lock.
  for attempt in 1..1000 loop
    exit when exists (
      select from pg_locks where pid = first_pid and locktype = 'advisory' and granted
    );
    perform pg_sleep(0.01);
  end loop;
  perform extensions.dblink_send_query('race_second', 'select public.second_message()');
end
$$;

-- The first message's result comes first: it commits once the second is waiting for its lock.

select is(
  (select status from extensions.dblink_get_result('race_first', false) as t (status text)),
  'DO',
  'the first message is recorded and commits while the second waits for its lock'
);

select is(
  (select outcome from extensions.dblink_get_result('race_second', false) as t (outcome text)),
  'OB201',
  'the second message, sent before the first committed, counts it once it has the lock: past the '
    || 'sender''s limit, it''s refused'
);

select is(
  (
    select messages
    from extensions.dblink(
      'race_setup', 'select count(*)::integer from public.listing_messages'
    ) as t (messages integer)
  ),
  1,
  'one message is recorded under a limit of one, not two'
);

do $$
begin
  perform extensions.dblink_disconnect(name)
  from unnest(extensions.dblink_get_connections()) as name;
  perform extensions.dblink_exec(
    pg_temp.connection(current_database()),
    format('drop database %I with (force)', pg_temp.race_database())
  );
end
$$;

select * from finish();
rollback;
