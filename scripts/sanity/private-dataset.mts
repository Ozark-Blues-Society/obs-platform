/**
 * Checks that a Sanity dataset is private (decision 0001): that someone without a token can read
 * none of it, members-only pages, posts and events included. `pnpm check:dataset` runs it
 * (./check-private-dataset.mts).
 *
 * Sanity answers an anonymous query on a private dataset with 200 and an empty result, as if the
 * dataset were empty, never with an error. So the check reads the result, not the status, and uses
 * the read token to confirm there is published content that an anonymous query should have found.
 *
 * Run it whenever a dataset is created or the project's plan changes: a trial that ends, or a
 * downgrade to the free plan, turns private datasets public (decision 0001). The launch runbook
 * (backlog Q-5) runs it against production.
 */

/** Members-only pages, posts and events: an anonymous query must find none. */
export const MEMBERS_ONLY_QUERY =
  '*[_type in ["page", "post", "event"] && visibility.audience != "everyone"]{ _id, _type }';

/** What an anonymous query can see: nothing at all, if the dataset is private. */
export const ANONYMOUS_QUERY = `{ "total": count(*), "membersOnly": ${MEMBERS_ONLY_QUERY}[0...10] }`;

/** Published documents, counted with the read token. */
export const PUBLISHED_COUNT_QUERY = "count(*)";

export type CheckOptions = {
  projectId: string;
  dataset: string;
  apiVersion: string;
  /** A read token for the project. Without one, an empty answer proves nothing. */
  token?: string;
  fetch?: typeof fetch;
};

export type CheckResult = {
  /** private: confirmed; public: anyone can read it; unknown: the check couldn't tell. */
  status: "private" | "public" | "unknown";
  message: string;
};

/** The process exit code for each result: 1 means act now. */
export const EXIT_CODES: Record<CheckResult["status"], number> = {
  private: 0,
  public: 1,
  unknown: 2,
};

class QueryError extends Error {}

async function query(options: CheckOptions, groq: string, token?: string): Promise<unknown> {
  const { projectId, dataset, apiVersion, fetch: fetchFn = fetch } = options;
  const url = new URL(
    `https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${encodeURIComponent(dataset)}`,
  );
  url.searchParams.set("query", groq);
  url.searchParams.set("perspective", "published");
  let response: Response;
  try {
    response = await fetchFn(url, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new QueryError(`Sanity couldn't be reached: ${String(error)}`);
  }
  const text = await response.text();
  if (response.status !== 200) {
    throw new QueryError(`Sanity answered ${response.status}: ${text.slice(0, 300)}`);
  }
  try {
    return (JSON.parse(text) as { result?: unknown }).result;
  } catch {
    throw new QueryError(`Sanity's answer wasn't JSON: ${text.slice(0, 300)}`);
  }
}

export async function checkPrivateDataset(options: CheckOptions): Promise<CheckResult> {
  const where = `dataset "${options.dataset}" of project ${options.projectId}`;
  try {
    // No token: what anyone on the internet gets.
    const anonymous = (await query(options, ANONYMOUS_QUERY)) as {
      total?: unknown;
      membersOnly?: unknown;
    } | null;
    const total = typeof anonymous?.total === "number" ? anonymous.total : Number.NaN;
    const membersOnly = Array.isArray(anonymous?.membersOnly) ? anonymous.membersOnly : [];
    if (!Number.isFinite(total)) {
      return {
        status: "unknown",
        message: `Unexpected answer for ${where}: ${JSON.stringify(anonymous)}`,
      };
    }
    if (total > 0) {
      const examples = membersOnly
        .map((doc) => `${(doc as { _type?: string })._type} ${(doc as { _id?: string })._id}`)
        .join(", ");
      return {
        status: "public",
        message:
          `FAIL: anyone can read the ${where} without a token: ${total} documents` +
          (examples ? `, members-only ones among them (${examples})` : "") +
          ". Make the dataset private at once (sanity.io/manage, or `sanity dataset visibility set " +
          `${options.dataset} private\`), then check the project's plan: a lapsed trial or a ` +
          "downgrade turns private datasets public (decision 0001).",
      };
    }

    if (!options.token) {
      return {
        status: "unknown",
        message: `An anonymous query found nothing in the ${where}. Set SANITY_API_READ_TOKEN to confirm the dataset has published content; until then an empty dataset looks the same.`,
      };
    }
    const published = await query(options, PUBLISHED_COUNT_QUERY, options.token);
    if (typeof published !== "number") {
      return {
        status: "unknown",
        message: `Unexpected answer for ${where}: ${JSON.stringify(published)}`,
      };
    }
    if (published === 0) {
      return {
        status: "unknown",
        message: `The ${where} has no published documents, so an empty anonymous answer proves nothing. Publish a document (any page) and run the check again.`,
      };
    }
    return {
      status: "private",
      message: `OK: the ${where} is private. An anonymous query found none of its ${published} published documents.`,
    };
  } catch (error) {
    if (error instanceof QueryError) return { status: "unknown", message: error.message };
    throw error;
  }
}
