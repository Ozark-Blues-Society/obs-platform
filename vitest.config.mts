import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirror the "@/*" path alias from tsconfig.json.
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // Next.js handles `import "server-only"` itself, with no package installed; in tests it does
      // nothing, as in Next.js's own server build.
      "server-only": fileURLToPath(
        new URL("./node_modules/next/dist/compiled/server-only/empty.js", import.meta.url),
      ),
    },
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
