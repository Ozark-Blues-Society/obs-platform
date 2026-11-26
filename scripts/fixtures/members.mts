/**
 * Synthetic members for local development and tests. These are not real people: every email
 * address is @example.com and every phone number is in the 555-01xx range reserved for fiction.
 *
 * Dates are relative to "now" (days from now), so the data stays consistent whenever it's loaded.
 */

/** Membership levels (docs/spec/board-decisions.md §1). There are no family memberships (§2). */
export const LEVELS = ["individual", "band", "business", "sponsor"] as const;
export type Level = (typeof LEVELS)[number];

export const STATUSES = ["active", "expiring", "lapsed"] as const;
export type Status = (typeof STATUSES)[number];

/** Staff roles (user_roles in docs/spec/architecture.md). */
export const ROLES = ["admin", "membership_manager", "moderator", "editor"] as const;
export type Role = (typeof ROLES)[number];

/**
 * Fixture convention: a membership is "expiring" when it ends within this many days, matching the
 * first renewal reminder. Zero or fewer days left means "lapsed" (there's no grace period, §4).
 * M-2 and E-2 own the real rule.
 */
export const EXPIRING_WITHIN_DAYS = 30;

export interface FixtureMember {
  /** Becomes auth.users.id, and profiles.id once M-2 adds profiles. */
  id: string;
  first: string;
  last: string;
  email: string;
  phone: string | null;
  level: Level;
  status: Status;
  /** Days from now until expires_at. Zero or negative means the membership has lapsed. */
  expiresInDays: number;
  /**
   * Paid years so far. Members renew on their join anniversary (§3), so joined_at is this many
   * years before expires_at.
   */
  years: number;
  autoRenew: boolean;
  roles: readonly Role[];
  notes: string | null;
}

/** Deterministic UUIDs in v4 format. kind: 1 = members, 2 = listings. */
export function fixtureUuid(kind: number, n: number): string {
  return `00000000-0000-4000-8${kind}00-${String(n).padStart(12, "0")}`;
}

type Row = [
  first: string,
  last: string,
  level: Level,
  status: Status,
  expiresInDays: number,
  years: number,
  autoRenew?: boolean,
  roles?: Role[],
  notes?: string,
];

// The edge cases are deliberate: reminder days (30 and 7 days left), the window boundary (31),
// auto-renewers close to expiry, the win-back email day (14 days lapsed), a brand-new member
// (joined yesterday), an apostrophe in a name, and notes that need quoting in a CSV export.
const ROWS: Row[] = [
  ["Avery", "Collins", "individual", "active", 280, 6, true, ["admin"]],
  ["Jordan", "Ellis", "individual", "active", 145, 4, false, ["membership_manager"]],
  ["Morgan", "Hale", "individual", "active", 200, 3, false, ["editor"]],
  ["Casey", "Brooks", "individual", "active", 364, 1],
  ["Robin", "Fields", "individual", "active", 31, 2],
  ["Jesse", "Carter", "individual", "active", 90, 5, true],
  ["Terry", "Mills", "individual", "active", 120, 2],
  ["Glen", "Pruitt", "individual", "active", 240, 8, false, [], "Paid by check at the door."],
  ["June", "Little", "individual", "active", 60, 1],
  ["Shannon", "O'Neal", "individual", "active", 175, 3],
  ["Bev", "Grant", "individual", "expiring", 30, 4],
  ["Otis", "Ivy", "individual", "expiring", 7, 2],
  ["Rosa", "Delgado", "individual", "expiring", 14, 9, true],
  ["Lena", "Park", "individual", "lapsed", -14, 1],
  ["Wes", "Turner", "individual", "lapsed", -45, 3],
  ["Nora", "Quinn", "individual", "lapsed", -400, 2],
  ["Dale", "Ramsey", "band", "active", 150, 4, false, ["moderator"]],
  ["Tasha", "Moore", "band", "active", 220, 7, true, [], 'Books "Night Owls", a trio.'],
  ["Marcus", "Lane", "band", "active", 75, 2],
  ["Ruth", "Abbott", "band", "active", 310, 5],
  ["Chris", "Price", "band", "active", 45, 3],
  ["Pat", "Walsh", "band", "active", 330, 1],
  ["Ray", "Booker", "band", "expiring", 21, 6],
  ["Eddie", "Vance", "band", "expiring", 3, 2],
  ["Mae", "Whitfield", "band", "lapsed", -1, 4],
  ["Cole", "Barrett", "band", "lapsed", -120, 2],
  ["Grace", "Holloway", "business", "active", 190, 5, true],
  ["Victor", "Nash", "business", "active", 100, 3],
  ["Irene", "Coleman", "business", "active", 255, 2],
  ["Frank", "Delaney", "business", "active", 40, 6],
  ["Hazel", "Monroe", "business", "active", 350, 1],
  ["Leon", "Pierce", "business", "expiring", 29, 4],
  ["Doris", "Kemp", "business", "expiring", 7, 3, true],
  ["Walt", "Ferris", "business", "lapsed", -15, 5],
  ["Margaret", "Sloan", "sponsor", "active", 270, 8, true],
  ["Curtis", "Bell", "sponsor", "active", 160, 3],
  ["Elaine", "Foster", "sponsor", "active", 85, 2, true],
  ["Russell", "Boyd", "sponsor", "active", 300, 4],
  ["Vera", "Lindqvist", "sponsor", "expiring", 1, 5],
  ["Howard", "Keene", "sponsor", "lapsed", -200, 3],
];

const emailPart = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "");

export const MEMBERS: readonly FixtureMember[] = ROWS.map(
  ([first, last, level, status, expiresInDays, years, autoRenew = false, roles = [], notes], i) => {
    const n = i + 1;
    return {
      id: fixtureUuid(1, n),
      first,
      last,
      email: `${emailPart(first)}.${emailPart(last)}@example.com`,
      // Every fifth member left the phone number blank.
      phone: n % 5 === 0 ? null : `(479) 555-01${String(n).padStart(2, "0")}`,
      level,
      status,
      expiresInDays,
      years,
      autoRenew,
      roles,
      notes: notes ?? null,
    };
  },
);

export function memberByEmail(email: string): FixtureMember {
  const member = MEMBERS.find((m) => m.email === email);
  if (!member) throw new Error(`No fixture member with the email ${email}`);
  return member;
}
