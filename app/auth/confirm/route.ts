import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";

/**
 * The sign-in email links here (supabase/templates/magic-link.html). Verifying the link's one-time
 * token hash on the server starts the session, so the link works on whichever device opens it,
 * not only the one that asked for it.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");

  if (tokenHash && searchParams.get("type") === "email") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
    if (!error) {
      redirect(safeNextPath(searchParams.get("next")));
    }
  }

  // Expired, already used, or not a sign-in link at all.
  redirect("/sign-in?error=link-expired");
}
