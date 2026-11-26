import { redirect } from "next/navigation";

// The admin screens so far are Roles and Members-only files; the admin menu links both. The
// members screen (backlog A-1) comes next.
export default function AdminPage() {
  redirect("/admin/roles");
}
