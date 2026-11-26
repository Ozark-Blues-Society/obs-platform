import { connection } from "next/server";
import { checkAccess, type LockReason } from "@/lib/members/access";
import {
  DOWNLOAD_LINK_SECONDS,
  MEMBER_FILES_BUCKET,
  fileVisibility,
  isFileId,
  memberFilePath,
} from "@/lib/members/files";
import { getViewer } from "@/lib/members/viewer";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

// Downloads a members-only file (decision 0001, backlog M-7): the link to a file on a page, post or
// event is /files/<id>. A visitor is sent to sign in first. A member who may download the file is
// sent on to a Storage link that works for DOWNLOAD_LINK_SECONDS. Anyone else gets a page saying
// why not.
//
// Everything happens as the member: row level security shows them the file's row only if their
// membership allows it, this route checks again with the rules pages use (lib/members/access.ts),
// and Storage signs the link only for someone its policies let read the file. Nothing here is
// cached: each request checks the session and the membership again.
export async function GET(_request: Request, { params }: RouteContext<"/files/[id]">) {
  await connection();
  const { id } = await params;
  if (!isFileId(id)) {
    return page(
      404,
      "We couldn&rsquo;t find that file",
      "Check the link, or go back to the page it was on.",
    );
  }
  if (!readSupabaseConfig()) {
    return page(503, "Downloads aren&rsquo;t available right now", "Please try again later.");
  }

  const viewer = await getViewer();
  if (viewer.kind === "visitor") {
    return redirectTo(`/sign-in?next=${encodeURIComponent(memberFilePath(id))}`);
  }

  const supabase = await createClient();
  const { data: file, error } = await supabase
    .from("member_files")
    .select("object_path, file_name, audience, levels")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Reading member file ${id} failed: ${error.code} ${error.message}`);
  }

  const now = new Date();
  const access = file ? checkAccess(fileVisibility(file), viewer, now) : null;
  if (!file || !access?.allowed) {
    // Row level security hides the files a member may not download, so a missing row can mean
    // either. Say what the member can act on: their membership, if it isn't active.
    const membership = checkAccess({ audience: "members" }, viewer, now);
    return refusal(membership.allowed ? "level" : membership.reason);
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(MEMBER_FILES_BUCKET)
    .createSignedUrl(String(file.object_path), DOWNLOAD_LINK_SECONDS, {
      download: String(file.file_name),
    });
  if (signError || !signed?.signedUrl) {
    // The row is there but Storage has no file: an upload that didn't finish.
    console.error(`Member file ${id} has no file in Storage:`, signError);
    return page(
      404,
      "We couldn&rsquo;t find that file",
      "It may have been removed. Please tell the Society.",
    );
  }
  return redirectTo(signed.signedUrl);
}

const HEADERS = {
  // Each answer depends on who is asking, and the Storage link must not be kept or passed on.
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};

function redirectTo(location: string): Response {
  return new Response(null, { status: 303, headers: { ...HEADERS, Location: location } });
}

function refusal(reason: LockReason): Response {
  switch (reason) {
    case "renew":
      return page(
        403,
        "Your membership has ended",
        "Files for members are available again as soon as you renew.",
        { href: "/join", text: "Renew your membership" },
      );
    // Visitors are sent to sign in before this, so "sign-in" means signed in without a membership.
    case "sign-in":
    case "join":
      return page(403, "This file is for members", "Join the Society to download it.", {
        href: "/join",
        text: "Join the Society",
      });
    case "level":
      return page(
        404,
        "This file isn&rsquo;t available to you",
        "It may be for other membership levels, or it may have been removed.",
      );
  }
}

/**
 * A short page for when there's no file to send. It stands alone, without the site's header and
 * footer, so it works however the request got here.
 */
function page(
  status: number,
  heading: string,
  text: string,
  action?: { href: string; text: string },
): Response {
  const links = [
    ...(action ? [`<a href="${action.href}">${action.text}</a>`] : []),
    '<a href="/account">My Account</a>',
    '<a href="/">Ozark Blues Society home</a>',
  ];
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${heading} &middot; Ozark Blues Society</title>
<style>body{font-family:system-ui,sans-serif;line-height:1.5;margin:0;padding:3rem 1.5rem}main{max-width:36rem;margin:0 auto}li{margin:.5rem 0}</style>
</head>
<body>
<main>
<h1>${heading}</h1>
<p>${text}</p>
<ul>${links.map((link) => `<li>${link}</li>`).join("")}</ul>
</main>
</body>
</html>
`;
  return new Response(html, {
    status,
    headers: { ...HEADERS, "Content-Type": "text/html; charset=utf-8" },
  });
}
