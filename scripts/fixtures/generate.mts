/**
 * Regenerates supabase/seed.sql from the fixtures: `pnpm fixtures:generate`.
 * Node runs these TypeScript modules directly (type stripping): hence the .mts files and extensions.
 */
import { writeFileSync } from "node:fs";
import { buildSeedSql, SEED_SQL_PATH } from "./seed-sql.mts";

writeFileSync(SEED_SQL_PATH, buildSeedSql());
console.log(`Wrote ${SEED_SQL_PATH}`);
