/**
 * Builds supabase/seed.sql from the fixtures. `supabase db reset` loads it after the migrations.
 *
 * The seed loads only tables that exist. When a migration adds one (profiles and user_roles in
 * M-2, listings in K-1), add a section here and run `pnpm fixtures:generate`.
 */
import { fileURLToPath } from "node:url";
import { MEMBERS, type FixtureMember } from "./members.mts";

export const SEED_SQL_PATH = fileURLToPath(new URL("../../supabase/seed.sql", import.meta.url));

/** Every fixture member's password. Local development only; it's published in the README. */
export const FIXTURE_PASSWORD = "obs-local-dev";

/** A single-quoted SQL string literal. */
export function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const HEADER = `-- Generated from scripts/fixtures/ by \`pnpm fixtures:generate\`. Don't edit it by hand.
--
-- LOCAL DEVELOPMENT ONLY. Synthetic people with @example.com addresses, all sharing a password
-- that is published in the README. Never load this into a hosted project.`;

function authUsersSql(members: readonly FixtureMember[]): string {
  const values = members
    .map(
      (m) =>
        `    (${sqlString(m.id)}::uuid, ${sqlString(m.email)}, ${sqlString(m.first)}, ${sqlString(m.last)})`,
    )
    .join(",\n");

  return `-- Fixture members as confirmed email + password sign-ins.
with fixture (id, email, first_name, last_name) as (
  values
${values}
),
fixture_password as materialized (
  select extensions.crypt(${sqlString(FIXTURE_PASSWORD)}, extensions.gen_salt('bf')) as hash
),
new_user as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000'::uuid, f.id, 'authenticated', 'authenticated',
    f.email, p.hash, now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('first_name', f.first_name, 'last_name', f.last_name),
    now(), now(),
    -- Supabase Auth reads these token columns as strings and fails on NULL.
    '', '', '', ''
  from fixture f cross join fixture_password p
  returning id, email
)
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
select
  u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now()
from new_user u;`;
}

export function buildSeedSql(members: readonly FixtureMember[] = MEMBERS): string {
  return `${HEADER}\n\n${authUsersSql(members)}\n`;
}
