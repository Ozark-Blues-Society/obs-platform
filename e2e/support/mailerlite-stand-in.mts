/**
 * A stand-in for MailerLite's API for end-to-end tests: tests must never reach MailerLite, so
 * Playwright starts this server (playwright.config.ts) and gives the app MAILERLITE_API_KEY (the
 * stand-in's made-up key) and MAILERLITE_API_URL_STAND_IN (this server). The blog's newsletter
 * signup box and the email switches on My Account then show, and talk to this server.
 *
 * It serves lib/mailerlite/fake-api.ts, an account kept in memory that answers the way MailerLite's
 * documentation says, with double opt-in on, as the Society's account will have it (decision 0015).
 * The tests read and set up subscribers through e2e/support/mailerlite.ts, which calls the
 * /stand-in/ routes below. Tests run in parallel and share the account, so each uses its own
 * addresses.
 *
 *   node e2e/support/mailerlite-stand-in.mts      (MAILERLITE_STAND_IN_PORT, default 3500)
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fakeMailerLite, type SubscriberStatus } from "../../lib/mailerlite/fake-api.ts";

const PORT = Number(process.env.MAILERLITE_STAND_IN_PORT ?? 3500);

const api = fakeMailerLite({ doubleOptIn: true });

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString();
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

/** A subscriber as the tests see them: their status and the names of their groups. */
function describe(email: string) {
  const subscriber = api.subscriber(email);
  if (!subscriber) return null;
  return {
    status: subscriber.status,
    groups: [...subscriber.groups].map((id) => api.groups.get(id)).sort(),
    confirmationEmails: api.confirmationEmails.filter((address) => address === email).length,
  };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const body = await readBody(request);

  if (url.pathname === "/health") return send(response, 200, { ok: true });

  // The app's requests, answered as MailerLite would.
  if (url.pathname.startsWith("/api/")) {
    const answer = await api.fetch(`https://connect.mailerlite.com${url.pathname}${url.search}`, {
      method: request.method,
      headers: { authorization: request.headers.authorization ?? "" },
      ...(body ? { body } : {}),
    });
    response.writeHead(answer.status, { "content-type": "application/json" });
    response.end(await answer.text());
    return;
  }

  // The tests' own routes.
  const email = url.searchParams.get("email") ?? "";
  if (url.pathname === "/stand-in/subscriber" && request.method === "GET") {
    const subscriber = describe(email);
    return subscriber ? send(response, 200, subscriber) : send(response, 404, null);
  }
  if (url.pathname === "/stand-in/subscriber" && request.method === "PUT") {
    // A subscriber as MailerLite would have them before the test: from an import, a form or the
    // member group sync. Replaces one the test made before.
    const { status, groups } = JSON.parse(body) as { status: SubscriberStatus; groups: string[] };
    const existing = api.subscriber(email);
    if (existing) api.subscribers.delete(existing.id);
    api.addSubscriber(email, status, groups);
    return send(response, 200, describe(email));
  }
  if (url.pathname === "/stand-in/fail" && request.method === "POST") {
    // MailerLite answers the next request about this address with an error.
    const { status } = JSON.parse(body) as { status: number };
    const id = api.subscriber(email)?.id;
    const paths = [encodeURIComponent(email), ...(id ? [id] : [])].map(
      (key) => `subscribers/${key}`,
    );
    api.fail(
      (r) => r.body?.email === email || paths.some((path) => r.path.startsWith(path)),
      status,
    );
    return send(response, 200, { ok: true });
  }

  send(response, 404, { message: `The stand-in doesn't serve ${url.pathname}` });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`MailerLite stand-in listening on http://127.0.0.1:${PORT}`);
});
