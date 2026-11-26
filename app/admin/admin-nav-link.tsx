"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** A link in the admin menu, marked as the current page when it is. */
export function AdminNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const current = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className="block rounded-md px-2 py-1.5 text-sm text-muted-on-dark no-underline hover:bg-white/8 hover:text-white aria-[current=page]:bg-white/8 aria-[current=page]:font-semibold aria-[current=page]:text-white"
    >
      {children}
    </Link>
  );
}
