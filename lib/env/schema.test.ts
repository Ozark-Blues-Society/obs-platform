// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  checkEnv,
  EnvError,
  parsePublicEnv,
  parseServerEnv,
  PLACEHOLDER_SANITY_PROJECT_ID,
  requireEnv,
  type RawEnv,
} from "./schema";

/** The EnvError that `run` throws. Fails the test when it throws nothing, or something else. */
function envError(run: () => unknown): EnvError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(EnvError);
    return error as EnvError;
  }
  throw new Error("expected an EnvError");
}

/** A Supabase key from before the sb_ keys: a JWT whose payload names the role. */
function legacyKey(role: string): string {
  const part = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part({ iss: "supabase-demo", role })}.signature`;
}

const LOCAL_SUPABASE = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
};

describe("parsePublicEnv", () => {
  it("leaves Supabase unset and uses Sanity's placeholders when nothing is set", () => {
    expect(parsePublicEnv({})).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
      NEXT_PUBLIC_SANITY_PROJECT_ID: PLACEHOLDER_SANITY_PROJECT_ID,
      NEXT_PUBLIC_SANITY_DATASET: "development",
    });
  });

  it("treats empty and blank values as unset, and trims the rest", () => {
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: " ",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
        NEXT_PUBLIC_SANITY_PROJECT_ID: " abc123xy\n",
        NEXT_PUBLIC_SANITY_DATASET: "  ",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
      NEXT_PUBLIC_SANITY_PROJECT_ID: "abc123xy",
      NEXT_PUBLIC_SANITY_DATASET: "development",
    });
  });

  it("accepts the local stack's Supabase values and a real-looking Sanity project", () => {
    expect(
      parsePublicEnv({
        ...LOCAL_SUPABASE,
        NEXT_PUBLIC_SANITY_PROJECT_ID: "zp7mbokg",
        NEXT_PUBLIC_SANITY_DATASET: "production",
      }),
    ).toEqual({
      ...LOCAL_SUPABASE,
      NEXT_PUBLIC_SANITY_PROJECT_ID: "zp7mbokg",
      NEXT_PUBLIC_SANITY_DATASET: "production",
    });
  });

  it.each([
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"],
    ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
  ] as const)("refuses %s without %s", (present, missing) => {
    const error = envError(() => parsePublicEnv({ [present]: LOCAL_SUPABASE[present] }));
    expect(error.keys).toEqual([missing]);
    expect(error.message).toBe(
      `${missing} isn't set, but ${present} is: set both, or neither (the site then runs ` +
        "without sign-in).",
    );
  });

  it.each(["127.0.0.1:54321", "ftp://127.0.0.1:54321", "not a url"])(
    "refuses a Supabase URL that isn't a web address: %s",
    (url) => {
      const error = envError(() =>
        parsePublicEnv({ ...LOCAL_SUPABASE, NEXT_PUBLIC_SUPABASE_URL: url }),
      );
      expect(error.keys).toEqual(["NEXT_PUBLIC_SUPABASE_URL"]);
      expect(error.message).toContain(
        "NEXT_PUBLIC_SUPABASE_URL must be the Supabase API's address",
      );
    },
  );

  it.each([
    ["a secret key", "sb_secret_madeUpForTheseTests0000000000"],
    ["a service role key from before the sb_ keys", legacyKey("service_role")],
  ])("refuses %s in the publishable key, which every browser gets", (_case, key) => {
    const error = envError(() =>
      parsePublicEnv({ ...LOCAL_SUPABASE, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }),
    );
    expect(error.keys).toEqual(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
    expect(error.message).toContain("holds a secret key");
  });

  it("accepts an anon key from before the sb_ keys", () => {
    const key = legacyKey("anon");
    expect(
      parsePublicEnv({ ...LOCAL_SUPABASE, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }),
    ).toMatchObject({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key });
  });

  it.each([
    ["uppercase letters", "AbC123xy"],
    ["a space", "abc 123"],
    ["a token's length", `sk${"a1".repeat(90)}`],
  ])("refuses a Sanity project ID with %s", (_case, projectId) => {
    const error = envError(() => parsePublicEnv({ NEXT_PUBLIC_SANITY_PROJECT_ID: projectId }));
    expect(error.keys).toEqual(["NEXT_PUBLIC_SANITY_PROJECT_ID"]);
  });

  it.each([
    ["a space", "my data"],
    ["a leading dash", "-staging"],
    ["65 characters", "d".repeat(65)],
  ])("refuses a Sanity dataset name with %s", (_case, dataset) => {
    const error = envError(() => parsePublicEnv({ NEXT_PUBLIC_SANITY_DATASET: dataset }));
    expect(error.keys).toEqual(["NEXT_PUBLIC_SANITY_DATASET"]);
  });

  it("checks only the variables it's asked for", () => {
    const vars = { NEXT_PUBLIC_SUPABASE_URL: "not a url", NEXT_PUBLIC_SANITY_DATASET: "staging" };
    expect(parsePublicEnv(vars, ["NEXT_PUBLIC_SANITY_DATASET"])).toEqual({
      NEXT_PUBLIC_SANITY_DATASET: "staging",
    });
    expect(() => parsePublicEnv(vars)).toThrow(EnvError);
  });
});

