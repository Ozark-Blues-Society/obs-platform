-- Guards for everything in the public schema, which the Data API exposes. A table without row
-- level security, or a view that skips it, lets anyone with the public API key read every row.
-- These cover future tables automatically; each table's own policies still need their own tests.
begin;
select plan(2);

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

select * from finish();
rollback;
