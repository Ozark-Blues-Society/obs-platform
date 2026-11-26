import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listMemberFiles, managesMemberFiles } from "@/lib/admin/member-files";
import {
  prepareUpload,
  removeMemberFile,
  saveUploadedFile,
} from "@/lib/admin/member-files-actions";
import type { MemberFileRow } from "@/lib/admin/member-files-state";
import { requireUser } from "@/lib/auth/user";
import { FileList } from "./file-list";
import { UploadFileForm } from "./upload-file-form";

export const metadata: Metadata = {
  title: "Members-only files · Ozark Blues Society",
};

// Editors and administrators (backlog M-7). The proxy sends visitors to sign in. This page checks
// the role, and so does each Server Function (lib/admin/member-files-actions.ts); row level
// security and the Storage policies enforce it too. The heading and intro are the static shell;
// the rest needs the member, so it streams in at request time.
export default function MemberFilesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:py-12">
      <h1>Members-only files</h1>
      <p className="mt-4 text-muted">
        Files kept here can be downloaded only by signed-in members whose membership allows it,
        never by the public. Upload a file, then add it to a page, post or event in the Content
        Studio with its code.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading files…</p>}>
        <ManageFiles />
      </Suspense>
    </main>
  );
}

async function ManageFiles() {
  const user = await requireUser("/admin/files");
  const files = await loadFiles(user.id);

  if (files === "not-editor") {
    return (
      <p className="mt-8">
        Only editors and administrators can manage members-only files. If you need to, ask an
        administrator for the Editor role. <Link href="/account">Back to My Account</Link>
      </p>
    );
  }
  if (files === "unavailable") {
    return (
      <p role="alert" className="mt-8 rounded-lg border border-danger bg-danger-soft p-4">
        The files can&rsquo;t be shown right now. Please try again in a few minutes.
      </p>
    );
  }

  return (
    <>
      <section aria-labelledby="upload-a-file" className="mt-10">
        <h2 id="upload-a-file">Upload a file</h2>
        <UploadFileForm prepare={prepareUpload} save={saveUploadedFile} />
      </section>
      <section aria-labelledby="the-files" className="mt-12">
        <h2 id="the-files">Files</h2>
        <p className="mt-2 text-muted">
          Removing a file stops it downloading at once, and links to it on the website stop working.
        </p>
        <FileList files={files} action={removeMemberFile} />
      </section>
    </>
  );
}

async function loadFiles(userId: string): Promise<MemberFileRow[] | "not-editor" | "unavailable"> {
  try {
    if (!(await managesMemberFiles(userId))) return "not-editor";
    return await listMemberFiles();
  } catch (error) {
    console.error("Loading the members-only files failed:", error);
    return "unavailable";
  }
}
