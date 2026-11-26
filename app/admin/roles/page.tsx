import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { grantRole, revokeRole } from "@/lib/admin/roles-actions";
import type { StaffMember } from "@/lib/admin/roles-state";
import { listStaff } from "@/lib/admin/staff";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/roles";
import { getRoles, requireUser } from "@/lib/auth/user";
import { GrantRoleForm } from "./grant-role-form";
import { StaffList } from "./staff-list";

export const metadata: Metadata = {
  title: "Roles · Ozark Blues Society",
};

// Administrators only (backlog A-2). The proxy sends visitors to sign in. This page checks the
// Administrator role, and so does each Server Function (lib/admin/roles-actions.ts); row level
// security enforces it in the database. The heading and intro are the static shell; the rest needs
// the member, so it streams in at request time.
export default function RolesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:py-12">
      <h1>Roles</h1>
      <p className="mt-4 text-muted">
        Roles let volunteers use the website&rsquo;s admin screens. Only administrators can give and
        remove them.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading roles…</p>}>
        <ManageRoles />
      </Suspense>
    </main>
  );
}

async function ManageRoles() {
  const user = await requireUser("/admin/roles");
  const staff = await loadStaff(user.id);

  if (staff === "not-admin") {
    return (
      <p className="mt-8">
        Only administrators can give and remove roles. If you need a role, ask an administrator.{" "}
        <Link href="/account">Back to My Account</Link>
      </p>
    );
  }
  if (staff === "unavailable") {
    return (
      <p role="alert" className="mt-8 rounded-lg border border-danger bg-danger-soft p-4">
        The roles can&rsquo;t be shown right now. Please try again in a few minutes.
      </p>
    );
  }

  return (
    <>
      <section aria-labelledby="give-a-role" className="mt-10">
        <h2 id="give-a-role">Give someone a role</h2>
        <dl className="mt-4 space-y-2">
          {ROLES.map((role) => (
            <div key={role}>
              <dt className="inline font-semibold">{ROLE_LABELS[role]}: </dt>
              <dd className="inline">{ROLE_DESCRIPTIONS[role]}</dd>
            </div>
          ))}
        </dl>
        <GrantRoleForm action={grantRole} />
      </section>
      <section aria-labelledby="people-with-roles" className="mt-12">
        <h2 id="people-with-roles">People with roles</h2>
        <p className="mt-2 text-muted">
          There&rsquo;s always at least one administrator. To hand the role over, give it to someone
          else, then remove your own.
        </p>
        <StaffList staff={staff} currentUserId={user.id} action={revokeRole} />
      </section>
    </>
  );
}

async function loadStaff(userId: string): Promise<StaffMember[] | "not-admin" | "unavailable"> {
  try {
    if (!(await getRoles(userId)).includes("admin")) {
      return "not-admin";
    }
    return await listStaff();
  } catch (cause) {
    console.error("Loading the roles screen failed:", cause);
    return "unavailable";
  }
}
