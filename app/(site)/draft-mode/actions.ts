"use server";

import { draftMode } from "next/headers";

/** Leaves draft mode. Next.js then re-renders the page with published content. */
export async function exitPreview() {
  const draft = await draftMode();
  draft.disable();
}
