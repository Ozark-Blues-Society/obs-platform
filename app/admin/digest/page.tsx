import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/form-fields";
import { Tag } from "@/components/ui/tag";
import MonthlyNewsletter, { type DigestPost } from "@/emails/monthly-newsletter";
import { renderEmail } from "@/emails/render";
import { requireUser } from "@/lib/auth/user";
import { loadDigestPosts, makesDigest } from "@/lib/newsletter/digest";
import { siteUrl } from "@/lib/site/site-url";
import { addMonths, formatSocietyDate, isMonth, monthName, societyMonth } from "@/lib/society-time";
import { postPath } from "@/sanity/paths";
import { getSiteChrome } from "@/sanity/site-chrome";
import { CopyNewsletter } from "./copy-newsletter";

export const metadata: Metadata = {
  title: "Monthly digest · Ozark Blues Society",
};

/** How many months the month list offers: this one and the ones before it. */
const MONTHS_LISTED = 12;

// Editors and administrators (backlog E-4). The proxy sends visitors to sign in, and this page
// checks the role. The posts are read as a visitor sees them (lib/newsletter/digest.ts), so a
// members-only post's summary reaches neither this page nor the newsletter, whoever is signed in.
// The heading and intro are the static shell; the rest needs the member, so it streams in at
// request time.
export default function DigestPage({ searchParams }: PageProps<"/admin/digest">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:py-12">
      <h1>Monthly digest</h1>
      <p className="mt-4 text-muted">
        Each month&rsquo;s blog posts marked &ldquo;Include in the monthly email digest&rdquo;, as a
        newsletter in the Society&rsquo;s colors to paste into MailerLite.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading the digest…</p>}>
        <Digest searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

type Loaded = { posts: DigestPost[]; html: string; subject: string; hasAddress: boolean };

async function Digest({ searchParams }: Pick<PageProps<"/admin/digest">, "searchParams">) {
  const user = await requireUser("/admin/digest");
  const now = new Date();
  const thisMonth = societyMonth(now);
  const { month: asked } = await searchParams;
  const month = isMonth(asked) ? asked : thisMonth;
  const loaded = await load(user.id, month, now);

  if (loaded === "not-editor") {
    return (
      <p className="mt-8">
        Only editors and administrators can make the monthly digest. If you need to, ask an
        administrator for the Editor role. <Link href="/account">Back to My Account</Link>
      </p>
    );
  }
  if (loaded === "unavailable") {
    return (
      <p role="alert" className="mt-8 rounded-lg border border-danger bg-danger-soft p-4">
        The digest can&rsquo;t be made right now. Please try again in a few minutes.
      </p>
    );
  }

  const recent = Array.from({ length: MONTHS_LISTED }, (_, index) => addMonths(thisMonth, -index));
  const months = recent.includes(month) ? recent : [month, ...recent];
  const name = monthName(month);
  const { posts, html, subject, hasAddress } = loaded;

  return (
    <>
      <form className="mt-8 flex flex-wrap items-end gap-3">
        <SelectField label="Month" name="month" defaultValue={month} className="w-full max-w-xs">
          {months.map((value) => (
            <option key={value} value={value}>
              {monthName(value)}
            </option>
          ))}
        </SelectField>
        <Button type="submit" variant="ghost">
          Show
        </Button>
      </form>

      <section aria-labelledby="digest-posts" className="mt-10">
        <h2 id="digest-posts">Posts in the {name} digest</h2>
        {posts.length === 0 ? (
          <p className="mt-4">
            No post published in {name} is marked &ldquo;Include in the monthly email digest&rdquo;
            {month === thisMonth ? " yet" : ""}. Turn it on in a post in the Content Studio. A
            scheduled post joins the digest once its publish date has come.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {posts.map((post) => (
              <li key={post.slug} className="rounded-lg border border-line bg-surface p-4">
                <p className="text-small text-muted">
                  {[post.category, formatSocietyDate(post.publishedAt)].filter(Boolean).join(" · ")}
                </p>
                <h3 className="mt-1">
                  <Link href={postPath(post.slug)}>{post.title}</Link>
                </h3>
                {post.membersOnly ? (
                  <>
                    <Tag tone="accent" className="mt-2">
                      Members only
                    </Tag>
                    <p className="mt-2 text-muted">
                      The newsletter gives its headline and a link to sign in, without its summary:
                      the newsletter also reaches people who aren&rsquo;t members.
                    </p>
                  </>
                ) : (
                  post.summary && <p className="mt-2">{post.summary}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {posts.length > 0 && (
        <section aria-labelledby="the-newsletter" className="mt-12">
          <h2 id="the-newsletter">The newsletter</h2>
          <p className="mt-2">
            Copy it, then paste it into MailerLite&rsquo;s custom HTML editor, as the volunteer
            guide&rsquo;s Monthly digest page shows. Suggested subject: &ldquo;{subject}&rdquo;.
          </p>
          {!hasAddress && (
            <p className="mt-4 rounded-lg border border-accent bg-accent-soft p-4 text-sm text-ink">
              The Society&rsquo;s mailing address isn&rsquo;t in Site settings yet, so the
              newsletter&rsquo;s footer has a placeholder where it goes. MailerLite asks for the
              address in every newsletter: add it in the Content Studio under Site settings, then
              come back to this page.
            </p>
          )}
          <CopyNewsletter html={html} />
          <iframe
            title={`Preview of the ${name} newsletter`}
            srcDoc={html}
            // The newsletter has no scripts; its links open in a new tab.
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            className="mt-6 h-[48rem] w-full rounded-lg border border-line bg-white"
          />
        </section>
      )}
    </>
  );
}

async function load(
  userId: string,
  month: string,
  now: Date,
): Promise<Loaded | "not-editor" | "unavailable"> {
  try {
    if (!(await makesDigest(userId))) return "not-editor";
    const [posts, chrome] = await Promise.all([
      loadDigestPosts(month, now),
      getSiteChrome({ perspective: "published", stega: false }),
    ]);
    const mailingAddress = chrome.footer.mailingAddress?.trim() || null;
    const props = { siteUrl: siteUrl(), month, posts, mailingAddress };
    const { html, subject } = await renderEmail(MonthlyNewsletter, props);
    return { posts, html, subject, hasAddress: mailingAddress !== null };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Making the monthly digest failed:", error);
    return "unavailable";
  }
}
