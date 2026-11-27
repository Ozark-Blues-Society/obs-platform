import Link from "next/link";
import { TableBlock } from "@/components/blocks/list-blocks";
import { Prose } from "@/components/blocks/prose";
import { BookingContactsNotice } from "@/components/members/booking-contacts-notice";
import { PageTemplate } from "@/components/templates/page-template";
import { LockOverlay } from "@/components/ui/lock-overlay";
import { JOIN_PATH, SIGN_IN_PATH } from "@/lib/site/navigation";
import { PreviewBar } from "../preview-bar";
import { DIRECTORY, DIRECTORY_VIEWS, LOWEST_DUES, type DirectoryView } from "../sample-content";

/**
 * The Directory template, on a members-only page, as each kind of visitor sees it: every member
 * sees the venues, only Band, Business and Sponsor members see booking contacts, and visitors see
 * a lock (docs/spec/board-decisions.md §1). The real directory leaves out on the server whatever
 * the viewer may not see (M-9); these sample pages show the three results.
 */
export function DirectoryPreview({ view }: { view: DirectoryView }) {
  const withContacts = view === "contacts";
  const columns = DIRECTORY.columns.filter(
    (_, index) => withContacts || index !== DIRECTORY.contactColumn,
  );
  const rows = DIRECTORY.rows.map((row) =>
    row.filter((_, index) => withContacts || index !== DIRECTORY.contactColumn),
  );

  return (
    <>
      <PreviewBar current="directory" directoryView={view} />
      <PageTemplate title={DIRECTORY.title} intro={DIRECTORY.intro} membersOnly>
        {view === "visitor" ? (
          <LockOverlay
            description={`Sign in to see the venue directory, or join from ${LOWEST_DUES} a year.`}
            signInHref={`${SIGN_IN_PATH}?next=${encodeURIComponent(DIRECTORY_VIEWS.contacts.href)}`}
            joinHref={JOIN_PATH}
          />
        ) : (
          <>
            <TableBlock
              heading="Venues"
              columns={columns}
              rows={rows}
              searchLabel="Search the directory"
              notice={!withContacts && <BookingContactsNotice />}
            />
            <Prose>
              <p>
                Know a venue we’re missing, or see something out of date?{" "}
                <Link href="/contact">Tell us</Link> and an editor will update the directory.
              </p>
            </Prose>
          </>
        )}
      </PageTemplate>
    </>
  );
}
