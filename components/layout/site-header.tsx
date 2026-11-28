import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import type { NavItem } from "@/lib/site/navigation";
import { HeaderNav, HeaderNavView } from "./header-nav";
import logo from "./obs-logo-white.png";

/** The site header: the Society's logo, the menu, and the visitor's account links. */
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

// The Society's logo from its current website (decision 0014), in its white version for dark
// backgrounds. Its lettering is fine, so it shows 56px high on phones and 64px on larger
// screens. The file is 234 by 192 pixels, enough for screens with three pixels per CSS pixel.
function Logo() {
  return (
    <Link href="/" className="flex h-18 shrink-0 items-center no-underline md:h-20">
      <Image
        src={logo}
        alt="Ozark Blues Society of Northwest Arkansas"
        width={234}
        height={192}
        loading="eager"
        className="h-14 w-auto md:h-16"
      />
    </Link>
  );
}