describe("parseServerEnv", () => {
  it("leaves every variable unset when nothing is set", () => {
    expect(parseServerEnv({ SITE_URL: " ", CRON_SECRET: "" })).toEqual({
      SUPABASE_SECRET_KEY: undefined,
      SANITY_API_READ_TOKEN: undefined,
      SANITY_API_HOST_STAND_IN: undefined,
      SITE_URL: undefined,
      EMAIL_FROM: undefined,
      RESEND_API_KEY: undefined,
      MAILPIT_URL: undefined,
      CRON_SECRET: undefined,
      MAILERLITE_API_KEY: undefined,
      ZEFFY_API_KEY: undefined,
      ZEFFY_WEBHOOK_SECRET: undefined,
    });
  });

  it("takes any value for a secret it can't check, trimmed", () => {
    expect(
      parseServerEnv(
        {
          SANITY_API_READ_TOKEN: " skToken\n",
          RESEND_API_KEY: "re_test_key",
          CRON_SECRET: "local-secret",
          MAILERLITE_API_KEY: "eyJ0eXAiOiJKV1Qi",
          ZEFFY_API_KEY: " zeffy-made-up-key ",
        },
        [
          "SANITY_API_READ_TOKEN",
          "RESEND_API_KEY",
          "CRON_SECRET",
          "MAILERLITE_API_KEY",
          "ZEFFY_API_KEY",
        ],
      ),
    ).toEqual({
      SANITY_API_READ_TOKEN: "skToken",
      RESEND_API_KEY: "re_test_key",
      CRON_SECRET: "local-secret",
      MAILERLITE_API_KEY: "eyJ0eXAiOiJKV1Qi",
      ZEFFY_API_KEY: "zeffy-made-up-key",
    });
  });

  it.each([
    ["a secret key", "sb_secret_madeUpForTheseTests0000000000", true],
    ["a service role key from before the sb_ keys", legacyKey("service_role"), true],
    ["the publishable key", LOCAL_SUPABASE.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, false],
    ["an anon key from before the sb_ keys", legacyKey("anon"), false],
  ])("SUPABASE_SECRET_KEY takes %s: %s", (_case, key, accepted) => {
    const parse = () => parseServerEnv({ SUPABASE_SECRET_KEY: key }, ["SUPABASE_SECRET_KEY"]);
    if (accepted) {
      expect(parse()).toEqual({ SUPABASE_SECRET_KEY: key });
    } else {
      expect(envError(parse).message).toContain("SUPABASE_SECRET_KEY holds the publishable key");
    }
  });

  it("takes only a loopback address for the Sanity stand-in, so the read token stays here", () => {
    const standIn = (value: string) =>
      parseServerEnv({ SANITY_API_HOST_STAND_IN: value }, ["SANITY_API_HOST_STAND_IN"]);
    expect(standIn("http://127.0.0.1:3400")).toEqual({
      SANITY_API_HOST_STAND_IN: "http://127.0.0.1:3400",
    });
    expect(standIn(" http://localhost:3587 ")).toEqual({
      SANITY_API_HOST_STAND_IN: "http://localhost:3587",
    });
    for (const host of [
      "https://api.sanity.io",
      "http://127.0.0.1.evil.example:3400",
      "http://127.0.0.1:3400/path",
      "http://10.0.0.5:3400",
      "http://127.0.0.1",
    ]) {
      expect(envError(() => standIn(host)).keys, host).toEqual(["SANITY_API_HOST_STAND_IN"]);
    }
  });

  it("takes a web address for SITE_URL", () => {
    expect(parseServerEnv({ SITE_URL: "https://ozarkblues.example/" }, ["SITE_URL"])).toEqual({
      SITE_URL: "https://ozarkblues.example/",
    });
    for (const value of ["ozarkblues.example", "ftp://ozarkblues.example"]) {
      expect(envError(() => parseServerEnv({ SITE_URL: value }, ["SITE_URL"])).message).toBe(
        "SITE_URL must be the site's address, such as https://<Society domain>.",
      );
    }
  });

  it.each([
    ["a name and an address", "Ozark Blues Society <noreply@mail.example.org>"],
    ["not an address", "noreply"],
  ])("refuses an EMAIL_FROM that is %s", (_case, from) => {
    expect(envError(() => parseServerEnv({ EMAIL_FROM: from }, ["EMAIL_FROM"])).message).toBe(
      "EMAIL_FROM must be the address emails are sent from, such as noreply@mail.<Society " +
        "domain> (decision 0005), without a name.",
    );
  });

  it("takes Zeffy's webhook signing secret only in ZEFFY_WEBHOOK_SECRET", () => {
    const zeffy = (vars: RawEnv) => parseServerEnv(vars, ["ZEFFY_API_KEY", "ZEFFY_WEBHOOK_SECRET"]);
    expect(zeffy({ ZEFFY_WEBHOOK_SECRET: "whsec_madeUp" })).toEqual({
      ZEFFY_API_KEY: undefined,
      ZEFFY_WEBHOOK_SECRET: "whsec_madeUp",
    });
    expect(envError(() => zeffy({ ZEFFY_WEBHOOK_SECRET: "madeUp" })).message).toBe(
      "ZEFFY_WEBHOOK_SECRET must be Zeffy's webhook signing secret (Settings > Integrations), " +
        "which starts with whsec_.",
    );
    const swapped = envError(() => zeffy({ ZEFFY_API_KEY: "whsec_madeUp" }));
    expect(swapped.keys).toEqual(["ZEFFY_API_KEY"]);
    expect(swapped.message).toContain("ZEFFY_API_KEY holds the webhook signing secret");
    expect(swapped.message).not.toContain("whsec_madeUp");
  });

  it("takes only an address on this machine for Mailpit", () => {
    const mailpit = (value: string) => parseServerEnv({ MAILPIT_URL: value }, ["MAILPIT_URL"]);
    for (const value of ["http://127.0.0.1:54324", "http://localhost:54324", "http://[::1]:8025"]) {
      expect(mailpit(value)).toEqual({ MAILPIT_URL: value });
    }
    for (const value of ["http://mailpit.example:54324", "https://127.0.0.1:54324", "54324"]) {
      expect(envError(() => mailpit(value)).keys, value).toEqual(["MAILPIT_URL"]);
    }
  });
});

