/**
 * Builds supabase/seed.sql from the fixtures. `supabase db reset` loads it after the migrations.
 *
 * The seed loads only tables that exist. When a migration adds one, add a section here and run
 * `pnpm fixtures:generate`.
 */
import { fileURLToPath } from "node:url";
import { ZEFFY_LEVEL_MAPPING, type ZeffyLevelMapping } from "../../lib/zeffy/level-mapping.ts";
import { LISTING_DAYS, LISTINGS, type FixtureListing, type ListingCategory } from "./listings.mts";
import { MEMBERS, type FixtureMember } from "./members.mts";

export const SEED_SQL_PATH = fileURLToPath(new URL("../../supabase/seed.sql", import.meta.url));

/** Every fixture member's password. Local development only; it's published in the README. */
export const FIXTURE_PASSWORD = "obs-local-dev";

/** A single-quoted SQL string literal. */
export function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/** A single-quoted SQL string literal, or null. */
function sqlStringOrNull(value: string | null): string {
  return value === null ? "null" : sqlString(value);
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

function profilesSql(members: readonly FixtureMember[]): string {
  const values = members
    .map((m) => {
      const columns = [
        `${sqlString(m.id)}::uuid`,
        sqlStringOrNull(m.phone),
        sqlString(m.level),
        sqlString(m.status),
        m.expiresInDays,
        m.years,
        m.autoRenew,
        sqlStringOrNull(m.notes),
      ];
      return `    (${columns.join(", ")})`;
    })
    .join(",\n");

  return `-- Membership details. The sign-up trigger (supabase/migrations/) created each member's profile
-- above, with their address and names; joined_at is the given number of years before expires_at.
update public.profiles p
set
  phone = f.phone,
  level = f.level::public.membership_level,
  status = f.status::public.membership_status,
  expires_at = now() + make_interval(days => f.expires_in_days),
  joined_at = now() + make_interval(days => f.expires_in_days) - make_interval(years => f.years),
  auto_renew = f.auto_renew,
  notes = f.notes
from (
  values
${values}
) as f (id, phone, level, status, expires_in_days, years, auto_renew, notes)
where p.id = f.id;`;
}

function userRolesSql(members: readonly FixtureMember[]): string {
  const values = members
    .flatMap((m) => m.roles.map((role) => `  (${sqlString(m.id)}::uuid, ${sqlString(role)})`))
    .join(",\n");

  return `-- Staff roles.
insert into public.user_roles (profile_id, role)
values
${values};`;
}

/** Marks the start of the Zeffy level mapping, which can be loaded on its own (see the README). */
export const ZEFFY_LEVEL_MAPPING_SECTION_START = "-- Zeffy level mapping.";

function zeffyLevelMappingSql(mappings: readonly ZeffyLevelMapping[]): string {
  const values = mappings
    .map((m) => `  (${sqlString(m.campaignId)}, ${sqlString(m.rateId)}, ${sqlString(m.level)})`)
    .join(",\n");

  return `${ZEFFY_LEVEL_MAPPING_SECTION_START} The membership form's rates, from lib/zeffy/level-mapping.ts, with
-- synthetic ids. Loading it again changes nothing.
insert into public.zeffy_level_mappings (campaign_id, rate_id, level)
values
${values}
on conflict (campaign_id, rate_id) do nothing;`;
}

/** The listings table's value for a fixture category: "Musicians Wanted" is musicians_wanted. */
export function listingCategoryValue(category: ListingCategory): string {
  return category.toLowerCase().replaceAll(" ", "_");
}

/** Marks the start of the listings section, which can be loaded on its own (see the README). */
export const LISTINGS_SECTION_START = "-- Classifieds listings.";

function listingsSql(listings: readonly FixtureListing[]): string {
  const values = listings
    .map((l) => {
      const columns = [
        `${sqlString(l.id)}::uuid`,
        `${sqlString(l.profileId)}::uuid`,
        sqlString(listingCategoryValue(l.category)),
        sqlString(l.title),
        sqlString(l.body),
        l.price ?? "null",
        sqlString(l.contactPref),
        sqlString(l.status),
        sqlStringOrNull(l.rejectReason),
        l.createdDaysAgo,
        l.approvedDaysAgo ?? "null",
      ];
      return `    (${columns.join(", ")})`;
    })
    .join(",\n");

  return `${LISTINGS_SECTION_START} Dates are days before now; an approved listing runs ${LISTING_DAYS} days.
-- Loading it again changes nothing.
insert into public.listings (
  id, profile_id, category, title, body, price, contact_pref, status, reject_reason, created_at,
  approved_at, expires_at
)
select
  f.id, f.profile_id, f.category::public.listing_category, f.title, f.body, f.price,
  f.contact_pref::public.listing_contact, f.status::public.listing_status, f.reject_reason,
  now() - make_interval(days => f.created_days_ago),
  now() - make_interval(days => f.approved_days_ago),
  now() - make_interval(days => f.approved_days_ago) + make_interval(days => ${LISTING_DAYS})
from (
  values
${values}
) as f (
  id, profile_id, category, title, body, price, contact_pref, status, reject_reason,
  created_days_ago, approved_days_ago
)
on conflict (id) do nothing;`;
}

export function buildSeedSql(
  members: readonly FixtureMember[] = MEMBERS,
  listings: readonly FixtureListing[] = LISTINGS,
  levelMapping: readonly ZeffyLevelMapping[] = ZEFFY_LEVEL_MAPPING,
): string {
  const sections = [HEADER, authUsersSql(members), profilesSql(members)];
  if (members.some((m) => m.roles.length > 0)) sections.push(userRolesSql(members));
  if (levelMapping.length > 0) sections.push(zeffyLevelMappingSql(levelMapping));
  if (listings.length > 0) sections.push(listingsSql(listings));
  return `${sections.join("\n\n")}\n`;
}
