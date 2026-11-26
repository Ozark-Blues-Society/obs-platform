-- Guards for everything in the public schema, which the Data API exposes. A table without row
-- level security, a view that skips it, or a relation that can't have it (a materialized view or
-- a foreign table) lets anyone with the public API key read every row. A SECURITY DEFINER
-- function there can do the same: anyone with that key can call it, and it skips row level
-- security. These cover future tables and functions automatically; each table's own policies
-- still need their own tests.
begin;
select plan(4);

select is_empty(
  $$
    select c.oid::regclass::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  $$,
  'every table in public has row level security enabled'
);

-- Views run with their owner's rights unless security_invoker is on, which bypasses RLS.
select is_empty(
  $$
    select c.oid::regclass::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and not exists (
        select 1
        from unnest(c.reloptions) as opt
        where split_part(opt, '=', 1) = 'security_invoker' and split_part(opt, '=', 2)::boolean
      )
  $$,
  'every view in public has security_invoker on, so row level security applies'
);

-- Postgres can't put row level security or security_invoker on materialized views or foreign
-- tables, and Supabase's default privileges let anon and authenticated select from new objects in
-- public. Supabase's database linter flags them as materialized_view_in_api and
-- foreign_table_in_api.
select is_empty(
  $$
    select c.oid::regclass::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('m', 'f')
  $$,
  'public has no materialized views or foreign tables, which row level security cannot cover: '
    || 'put each in a schema the API does not expose, or replace it with a security_invoker view '
    || 'or a function that checks the caller'
);

-- PostgREST serves every function in public at /rest/v1/rpc/<name>. A SECURITY DEFINER function
-- runs as its owner, postgres for anything a migration creates, and row level security doesn't
-- apply to postgres (it owns the tables and has BYPASSRLS). Supabase's default privileges let anon
-- and authenticated execute new functions in public, and revoking execute from public leaves those
-- grants in place. So this checks the schema, not the grants: a later grant can undo a revoke, but
-- it can't expose a schema the API doesn't serve. Trigger functions are left out: Postgres runs
-- them only as triggers, so the API can't call them. Supabase's database linter has a version
-- that goes by the grants: anon_ and authenticated_security_definer_function_executable.
select is_empty(
  $$
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
  $$,
  'public has no SECURITY DEFINER functions apart from trigger functions, since anyone with the '
    || 'public API key could call them and they skip row level security: move each to a schema '
    || 'the API does not expose, such as private, or make it SECURITY INVOKER'
);

select * from finish();
rollback;
