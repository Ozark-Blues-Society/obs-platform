// Every environment variable the app reads, checked with zod (backlog F-4). They come in two kinds:
//
// - Public variables, named NEXT_PUBLIC_. Next.js writes their values into the JavaScript it sends
//   to every visitor's browser, so they must never hold a secret. Read them with publicEnv()
//   (lib/env/public.ts), anywhere.
// - Server-only variables, the secrets among them, which never leave the server. Read them with
//   serverEnv() (lib/env/server.ts), which can't be imported into browser code.
//
// Never read process.env directly (ESLint enforces it). .env.example lists every variable here.
//
// No variable is required everywhere: each feature stays off, or uses a placeholder, until its
// variables are set. The checks catch a value that is set but wrong, and half of a pair.
// checkEnv() runs before `next build`, `next dev` and `next start` do anything (next.config.ts),
// so a bad value stops them at once. Code that needs an unset variable says so by name when it
// runs (requireEnv()). Messages name the variable, never its value: some values are secrets.
//
// This file doesn't read process.env itself, so code outside the app can use it too
// (next.config.ts, Node scripts): it passes process.env in.
import { z } from "zod";

/** The Sanity project ID used until the Society's project exists (see sanity/env.ts). */
export const PLACEHOLDER_SANITY_PROJECT_ID = "placeholder";

/** A set of variables to check, such as process.env. */
export type RawEnv = Readonly<Record<string, string | undefined>>;

/** One problem with one variable. The message names the variable and never shows its value. */
export interface EnvProblem {
  key: string;
  message: string;
}

/** Variables that are missing or invalid. The message lists each problem; `keys` names them. */
export class EnvError extends Error {
  // Private, so a printed error shows the message once rather than each problem again.
  readonly #problems: readonly EnvProblem[];

  constructor(problems: readonly EnvProblem[], hint?: string) {
    const lines = problems.map((problem) => problem.message);
    const list =
      lines.length === 1
        ? lines[0]
        : `Environment variables need fixing:\n${lines.map((line) => `- ${line}`).join("\n")}`;
    super(hint ? `${list}\n${hint}` : list);
    this.name = "EnvError";
    this.#problems = problems;
  }

  get problems(): readonly EnvProblem[] {
    return this.#problems;
  }

