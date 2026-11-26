// For tests only: the Content Studio's workspace, resolved from sanity.config.ts the way the Studio
// resolves it, with a stand-in client, so tests need no Sanity project and no network.
import { createWorkspaceFromConfig, type SingleWorkspace, type Workspace } from "sanity";
import config from "@/sanity.config";
import { apiVersion, dataset, projectId } from "./env";

/** Answers a GROQ query the way the test needs. */
export type Fetch = (query: string, params: Record<string, unknown>) => unknown;

export function stubClient(fetch: Fetch) {
  const client = {
    config: () => ({
      projectId,
      dataset,
      apiVersion,
      url: `https://${projectId}.api.sanity.io/v${apiVersion}`,
    }),
    withConfig: () => client,
    fetch: async (query: string, params?: Record<string, unknown>) => fetch(query, params ?? {}),
  };
  return client;
}

export function createTestWorkspace(fetch: Fetch): Promise<Workspace> {
  return createWorkspaceFromConfig({
    ...(config as SingleWorkspace),
    currentUser: {
      id: "test-editor",
      name: "Test Editor",
      email: "editor@example.com",
      role: "editor",
      roles: [{ name: "editor", title: "Editor" }],
    },
    getClient: () => stubClient(fetch) as never,
  });
}
