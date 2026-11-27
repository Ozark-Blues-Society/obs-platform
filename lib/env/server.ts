// The server-only environment variables, checked by lib/env/schema.ts. They include the secrets,
// so this module is server-only: importing it into browser code fails the build.
import "server-only";
import { parseServerEnv, type ServerEnv, type ServerKey } from "./schema.ts";

/**
 * The given server-only variables (all of them when none is named), checked. Name just the ones
 * the calling code uses, so a mistake in another variable doesn't stop it. Throws an EnvError.
 */
export function serverEnv<K extends ServerKey = ServerKey>(...keys: K[]): Pick<ServerEnv, K> {
  return parseServerEnv(process.env, keys);
}
