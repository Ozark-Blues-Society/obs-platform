import { ROLES } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { personName, type StaffMember } from "./roles-state";

type StaffRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  user_roles: { role: string }[];
};

/**
 * Everyone with a staff role, by name. It reads as the signed-in member, so row level security
 * gives everyone only to an administrator; anyone else gets at most themselves. Throws if the
 * list can't be read.
 *
 * Not a Server Function: anyone can call those, so keep this file free of "use server".
 */
export async function listStaff(): Promise<StaffMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, user_roles!inner(role)")
    .order("last_name", { nullsFirst: false })
    .order("first_name", { nullsFirst: false })
    .order("email");
  if (error) {
    throw new Error(`Listing staff failed: ${error.code} ${error.message}`);
  }
  return ((data ?? []) as StaffRow[]).map((row) => {
    const held = new Set(row.user_roles.map(({ role }) => role));
    return {
      id: row.id,
      name: personName(row),
      email: row.email,
      roles: ROLES.filter((role) => held.has(role)),
    };
  });
}
