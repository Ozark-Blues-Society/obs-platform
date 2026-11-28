/**
 * The synthetic Sanity fixtures (./events.mts) as documents of C-1's content model
 * (sanity/schemas/documents/), and the import that writes them to a development dataset (bead
 * op-4nd.1). `pnpm fixtures:sanity` runs it (./sanity-import.mts).
 *
 * - Each fixture venue becomes a public venue (name, address, map link) and a members-only
 *   directoryEntry with the rest (`<venue id>-directory`).
 * - Each fixture event becomes an event. Its start is `startsInDays` days after today's date in
 *   Central Time, at `startTime` there, stored in UTC; a repeat runs until the date `untilInDays`
 *   days after today.
 * - One sponsorTier, "Sponsor" (board-decisions §8).
 * - Site settings (the singleton siteSettings), with the benefits table from board-decisions §1.
 *   It's created only if it doesn't exist yet, so a rerun never undoes an editor's changes.
 *
 * Everything else is written with createOrReplace under its fixture id, never as a copy. The import
 * reads what's stored first and writes only the documents that differ, so a rerun on the same day
 * changes nothing, and a rerun on a later day moves the dates along. Drafts are left alone.
 * Only synthetic content goes here: never real people's data.
 *
 * Imports name their files in full (".ts"): Node runs this file directly.
 */
import { isoDate, societyInstant, societyWallClock } from "../../lib/society-time.ts";
import { BOARD_BENEFITS } from "../../sanity/schemas/board-benefits.ts";
import { EVENTS, VENUES, type FixtureEvent, type FixtureVenue } from "./events.mts";

/** The only dataset the fixtures may go into (decision 0012: the factory's development project). */
export const FIXTURE_DATASET = "development";

const SPONSOR_TIER_ID = "fixture-sponsor-tier";
const SITE_SETTINGS_ID = "siteSettings";

/** A document as the import writes it: Sanity adds _rev, _createdAt and _updatedAt. */
export type FixtureDocument = { _id: string; _type: string } & Record<string, unknown>;

export type FixtureMutation =
  { createOrReplace: FixtureDocument } | { createIfNotExists: FixtureDocument };

type Day = { year: number; month: number; day: number };

/** The date `days` days after `today` (before it, for a negative number), as "2026-11-27". */
function dateAfter(today: Day, days: number): string {
  const date = new Date(Date.UTC(today.year, today.month - 1, today.day + days));
  return isoDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

/**
 * A web address made from a title, like the Studio's Generate button: "Members' Jam & Social"
 * gives "members-jam-and-social".
 */
export function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 96)
    .replace(/^-+|-+$/g, "");
}

const reference = (id: string) => ({ _type: "reference", _ref: id });

/** One Portable Text paragraph, as rich text fields store it. */
function paragraph(text: string) {
  return [
    {
      _type: "block",
      _key: "body",
      style: "normal",
      markDefs: [],
      children: [{ _type: "span", _key: "body-text", text, marks: [] }],
    },
  ];
}

/** Leaves out fields with no value, as the Studio does, rather than storing null. */
function present<T extends Record<string, unknown>>(fields: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== null && value !== undefined),
  ) as Partial<T>;
}

export function directoryEntryId(venueId: string): string {
  return `${venueId}-directory`;
}

function venueDocuments(venue: FixtureVenue): FixtureDocument[] {
  return [
    {
      _id: venue.id,
      _type: "venue",
      name: venue.name,
      address: venue.address,
      mapUrl: venue.mapUrl,
    },
    {
      _id: directoryEntryId(venue.id),
      _type: "directoryEntry",
      venue: reference(venue.id),
      ...present({ capacity: venue.capacity, pay: venue.pay, notes: venue.notes }),
      bookingContact: present({
        name: venue.booking.contact,
        email: venue.booking.email,
        phone: venue.booking.phone,
      }),
    },
  ];
}

function eventDocument(event: FixtureEvent, today: Day): FixtureDocument {
  const [hour, minute] = event.startTime.split(":").map(Number);
  const start = societyInstant({ ...today, day: today.day + event.startsInDays, hour, minute });
  return {
    _id: event.id,
    _type: "event",
    title: event.title,
    slug: { _type: "slug", current: slugFromTitle(event.title) },
    start: start.toISOString(),
    recurrence: event.recurrence
      ? {
          frequency: event.recurrence.frequency,
          until: dateAfter(today, event.recurrence.untilInDays),
        }
      : { frequency: "none" },
    ...present({ venue: event.venueId === null ? null : reference(event.venueId) }),
    category: event.category.toLowerCase(),
    priceText: event.priceText,
    ...present({ memberPrice: event.memberPrice }),
    visibility: { _type: "visibility", audience: event.membersOnly ? "members" : "everyone" },
    body: paragraph(event.body),
  };
}

/** Every fixture document, with dates counted from `now`'s date in Central Time. */
export function fixtureDocuments(now: Date): {
  fixtures: FixtureDocument[];
  siteSettings: FixtureDocument;
} {
  const { year, month, day } = societyWallClock(now);
  const today = { year, month, day };
  return {
    fixtures: [
      ...VENUES.flatMap(venueDocuments),
      ...EVENTS.map((event) => eventDocument(event, today)),
      {
        _id: SPONSOR_TIER_ID,
        _type: "sponsorTier",
        name: "Sponsor",
        pricePerYear: 500,
        logoPlacement: "large",
        sortOrder: 1,
      },
    ],
    siteSettings: {
      _id: SITE_SETTINGS_ID,
      _type: "siteSettings",
      membershipBenefits: BOARD_BENEFITS,
    },
  };
}