  get keys(): string[] {
    return [...new Set(this.#problems.map((problem) => problem.key))];
  }
}

// --- What a valid value looks like ---------------------------------------------------------------

/** "" and whitespace mean unset (.env.example leaves optional keys empty); the rest is trimmed. */
function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** A variable that may be unset. Each check's message follows the variable's name. */
function optional(...checks: [test: (value: string) => boolean, message: string][]) {
  let schema = z.string();
  for (const [test, message] of checks) {
    schema = schema.refine(test, { error: message });
  }
  return z.preprocess(blankToUndefined, schema.optional());
}

/** A variable with a value to use while it's unset. */
function withDefault(fallback: string, test: (value: string) => boolean, message: string) {
  return z.preprocess(
    blankToUndefined,
    z.string().refine(test, { error: message }).default(fallback),
  );
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isWebAddress(value: string): boolean {
  const url = parseUrl(value);
  return url !== null && (url.protocol === "http:" || url.protocol === "https:");
}

/** An http address on this machine: localhost or 127.x.x.x. */
function isLoopbackAddress(value: string): boolean {
  const url = parseUrl(value);
  return (
    url !== null &&
    url.protocol === "http:" &&
    (url.hostname === "localhost" ||
      url.hostname === "[::1]" ||
      /^127(?:\.\d{1,3}){3}$/.test(url.hostname))
  );
}

/** The role in a Supabase key from before the sb_ keys (a JWT), or null for any other value. */
function jwtRole(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload: unknown = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const role = (payload as { role?: unknown } | null)?.role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

function isSupabaseSecretKey(value: string): boolean {
  return value.startsWith("sb_secret_") || jwtRole(value) === "service_role";
}

function isSupabasePublishableKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || jwtRole(value) === "anon";
}

/** A bare address, such as noreply@mail.example.org: the sender's name is added to it. */
const BARE_ADDRESS = /^[^\s<>@]+@[^\s<>@]+$/;

// Sanity's own rule for dataset names (@sanity/client). Project IDs are short: lowercase letters,
// digits and dashes (8 characters for real projects). The length cap also keeps a pasted token
// (about 180 characters) out of a variable that every browser gets.
const SANITY_DATASET = /^~?[a-z0-9][-\w]{0,63}$/;
const SANITY_PROJECT_ID = /^[a-z0-9][-a-z0-9]{0,31}$/;

// Only end-to-end tests point the app at a stand-in for Sanity's or MailerLite's API, and the
// stand-in gets the read token or the API key, so it must be on this machine. Exactly this form: no
// path, no trailing slash.
const STAND_IN_HOST = /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/;

// --- The variables -------------------------------------------------------------------------------

/** The public variables (NEXT_PUBLIC_): every visitor's browser gets their values. */
export const PUBLIC_VARS = {
  NEXT_PUBLIC_SUPABASE_URL: optional([
    isWebAddress,
    "must be the Supabase API's address, such as http://127.0.0.1:54321 locally.",
  ]),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optional([
    (value) => !isSupabaseSecretKey(value),
    "holds a secret key, which every visitor's browser would get. Put the publishable key here " +
      "and the secret key in SUPABASE_SECRET_KEY.",
  ]),
  NEXT_PUBLIC_SANITY_PROJECT_ID: withDefault(
    PLACEHOLDER_SANITY_PROJECT_ID,
    (value) => SANITY_PROJECT_ID.test(value),
    "must be a Sanity project ID (sanity.io/manage shows it): lowercase letters, digits and " +
      "dashes.",
  ),
  NEXT_PUBLIC_SANITY_DATASET: withDefault(
    "development",
    (value) => SANITY_DATASET.test(value),
    "must be a Sanity dataset name, such as development: lowercase letters, digits, underscores " +
      "and dashes, up to 64 characters.",
  ),
};

/** The server-only variables, secrets among them: never give one a NEXT_PUBLIC_ name. */
export const SERVER_VARS = {
  SUPABASE_SECRET_KEY: optional([
    (value) => !isSupabasePublishableKey(value),
    "holds the publishable key: use the secret key (locally, the SECRET_KEY that `supabase " +
      "status` prints).",
  ]),
  SANITY_API_READ_TOKEN: optional(),
  SANITY_API_HOST_STAND_IN: optional([
    (value) => STAND_IN_HOST.test(value),
    "must be http://127.0.0.1:<port>: only end-to-end tests set it, for their stand-in for " +
      "Sanity, and the read token must not go anywhere else.",
  ]),
  SITE_URL: optional([
    isWebAddress,
    "must be the site's address, such as https://<Society domain>.",
  ]),
  EMAIL_FROM: optional([
    (value) => BARE_ADDRESS.test(value),
    "must be the address emails are sent from, such as noreply@mail.<Society domain> (decision " +
      "0005), without a name.",
  ]),
  RESEND_API_KEY: optional(),
  MAILPIT_URL: optional([
    isLoopbackAddress,
    "must be on this machine (localhost or 127.0.0.1), such as http://127.0.0.1:54324.",
  ]),
  CRON_SECRET: optional(),
  MAILERLITE_API_KEY: optional(),
  MAILERLITE_API_URL_STAND_IN: optional([
    (value) => STAND_IN_HOST.test(value),
    "must be http://127.0.0.1:<port>: only end-to-end tests set it, for their stand-in for " +
      "MailerLite, and the API key must not go anywhere else.",
  ]),
  // Zeffy (decision 0007) has no test mode, so a human sets these two on Netlify staging and
  // production only, never on the factory server or in CI.
  ZEFFY_API_KEY: optional([
    (value) => !value.startsWith("whsec_"),
    "holds the webhook signing secret (whsec_...): put the organization's API key here and the " +
      "signing secret in ZEFFY_WEBHOOK_SECRET.",
  ]),
  ZEFFY_WEBHOOK_SECRET: optional([
    (value) => value.startsWith("whsec_"),
    "must be Zeffy's webhook signing secret (Settings > Integrations), which starts with whsec_.",
  ]),
};

/** The checked values: a variable that can be unset is an optional property. */
type Values<Vars extends Record<string, z.ZodType>> = Simplify<
  { [K in keyof Vars as undefined extends z.output<Vars[K]> ? K : never]?: z.output<Vars[K]> } & {
    [K in keyof Vars as undefined extends z.output<Vars[K]> ? never : K]: z.output<Vars[K]>;
  }
>;
type Simplify<T> = { [K in keyof T]: T[K] } & {};

export type PublicKey = keyof typeof PUBLIC_VARS;
export type ServerKey = keyof typeof SERVER_VARS;
/** The public variables' values: unset ones are undefined, or their placeholder. */
export type PublicEnv = Values<typeof PUBLIC_VARS>;
/** The server-only variables' values: unset ones are undefined. */
export type ServerEnv = Values<typeof SERVER_VARS>;

/** Variables that work only together: one without the other is a mistake. */
const PAIRS: [PublicKey, PublicKey, string][] = [
  [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "set both, or neither (the site then runs without sign-in).",
  ],
];

// --- Checking them -------------------------------------------------------------------------------

function check(
  vars: RawEnv,
  schemas: Record<string, z.ZodType>,
  keys: readonly string[],
): { values: Record<string, unknown>; problems: EnvProblem[] } {
  const values: Record<string, unknown> = {};
  const problems: EnvProblem[] = [];
  for (const key of keys) {
    const result = schemas[key].safeParse(vars[key]);
    if (result.success) {
      values[key] = result.data;
      continue;
    }
    // Every check above has its own message. Any other issue (a value that isn't a string,
    // which process.env never holds) gets a plain one, so no message can echo the value.
    for (const issue of result.error.issues) {
      problems.push({
        key,
        message: `${key} ${issue.code === "custom" ? issue.message : "is invalid."}`,
      });
    }
  }
  for (const [first, second, advice] of PAIRS) {
    if (!keys.includes(first) || !keys.includes(second)) continue;
    if (problems.some((problem) => problem.key === first || problem.key === second)) continue;
    const [present, missing] = values[first] === undefined ? [second, first] : [first, second];
    if (values[present] !== undefined && values[missing] === undefined) {
      problems.push({
        key: missing,
        message: `${missing} isn't set, but ${present} is: ${advice}`,
      });
    }
  }
  return { values, problems };
}

function parse<Env, K extends keyof Env & string>(
  vars: RawEnv,
  schemas: Record<string, z.ZodType>,
  keys: readonly K[] | undefined,
): Pick<Env, K> {
  const { values, problems } = check(vars, schemas, keys?.length ? keys : Object.keys(schemas));
  if (problems.length > 0) throw new EnvError(problems);
  return values as Pick<Env, K>;
}

/**
 * The given public variables (or all of them) from `vars`, checked. Throws an EnvError when one
 * is invalid, or is half of a pair whose other half is set.
 */
export function parsePublicEnv<K extends PublicKey = PublicKey>(
  vars: RawEnv,
  keys?: readonly K[],
): Pick<PublicEnv, K> {
  return parse<PublicEnv, K>(vars, PUBLIC_VARS, keys);
}

/** The given server-only variables (or all of them) from `vars`, checked. Throws an EnvError. */
export function parseServerEnv<K extends ServerKey = ServerKey>(
  vars: RawEnv,
  keys?: readonly K[],
): Pick<ServerEnv, K> {
  return parse<ServerEnv, K>(vars, SERVER_VARS, keys);
}

/**
 * Checks every variable at once, for next.config.ts: throws one EnvError that lists every problem,
 * public and server-only.
 */
export function checkEnv(vars: RawEnv): void {
  const problems = [
    ...check(vars, PUBLIC_VARS, Object.keys(PUBLIC_VARS)).problems,
    ...check(vars, SERVER_VARS, Object.keys(SERVER_VARS)).problems,
  ];
  if (problems.length > 0) {
    throw new EnvError(
      problems,
      "Values aren't shown, since some are secrets. Locally, the variables come from .env.local " +
        '(start from .env.example); see "Environment variables" in the README.',
    );
  }
}

/**
 * The value of a variable that the calling code can't work without. Throws an EnvError naming it,
 * with `why` (what needs it, and where to get it), when it's unset.
 */
export function requireEnv<Env extends object, K extends keyof Env & string>(
  env: Env,
  key: K,
  why: string,
): Exclude<Env[K], undefined> {
  const value = env[key];
  if (value === undefined) {
    throw new EnvError([{ key, message: `${key} isn't set: ${why}` }]);
  }
  return value as Exclude<Env[K], undefined>;
}
