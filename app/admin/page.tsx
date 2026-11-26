import { redirect } from "next/navigation";

// Roles is the only admin screen so far. The members screen (backlog A-1) comes next.
export default function AdminPage() {
  redirect("/admin/roles");
}
