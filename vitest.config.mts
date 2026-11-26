import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror the "@/*" path alias from tsconfig.json.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: [
      "node_modules/**",
      ".next/**",
      // Playwright specs live in e2e/ and run with `pnpm test:e2e`.
      "e2e/**",
      // Local agent and issue-tracker state (agent worktrees live in .claude/worktrees/).
      ".beads/**",
      ".claude/**",
      ".gc/**",
    ],
  },
});
