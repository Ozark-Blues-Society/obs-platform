import { redirect } from "next/navigation";

// The admin screens so far are Roles, Members-only files, Monthly digest and the Classifieds queue;
// the admin menu links them. The members screen (backlog A-1) comes next.
export default function AdminPage() {
  redirect("/admin/roles");
}
