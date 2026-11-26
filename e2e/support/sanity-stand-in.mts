/**
 * A stand-in for Sanity's API for end-to-end tests: CI has no Sanity project, so Playwright starts
 * this server (playwright.config.ts) and the app reads content from it instead
 * (SANITY_API_HOST_STAND_IN, see sanity/live.ts). It answers GROQ queries with groq-js, Sanity's
 * own query engine, over the documents in ../fixtures/sanity-content.mts, so the app's real queries
 * run, members-only gating included.
 *
 * It behaves like a private dataset (decision 0001): a query without the read token gets an empty
 * dataset, with status 200, as Sanity does. Draft perspectives show drafts in place of the
 * published documents, as Sanity's do.
 *
 *   node e2e/support/sanity-stand-in.mts      (SANITY_STAND_IN_PORT, default 3400)
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { evaluate, parse } from "groq-js";
import { DOCUMENTS } from "../fixtures/sanity-content.mts";

const PORT = Number(process.env.SANITY_STAND_IN_PORT ?? 3400);
const TOKEN = process.env.SANITY_API_READ_TOKEN ?? "e2e-stand-in-token";

type Doc = { _id: string; [key: string]: unknown };

/** The documents a query can see, for this perspective and token. */
function datasetFor(perspective: string, authorized: boolean): Doc[] {
  if (!authorized) return [];
  const published = DOCUMENTS.filter((doc) => !doc._id.startsWith("drafts."));
  if (perspective === "published") return published;
  if (perspective === "raw") return DOCUMENTS;
  // "drafts" (and releases): a draft takes its published document's place, under its id.
  const drafts = DOCUMENTS.filter((doc) => doc._id.startsWith("drafts."));
  const drafted = new Set(drafts.map((doc) => doc._id.slice("drafts.".length)));
  return [
    ...published.filter((doc) => !drafted.has(doc._id)),
    ...drafts.map((doc) => ({
      ...doc,
      _id: doc._id.slice("drafts.".length),
      _originalId: doc._id,
    })),
  ];
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString();
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  // The browser's live-content connection comes from the site's origin.
  response.setHeader("access-control-allow-origin", request.headers.origin ?? "*");
  response.setHeader("access-control-allow-credentials", "true");
  response.setHeader("access-control-allow-headers", "authorization, content-type");
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  if (url.pathname === "/health") return send(response, 200, { ok: true });

  if (/^\/v[\w-]+\/data\/query\/[\w-]+$/.test(url.pathname)) {
    let query = url.searchParams.get("query") ?? "";
    const params: Record<string, unknown> = {};
    for (const [key, value] of url.searchParams) {
      if (key.startsWith("$")) params[key.slice(1)] = JSON.parse(value);
    }
    if (request.method === "POST") {
      const sent = JSON.parse((await readBody(request)) || "{}") as {
        query?: string;
        params?: Record<string, unknown>;
      };
      query = sent.query ?? query;
      Object.assign(params, sent.params);
    }
    const perspective = url.searchParams.get("perspective") ?? "published";
    const authorized = request.headers.authorization === `Bearer ${TOKEN}`;
    try {
      const value = await evaluate(parse(query), {
        dataset: datasetFor(perspective, authorized),
        params,
      });
      return send(response, 200, { query, result: await value.get(), ms: 1, syncTags: ["s1:e2e"] });
    } catch (error) {
      return send(response, 400, { error: { description: String(error) } });
    }
  }

  // Sanity Live's event stream: welcome the browser, then stay quiet.
  if (/^\/v[\w-]+\/data\/live\/events\//.test(url.pathname)) {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    response.write("event: welcome\ndata: {}\n\n");
    const keepAlive = setInterval(() => response.write(": keep-alive\n\n"), 15_000);
    request.on("close", () => clearInterval(keepAlive));
    return;
  }

  send(response, 404, { error: { description: `The stand-in doesn't serve ${url.pathname}` } });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Sanity stand-in listening on http://127.0.0.1:${PORT}`);
});
