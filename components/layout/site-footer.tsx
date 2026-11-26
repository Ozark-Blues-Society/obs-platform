import Link from "next/link";
import type { NavLink } from "@/lib/site/navigation";
import type { FooterSettings } from "@/sanity/site-chrome";

const HEADING = "mb-2 font-serif text-lg text-white";
const LINK = "text-muted-on-dark no-underline hover:text-white hover:underline";

type SiteFooterProps = {
  /** The link columns (buildFooterNav). */
  columns: { heading: string; links: NavLink[] }[];
  /** The footer's Site settings from the Studio. */
  settings: FooterSettings;
};

/** The site footer: who the Society is, how to reach it, and the footer's links. */
export function SiteFooter({ columns, settings }: SiteFooterProps) {
  const { about, mailingAddress, email, phone, socialLinks } = settings;

  return (
    <footer className="bg-primary-dark py-10 text-sm text-muted-on-dark">
      <div className="mx-auto grid max-w-site gap-8 px-gutter lg:grid-cols-4">
        <div>
          <h2 className={HEADING}>Ozark Blues Society</h2>
          {about && <p>{about}</p>}
          {(mailingAddress || email || phone) && (
            <address className="mt-3 flex flex-col gap-1 not-italic">
              {mailingAddress && <p className="whitespace-pre-line">{mailingAddress}</p>}
              {email && (
                <a href={email.href} className={LINK}>
                  {email.text}
                </a>
              )}
              {phone && (
                <a href={phone.href} className={LINK}>
                  {phone.text}
                </a>
              )}
            </address>
          )}
        </div>
        <nav aria-label="Footer" className="grid gap-8 sm:grid-cols-3 lg:col-span-3">
          {columns.map((column) => (
            <LinkColumn key={column.heading} heading={column.heading} links={column.links} />
          ))}
          {socialLinks.length > 0 && <LinkColumn heading="Stay in touch" links={socialLinks} />}
        </nav>
      </div>
    </footer>
  );
}

function LinkColumn({ heading, links }: { heading: string; links: NavLink[] }) {
  return (
    <div>
      <h2 className={HEADING}>{heading}</h2>
      <ul className="flex flex-col gap-1">
        {links.map((link, index) => (
          <li key={index}>
            {link.href.startsWith("/") ? (
              <Link href={link.href} className={LINK}>
                {link.label}
              </Link>
            ) : (
              <a href={link.href} className={LINK}>
                {link.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
