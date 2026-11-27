import { BookingContactsNotice } from "@/components/members/booking-contacts-notice";
import { MembersOnlyLock } from "@/components/members/members-only-lock";
import { SectionHeading } from "@/components/ui/section-heading";
import { listDirectory, type DirectoryContact } from "@/sanity/content/directory";
import { TableBlock } from "./list-blocks";

const CONTACT_COLUMN = "Booking contact";

/** "Sam Ortega · booking@example.com · (479) 555-0100", leaving out what isn't filled in. */
function contactText(contact: DirectoryContact | undefined): string {
  return [contact?.name, contact?.email, contact?.phone].filter(Boolean).join(" · ");
}

/**
 * A page's venue directory: a table block that fills itself from the Studio's Directory entries
 * (backlog M-9), searchable, as in the approved concept's Directory page. Members with an active
 * membership see the venues and their details, and Band, Business and Sponsor members their
 * booking contacts too. Individual members get a note saying who sees contacts, and anyone else a
 * lock, whoever can see the page. sanity/content/directory.ts leaves out on the server whatever
 * the viewer may not see, so it never reaches this component. It reads the request, so render it
 * inside `<Suspense>`.
 */
export async function VenueDirectory({
  heading,
  returnTo,
}: {
  heading: string;
  /** This page's path, for coming back after signing in. */
  returnTo: string;
}) {
  const { access, contacts, entries } = await listDirectory();

  if (!access.allowed) {
    return (
      <div>
        <SectionHeading title={heading} />
        <MembersOnlyLock
          reason={access.reason}
          visibility={{ audience: "members" }}
          thing="directory"
          returnTo={returnTo}
          headingLevel={3}
        />
      </div>
    );
  }

  const notice = contacts ? undefined : <BookingContactsNotice />;
  if (entries.length === 0) {
    return (
      <div>
        <SectionHeading title={heading} />
        {notice}
        <p className="text-muted">No venues in the directory yet. Check back soon.</p>
      </div>
    );
  }

  const columns = ["Venue", ...(contacts ? [CONTACT_COLUMN] : []), "Capacity", "Pays", "Notes"];
  const rows = entries.map((entry) => [
    entry.venue,
    ...(contacts ? [contactText(entry.contact)] : []),
    entry.capacity ?? "",
    entry.pay ?? "",
    entry.notes ?? "",
  ]);
  return (
    <TableBlock
      heading={heading}
      columns={columns}
      rows={rows}
      searchLabel="Search the directory"
      notice={notice}
    />
  );
}