describe("checkEnv", () => {
  it("passes when nothing is set: every feature is off", () => {
    expect(() => checkEnv({})).not.toThrow();
  });

  it("lists every problem, public and server-only, without showing a single value", () => {
    const vars: RawEnv = {
      NEXT_PUBLIC_SUPABASE_URL: "secret-value-1",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_secret-value-2",
      NEXT_PUBLIC_SANITY_PROJECT_ID: "secret-value-3!",
      NEXT_PUBLIC_SANITY_DATASET: "secret-value-4!",
      SUPABASE_SECRET_KEY: "sb_publishable_secret-value-5",
      SANITY_API_HOST_STAND_IN: "https://secret-value-6.example",
      SITE_URL: "secret-value-7",
      EMAIL_FROM: "secret-value-8",
      MAILPIT_URL: "http://secret-value-9.example",
    };

    const error = envError(() => checkEnv(vars));

    expect(error.keys).toEqual(Object.keys(vars));
    expect(error.message).not.toContain("secret-value");
    expect(error.message).toMatch(
      /^Environment variables need fixing:\n- NEXT_PUBLIC_SUPABASE_URL /,
    );
    expect(error.message).toContain("\n- MAILPIT_URL must be on this machine");
    expect(error.message).toContain("Values aren't shown, since some are secrets.");
  });

  it("names half a Supabase pair", () => {
    const error = envError(() =>
      checkEnv({ NEXT_PUBLIC_SUPABASE_URL: LOCAL_SUPABASE.NEXT_PUBLIC_SUPABASE_URL }),
    );
    expect(error.keys).toEqual(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
  });
});

describe("requireEnv", () => {
  it("gives the value when it's set", () => {
    expect(requireEnv({ SITE_URL: "https://ozarkblues.example" }, "SITE_URL", "why")).toBe(
      "https://ozarkblues.example",
    );
  });

  it("names the variable and what needs it when it's unset", () => {
    const env: { SITE_URL?: string } = {};
    const error = envError(() =>
      requireEnv(env, "SITE_URL", "links in emails need the site's address."),
    );
    expect(error.keys).toEqual(["SITE_URL"]);
    expect(error.message).toBe("SITE_URL isn't set: links in emails need the site's address.");
  });
});
