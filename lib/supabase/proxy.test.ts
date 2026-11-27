// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };

// A stand-in for Supabase: getClaims() returns `claims`, and first writes `refresh` through the
// cookie adapter, the way a real token refresh does.
const supabase = vi.hoisted(() => ({
  claims: null as Record<string, unknown> | null,
  refresh: null as { cookies: CookieToSet[]; headers: Record<string, string> } | null,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookies: { setAll: (cookies: CookieToSet[], headers: Record<string, string>) => void };
    },
  ) => ({
    auth: {
      async getClaims() {
        if (supabase.refresh) {
          options.cookies.setAll(supabase.refresh.cookies, supabase.refresh.headers);
        }
        return { data: supabase.claims && { claims: supabase.claims }, error: null };
      },
    },
  }),
}));

const { updateSession } = await import("./proxy");

const NO_CACHE = "private, no-cache, no-store, must-revalidate, max-age=0";

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: cookie ? { cookie } : {},
  });
}

function passesThrough(response: Response): boolean {
  return response.headers.get("x-middleware-next") === "1";
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  supabase.claims = null;
  supabase.refresh = null;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("updateSession", () => {
  it("lets visitors through to public pages", async () => {
    expect(passesThrough(await updateSession(request("/events")))).toBe(true);
  });

  it("sends visitors who open My Account to sign in, and back afterwards", async () => {
    const response = await updateSession(request("/account/profile?tab=email"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("next")).toBe("/account/profile?tab=email");
  });

  it("sends visitors who open an admin screen to sign in, and back afterwards", async () => {
    const response = await updateSession(request("/admin/roles"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("next")).toBe("/admin/roles");
  });

  it("lets signed-in members into My Account and on to the admin screens' own role check", async () => {
    supabase.claims = { sub: "member-1" };

    expect(passesThrough(await updateSession(request("/account")))).toBe(true);
    expect(passesThrough(await updateSession(request("/admin/roles")))).toBe(true);
  });

  it("doesn't mistake look-alike paths for member-only ones", async () => {
    expect(passesThrough(await updateSession(request("/accounts-payable")))).toBe(true);
    expect(passesThrough(await updateSession(request("/administration")))).toBe(true);
  });

  it("hands a refreshed session to the page and back to the browser", async () => {
    supabase.claims = { sub: "member-1" };
    supabase.refresh = {
      cookies: [{ name: "sb-127-auth-token", value: "base64-new", options: { path: "/" } }],
      headers: { "Cache-Control": NO_CACHE },
    };

    const response = await updateSession(request("/account", "sb-127-auth-token=base64-old"));

    expect(passesThrough(response)).toBe(true);
    // The browser stores the new session, and no cache keeps the response.
    expect(response.cookies.get("sb-127-auth-token")?.value).toBe("base64-new");
    expect(response.headers.get("cache-control")).toBe(NO_CACHE);
    // The page rendered for this request reads the new session, not the expired one.
    expect(response.headers.get("x-middleware-request-cookie")).toBe(
      "sb-127-auth-token=base64-new",
    );
  });

  it("clears a dead session's cookies when it redirects to sign in", async () => {
    // A refresh token that no longer works: Supabase deletes the session cookies.
    supabase.refresh = {
      cookies: [{ name: "sb-127-auth-token", value: "", options: { path: "/", maxAge: 0 } }],
      headers: { "Cache-Control": NO_CACHE },
    };

    const response = await updateSession(request("/account", "sb-127-auth-token=base64-old"));

    expect(response.status).toBe(307);
    expect(response.headers.get("set-cookie")).toMatch(/^sb-127-auth-token=;.*Max-Age=0/);
    expect(response.headers.get("cache-control")).toBe(NO_CACHE);
  });

  it("skips session handling, with one warning, when Supabase isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(passesThrough(await updateSession(request("/")))).toBe(true);
    expect(passesThrough(await updateSession(request("/account")))).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("refuses half a configuration, naming the missing variable", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    await expect(updateSession(request("/"))).rejects.toThrow(
      "NEXT_PUBLIC_SUPABASE_URL isn't set, but NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is",
    );
  });
});