/** Every fixture mutation, in transaction order: venues first, as events refer to them. */
export function fixtureMutations(now: Date): FixtureMutation[] {
  const { fixtures, siteSettings } = fixtureDocuments(now);
  return [
    ...fixtures.map((document) => ({ createOrReplace: document })),
    { createIfNotExists: siteSettings },
  ];
}

const mutationDocument = (mutation: FixtureMutation): FixtureDocument =>
  "createOrReplace" in mutation ? mutation.createOrReplace : mutation.createIfNotExists;

/** Fields the Content Lake sets on every document it stores. */
const SYSTEM_FIELDS = new Set(["_rev", "_createdAt", "_updatedAt"]);

/** Whether two JSON values are equal, whatever the order of their objects' keys. */
function sameJson(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => sameJson(item, b[index]))
    );
  }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every(
        (key) =>
          Object.hasOwn(b, key) &&
          sameJson((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
      )
    );
  }
  return a === b;
}

/**
 * The mutations still needed, given the stored documents with the fixtures' ids. Sanity gives a
 * document a new revision on every createOrReplace, even an identical one, so the import leaves
 * out documents that already match, and Site settings once it exists.
 */
export function pendingMutations(
  mutations: FixtureMutation[],
  stored: readonly Record<string, unknown>[],
): FixtureMutation[] {
  const storedById = new Map(stored.map((document) => [document._id, document]));
  return mutations.filter((mutation) => {
    const document = mutationDocument(mutation);
    const current = storedById.get(document._id);
    if (!current) return true;
    if ("createIfNotExists" in mutation) return false;
    const content = Object.fromEntries(
      Object.entries(current).filter(([key]) => !SYSTEM_FIELDS.has(key)),
    );
    return !sameJson(content, document);
  });
}

export type ImportOptions = {
  projectId: string;
  dataset: string;
  apiVersion: string;
  /** A token with the Editor role for the project (Viewer tokens can't write). */
  token: string | undefined;
  now?: Date;
  fetch?: typeof fetch;
};

export type ImportResult = { ok: boolean; message: string };

class SanityError extends Error {}

/**
 * Brings the fixture documents in the dataset up to date, in one transaction, and leaves the ones
 * that already match alone. Messages never contain the token.
 */
export async function importSanityFixtures(options: ImportOptions): Promise<ImportResult> {
  const {
    projectId,
    dataset,
    apiVersion,
    token,
    now = new Date(),
    fetch: fetchFn = fetch,
  } = options;
  if (dataset !== FIXTURE_DATASET) {
    return {
      ok: false,
      message: `The fixtures go only into the ${FIXTURE_DATASET} dataset, and NEXT_PUBLIC_SANITY_DATASET is "${dataset}". Nothing was written.`,
    };
  }
  if (!token) {
    return {
      ok: false,
      message:
        "SANITY_API_WRITE_TOKEN isn't set: the import needs a token with the Editor role for the project (see the README). Nothing was written.",
    };
  }
  const where = `dataset "${dataset}" of project ${projectId}`;
  const hideToken = (text: string) => text.split(token).join("[token]");

  /** POSTs to Sanity's HTTP API and returns the parsed answer. */
  async function post(
    endpoint: "query" | "mutate",
    search: Record<string, string>,
    body: unknown,
  ): Promise<Record<string, unknown>> {
    const url = new URL(
      `https://${projectId}.api.sanity.io/v${apiVersion}/data/${endpoint}/${encodeURIComponent(dataset)}`,
    );
    for (const [name, value] of Object.entries(search)) url.searchParams.set(name, value);
    let response: Response;
    try {
      response = await fetchFn(url, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new SanityError(`Sanity couldn't be reached: ${String(error)}`);
    }
    const text = await response.text();
    if (response.status !== 200) {
      throw new SanityError(`Sanity answered ${response.status}: ${text.slice(0, 300)}`);
    }
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new SanityError(`Sanity's answer wasn't JSON: ${text.slice(0, 300)}`);
    }
  }

  const mutations = fixtureMutations(now);
  try {
    // Exact ids, so drafts ("drafts.<id>") and other documents are never read or written.
    const { result } = await post(
      "query",
      { perspective: "raw" },
      { query: "*[_id in $ids]", params: { ids: mutations.map((m) => mutationDocument(m)._id) } },
    );
    const pending = pendingMutations(mutations, Array.isArray(result) ? result : []);
    if (pending.length === 0) {
      return {
        ok: true,
        message: `Nothing to write: the ${mutations.length} fixture documents in the ${where} are up to date.`,
      };
    }
    await post("mutate", { visibility: "sync" }, { mutations: pending });
    const ids = pending.map((mutation) => mutationDocument(mutation)._id);
    const unchanged = mutations.length - pending.length;
    return {
      ok: true,
      message:
        `Wrote ${pending.length} of the ${mutations.length} fixture documents to the ${where}` +
        `${unchanged > 0 ? ` (${unchanged} were up to date)` : ""}: ${ids.join(", ")}.`,
    };
  } catch (error) {
    if (!(error instanceof SanityError)) throw error;
    return {
      ok: false,
      message: hideToken(`${error.message} (${where}). Nothing was written.`),
    };
  }
}
