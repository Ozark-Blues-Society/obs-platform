import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import type { NavItem } from "@/lib/site/navigation";
import { HeaderNav, HeaderNavView } from "./header-nav";

/** The site header: the Society's name, the menu, and the visitor's account links. */
export function SiteHeader({ items, account }: { items: NavItem[]; account: ReactNode }) {
  return (
    <header className="bg-primary-dark text-white">
      <div className="mx-auto flex max-w-site flex-wrap items-center gap-x-3 px-gutter min-[360px]:gap-x-4">
        <Logo />
        {/* HeaderNav reads the path to mark the current page. On a route whose path is only known
            per request, that suspends, and this fallback (the same menu, unmarked) is prerendered. */}
        <Suspense fallback={<HeaderNavView items={items} account={account} pathname={null} />}>
          <HeaderNav items={items} account={account} />
        </Suspense>
      </div>
    </header>
  );
}

// A stand-in for the Society's logo, drawn like the concept's, until the real one arrives
// (docs/spec/board-decisions.md, "Brand and content").
function Logo() {
  return (
    <Link href="/" className="flex h-18 shrink-0 items-center gap-2.5 text-white no-underline">
      <svg aria-hidden="true" viewBox="0 0 40 40" className="size-10 shrink-0">
        <circle
          cx="20"
          cy="20"
          r="19"
          className="fill-primary-light stroke-accent"
          strokeWidth="2"
        />
        <circle cx="20" cy="20" r="10" className="fill-accent" />
        <circle cx="20" cy="20" r="8.5" className="fill-primary-dark" />
      </svg>
      <span className="font-serif text-lg leading-none min-[360px]:text-xl">
        Ozark Blues Society
        <span className="mt-1 block font-sans text-[0.625rem] tracking-[0.12em] text-accent-light uppercase min-[360px]:tracking-[0.2em]">
          Keeping the blues alive
        </span>
      </span>
    </Link>
  );
}
