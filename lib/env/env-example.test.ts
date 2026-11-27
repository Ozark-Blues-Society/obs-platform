// @vitest-environment node
// .env.example is the list of every variable (backlog F-4): each one, with a note, and no secrets.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkEnv, PUBLIC_VARS, SERVER_VARS } from "./schema";

const lines = readFileSync(new URL("../../.env.example", import.meta.url), "utf8").split("\n");
const entries = lines.flatMap((line, index) => {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  return match ? [{ key: match[1], value: match[2], note: lines[index - 1] ?? "" }] : [];
});

/** The server-only variables whose local values aren't secrets. Every other one stays empty. */
const NOT_SECRET = ["SITE_URL", "EMAIL_FROM", "MAILPIT_URL"];

describe(".env.example", () => {
  it("lists every variable the app reads, once each, and nothing else", () => {
    expect(entries.map((entry) => entry.key).sort()).toEqual(
      [...Object.keys(PUBLIC_VARS), ...Object.keys(SERVER_VARS)].sort(),
    );
  });

  it("has a one-line note right above each variable", () => {
    for (const { key, note } of entries) {
      expect(note, key).toMatch(/^# \S/);
    }
  });

  it("holds no secrets: only public and harmless local values are filled in", () => {
    const filled = entries.filter((entry) => entry.value !== "").map((entry) => entry.key);
    for (const key of filled) {
      expect(key in PUBLIC_VARS || NOT_SECRET.includes(key), key).toBe(true);
    }
  });

  it("passes the checks, so a copy works as it is", () => {
    expect(() =>
      checkEnv(Object.fromEntries(entries.map((entry) => [entry.key, entry.value]))),
    ).not.toThrow();
  });
});
