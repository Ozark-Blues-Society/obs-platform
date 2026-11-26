"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { isCurrentPage, isInSection, type NavItem, type NavLink } from "@/lib/site/navigation";

type HeaderNavProps = {
  items: NavItem[];
  /** Sign in and Join, or My Account (account-links.tsx). */
  account: ReactNode;
};

/** The header's menu and account links, marking the page the visitor is on. */
export function HeaderNav(props: HeaderNavProps) {
  return <HeaderNavView {...props} pathname={usePathname()} />;
}

/**
 * The header's menu and account links. From the `lg` breakpoint up, the menu sits in the bar and a
 * group opens as a dropdown. Below it, a Menu button opens the whole menu under the bar, and below
 * `sm` the account links move into it too. Escape closes what's open and returns focus to the
 * button that opened it. `pathname` is null while the route's path isn't known (site-header.tsx).
 */
export function HeaderNavView({
  items,
  account,
  pathname,
}: HeaderNavProps & { pathname: string | null }) {
  const menuId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  // The page the menu was opened on, so that moving to another page closes it.
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null);
  const page = pathname ?? "";
  const menuOpen = menuOpenOn === page;

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpenOn(null);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <>
      {/* The menu takes the bar's free space and wraps onto a second line inside it when an
          editor adds many entries, so the account links stay beside it. */}
      <nav aria-label="Main" className="hidden min-w-0 flex-1 lg:block">
        <DesktopMenu items={items} pathname={pathname} />
      </nav>
      <div className="hidden shrink-0 items-center gap-2 sm:ml-auto sm:flex lg:ml-0">{account}</div>
      <button
        ref={menuButton}
        type="button"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={() => setMenuOpenOn(menuOpen ? null : page)}
        className="ml-auto inline-flex items-center gap-2 rounded-md border border-white/30 px-3 py-2 text-sm font-semibold text-white hover:bg-white/8 sm:ml-0 lg:hidden"
      >
        <MenuIcon open={menuOpen} />
        {/* On the narrowest phones the button shows only its icon; screen readers still hear Menu. */}
        <span className="max-[359px]:sr-only">Menu</span>
      </button>
      <div
        id={menuId}
        hidden={!menuOpen}
        className="basis-full border-t border-white/15 pt-2 pb-5 lg:hidden"
      >
        <nav aria-label="Main">
          <PhoneMenu items={items} pathname={pathname} onNavigate={() => setMenuOpenOn(null)} />
        </nav>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/15 pt-4 sm:hidden">
          {account}
        </div>
      </div>
    </>
  );
}

const linkTone = (on: boolean) =>
  on ? "bg-white/8 text-white" : "text-muted-on-dark hover:bg-white/8 hover:text-white";

function DesktopMenu({ items, pathname }: { items: NavItem[]; pathname: string | null }) {
  // The open group, with the page it was opened on (moving to another page closes it).
  const [open, setOpen] = useState<{ label: string; on: string | null } | null>(null);

  return (
    <ul className="flex flex-wrap items-center justify-end gap-0.5">
      {items.map((item, index) =>
        item.kind === "link" ? (
          <li key={index}>
            <MenuLink
              link={item}
              pathname={pathname}
              className="block rounded-md px-2.5 py-2 text-sm"
            />
          </li>
        ) : (
          <MenuGroup
            key={index}
            label={item.label}
            links={item.links}
            pathname={pathname}
            open={open?.label === item.label && open.on === pathname}
            onOpenChange={(isOpen) => setOpen(isOpen ? { label: item.label, on: pathname } : null)}
          />
        ),
      )}
    </ul>
  );
}

function MenuGroup({
  label,
  links,
  pathname,
  open,
  onOpenChange,
}: {
  label: string;
  links: NavLink[];
  pathname: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const listId = useId();
  const container = useRef<HTMLLIElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const focusWasInside = container.current?.contains(document.activeElement) ?? false;
      onOpenChange(false);
      if (focusWasInside) button.current?.focus();
    };
    // A click or tap anywhere else closes the group.
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !container.current?.contains(event.target)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onOpenChange]);

  return (
    <li
      ref={container}
      className="relative"
      onBlur={(event) => {
        // Tabbing out of the group closes it.
        const next = event.relatedTarget;
        if (open && next instanceof Node && !event.currentTarget.contains(next))
          onOpenChange(false);
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => onOpenChange(!open)}
        className={`flex items-center gap-1 rounded-md px-2.5 py-2 text-sm ${linkTone(
          open || links.some((link) => isInSection(link.href, pathname)),
        )}`}
      >
        {label}
        <ChevronIcon open={open} />
      </button>
      <ul
        id={listId}
        hidden={!open}
        className="absolute top-full left-1/2 z-30 mt-1 w-max max-w-72 min-w-48 -translate-x-1/2 rounded-card bg-primary-dark p-2 shadow-card ring-1 ring-white/15"
      >
        {links.map((link, index) => (
          <li key={index}>
            <MenuLink
              link={link}
              pathname={pathname}
              onNavigate={() => onOpenChange(false)}
              className="block rounded-md px-3 py-2 text-sm"
            />
          </li>
        ))}
      </ul>
    </li>
  );
}

function PhoneMenu({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string | null;
  onNavigate: () => void;
}) {
  const groupId = useId();
  const linkClass = "block rounded-md px-3 py-2.5 text-body";

  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item, index) =>
        item.kind === "link" ? (
          <li key={index}>
            <MenuLink
              link={item}
              pathname={pathname}
              onNavigate={onNavigate}
              className={linkClass}
            />
          </li>
        ) : (
          <li key={index} className="pt-3">
            <p
              id={`${groupId}-${index}`}
              className="px-3 pb-1 text-eyebrow text-accent-light uppercase"
            >
              {item.label}
            </p>
            <ul aria-labelledby={`${groupId}-${index}`} className="flex flex-col gap-0.5">
              {item.links.map((link, linkIndex) => (
                <li key={linkIndex}>
                  <MenuLink
                    link={link}
                    pathname={pathname}
                    onNavigate={onNavigate}
                    className={linkClass}
                  />
                </li>
              ))}
            </ul>
          </li>
        ),
      )}
    </ul>
  );
}

/** A menu link: "page" for screen readers when it's the current page, highlighted in its section. */
function MenuLink({
  link,
  pathname,
  className,
  onNavigate,
}: {
  link: NavLink;
  pathname: string | null;
  className: string;
  onNavigate?: () => void;
}) {
  const current = isCurrentPage(link.href, pathname);
  const props = {
    className: `${className} no-underline ${linkTone(current || isInSection(link.href, pathname))}`,
    "aria-current": current ? ("page" as const) : undefined,
    onClick: onNavigate,
  };
  return link.href.startsWith("/") ? (
    <Link href={link.href} {...props}>
      {link.label}
    </Link>
  ) : (
    <a href={link.href} {...props}>
      {link.label}
    </a>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 5.5h14M3 10h14M3 14.5h14" />}
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 4.5L6 8l3.5-3.5" />
    </svg>
  );
}
