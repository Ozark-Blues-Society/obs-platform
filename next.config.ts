import type { NextConfig } from "next";
import { checkEnv } from "./lib/env/schema.ts";

// `next build`, `next dev` and `next start` load this file first, after Next.js has read the .env
// files: an environment variable that is set but invalid stops them here, with a message naming it
// (lib/env, backlog F-4).
checkEnv(process.env);

const nextConfig: NextConfig = {
  // Both stay on, on Netlify too (docs/decisions/0008-cache-components.md).
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
