import { AdminNavLink } from "./admin-nav-link";

// The admin screens' shell, after the concept's "OBS Admin" (docs/design/prototype.html): a menu
// down the side on wide screens, a row of links above the page on phones. Each page checks the
// member's role itself, because a layout doesn't render again on every navigation.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <nav aria-label="Admin" className="bg-primary-dark px-4 py-3 md:w-56 md:shrink-0 md:py-6">
        <p className="px-2 font-serif text-lg text-white">OBS Admin</p>
        <ul className="mt-2 flex flex-wrap gap-1 md:mt-4 md:flex-col">
          <li>
            <AdminNavLink href="/admin/roles">Roles</AdminNavLink>
          </li>
          <li>
            <AdminNavLink href="/">View the website</AdminNavLink>
          </li>
        </ul>
      </nav>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
