-- A renewal that commits while the daily job's status refresh is running keeps its status: the race
-- in supabase/migrations/20261126163935_membership_status_from_row.sql (op-04s.8).
--
-- pgTAP runs in one session, and the race needs two, so this test runs it through dblink between
-- two more sessions, in a throwaway database on the same server:
--   - the renewal (the Stripe webhook) renews a member whose membership ended yesterday, holds the
--     row and waits until the refresh is waiting for it, then commits;
--   - the refresh runs refresh_membership_statuses() meanwhile, so it reads the row before the
--     renewal commits and has to re-read it afterwards.
-- Each waits for the other's lock, not for a set time, so the race happens the same way on every
-- run.
--
-- The throwaway database gets copies of the real functions, taken from this database's catalog,
-- and a profiles table with the columns they use. So the race never touches this database's
-- members, and other test runs on the same stack don't see it. It's dropped at the end; one left
-- by an aborted run is dropped by the next run.
begin;
select plan(4);

create extension if not exists dblink with schema extensions;

-- The throwaway database, named after this session.
create function pg_temp.race_database() returns text
language sql
as $$ select 'membership_status_race_' || pg_backend_pid() $$;

-- How the sessions connect to a database on this server: as postgres, with the local stack's
-- password (supabase status prints it in DB_URL). dblink accepts a role that isn't a superuser only
-- on a connection that asked for a password, which this server does on every address but 127.0.0.1
-- and ::1, so they connect to the address this session came in on: supabase test db connects over
-- the stack's Docker network. A statement that hangs fails after 30 seconds.
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
  where datname ~ '^membership_status_race_[0-9]+$'
    and substring(datname from '[0-9]+$')::integer not in (select pid from pg_stat_activity);
  perform extensions.dblink_exec(here, format('create database %I', pg_temp.race_database()));

  perform extensions.dblink_connect('race_setup', pg_temp.connection(pg_temp.race_database()));
  perform extensions.dblink_exec('race_setup', format(
    'create type public.membership_status as enum (%s)',
    (
      select string_agg(quote_literal(enumlabel), ', ' order by enumsortorder)
      from pg_enum
      where enumtypid = 'public.membership_status'::regtype
    )
  ));
  perform extensions.dblink_exec('race_setup', 'create schema private');
  perform extensions.dblink_exec('race_setup', $sql$
    create table public.profiles (
      id integer primary key,
      expires_at timestamptz,
      status public.membership_status
    )
  $sql$);
  perform extensions.dblink_exec('race_setup', pg_get_functiondef(
    'private.membership_status_at(timestamptz, timestamptz)'::regprocedure
  ));
  perform extensions.dblink_exec('race_setup', pg_get_functiondef(
    'public.refresh_membership_statuses(timestamptz)'::regprocedure
  ));
  -- The refresh runs on June 15, 2031 (as in membership_emails_test.sql). Both memberships ended
  -- yesterday and still show as expiring; member 1 renews while the refresh runs.
  perform extensions.dblink_exec('race_setup', $sql$
    insert into public.profiles (id, expires_at, status)
    values (1, '2031-06-14 17:00+00', 'expiring'), (2, '2031-06-14 17:00+00', 'expiring')
  $sql$);

  perform extensions.dblink_connect('race_renewal', pg_temp.connection(pg_temp.race_database()));
  perform extensions.dblink_connect('race_refresh', pg_temp.connection(pg_temp.race_database()));
end
$$;

do $$
declare
  renewal_pid constant integer := (
    select pid from extensions.dblink('race_renewal', 'select pg_backend_pid()') as t (pid integer)
  );
  refresh_pid constant integer := (
    select pid from extensions.dblink('race_refresh', 'select pg_backend_pid()') as t (pid integer)
  );
begin
  -- The renewal, in one transaction: renew member 1 for a year, take an advisory lock to show the
  -- row is held, wait until the refresh is waiting for a lock (giving up after 10 seconds), commit.
  perform extensions.dblink_send_query('race_renewal', format($sql$
    do $renewal$
    begin
      update public.profiles
      set expires_at = '2032-06-14 17:00+00', status = 'active'
      where id = 1;
      perform pg_advisory_xact_lock(1);
      for attempt in 1..1000 loop
        exit when exists (select from pg_locks where pid = %1$s and not granted);
        perform pg_sleep(0.01);
      end loop;
      if not exists (select from pg_locks where pid = %1$s and not granted) then
        raise exception 'the refresh never waited for the renewal';
      end if;
    end
    $renewal$
  $sql$, refresh_pid));

  -- Start the refresh once the renewal holds the row.
  for attempt in 1..1000 loop
    exit when exists (
      select from pg_locks where pid = renewal_pid and locktype = 'advisory' and granted
    );
    perform pg_sleep(0.01);
  end loop;
  perform extensions.dblink_send_query('race_refresh', $sql$
    select new_status::text || ' ' || members
    from public.refresh_membership_statuses('2031-06-15 13:00+00')
  $sql$);
end
$$;

-- The renewal's result comes first: it commits once the refresh is waiting for its row.

select is(
  (select status from extensions.dblink_get_result('race_renewal', false) as t (status text)),
  'DO',
  'the renewal commits while the refresh is waiting for the row it read before the renewal'
);

select is(
  (
    select array_agg(changed)
    from extensions.dblink_get_result('race_refresh', false) as t (changed text)
  ),
  array['lapsed 1'],
  'the refresh moves only the membership that wasn''t renewed'
);

select is(
  (
    select status
    from extensions.dblink(
      'race_setup', 'select status::text from public.profiles where id = 1'
    ) as t (status text)
  ),
  'active',
  'the renewed member stays active: the refresh works the status out from the row it updates, so '
    || 'a row re-read after a renewal gets the status of its new expiry'
);

select is(
  (
    select status
    from extensions.dblink(
      'race_setup', 'select status::text from public.profiles where id = 2'
    ) as t (status text)
  ),
  'lapsed',
  'a membership that ended yesterday still lapses in the same run'
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
