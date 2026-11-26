import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext } from "@playwright/test";
import { PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-auth";

// Members-only files (backlog M-7) for end-to-end tests, made and removed through Supabase's own
// APIs as the fixture editor, the way the site's admin screens will. Every fixture member signs in
// locally with this password (scripts/fixtures/members.mts).
export const FIXTURE_PASSWORD = "obs-local-dev";
export const EDITOR = "morgan.hale@example.com";

const BUCKET = "member-files";

/** Signs `email` in through Supabase Auth and returns their access token. */
export async function accessToken(request: APIRequestContext, email: string): Promise<string> {
  const response = await request.post(`${SUPABASE_URL}/auth/v1/token`, {
    params: { grant_type: "password" },
    headers: { apikey: PUBLISHABLE_KEY },
    data: { email, password: FIXTURE_PASSWORD },
  });
  expect(response.ok(), `signing in ${email}`).toBe(true);
  return ((await response.json()) as { access_token: string }).access_token;
}

/** Headers for Supabase's APIs: as `token`'s member, or as a visitor without one. */
export function supabaseHeaders(token?: string): Record<string, string> {
  return token
    ? { apikey: PUBLISHABLE_KEY, authorization: `Bearer ${token}` }
    : { apikey: PUBLISHABLE_KEY };
}

export type TestFile = {
  id: string;
  title: string;
  objectPath: string;
  fileName: string;
  /** The file's text: a test checks that it never reaches anyone who may not download it. */
  body: string;
};

/** Uploads a text file to the bucket and adds its row, as the editor. */
export async function addMemberFile(
  request: APIRequestContext,
  editorToken: string,
  {
    title,
    audience,
    levels = [],
  }: { title: string; audience: "members" | "levels"; levels?: string[] },
): Promise<TestFile> {
  const id = randomUUID();
  const file = {
    id,
    title,
    objectPath: `${id}/test-file.txt`,
    fileName: `${title}.txt`,
    body: `Members-only test file ${id}`,
  };
  const upload = await request.post(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${file.objectPath}`,
    {
      headers: { ...supabaseHeaders(editorToken), "content-type": "text/plain" },
      data: file.body,
    },
  );
  expect(upload.ok(), `uploading ${title}: ${await upload.text()}`).toBe(true);
  const row = await request.post(`${SUPABASE_URL}/rest/v1/member_files`, {
    headers: supabaseHeaders(editorToken),
    data: {
      id,
      title,
      object_path: file.objectPath,
      file_name: file.fileName,
      audience,
      levels,
    },
  });
  expect(row.status(), `adding ${title}'s row: ${await row.text()}`).toBe(201);
  return file;
}

/** Removes a file's row, then the file itself, as the editor. */
export async function removeMemberFile(
  request: APIRequestContext,
  editorToken: string,
  file: TestFile,
): Promise<void> {
  const row = await request.delete(`${SUPABASE_URL}/rest/v1/member_files`, {
    headers: supabaseHeaders(editorToken),
    params: { id: `eq.${file.id}` },
  });
  expect(row.ok(), `removing ${file.title}'s row`).toBe(true);
  const object = await request.delete(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    headers: supabaseHeaders(editorToken),
    data: { prefixes: [file.objectPath] },
  });
  expect(object.ok(), `removing ${file.title} from Storage`).toBe(true);
}

/**
 * Every way Supabase's APIs could hand out a file, tried as `token`'s member (or a visitor):
 * reading its row through the Data API, listing its folder, downloading it with the session,
 * downloading it as if the bucket were public, and signing a download link.
 */
export async function readThroughSupabase(
  request: APIRequestContext,
  file: TestFile,
  token?: string,
) {
  const headers = supabaseHeaders(token);
  const object = `${SUPABASE_URL}/storage/v1/object`;
  const [row, list, download, publicDownload, sign] = await Promise.all([
    request.get(`${SUPABASE_URL}/rest/v1/member_files`, {
      headers,
      params: { select: "title", id: `eq.${file.id}` },
    }),
    request.post(`${object}/list/${BUCKET}`, { headers, data: { prefix: file.id } }),
    request.get(`${object}/authenticated/${BUCKET}/${file.objectPath}`, { headers }),
    request.get(`${object}/public/${BUCKET}/${file.objectPath}`),
    request.post(`${object}/sign/${BUCKET}/${file.objectPath}`, {
      headers,
      data: { expiresIn: 60 },
    }),
  ]);
  return {
    row: { status: row.status(), text: await row.text() },
    list: { status: list.status(), text: await list.text() },
    download: { status: download.status(), text: await download.text() },
    publicDownload: { status: publicDownload.status(), text: await publicDownload.text() },
    sign: { status: sign.status(), text: await sign.text() },
  };
}
