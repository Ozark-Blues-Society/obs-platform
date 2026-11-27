import Link from "next/link";
import { LockIcon } from "@/components/ui/lock-icon";
import { BOOKING_CONTACT_LEVELS } from "@/lib/members/access";
import { JOIN_PATH } from "@/lib/site/navigation";
import { levelTitles } from "./members-only-lock";

/**
 * The note above the venue directory for members who don't see its booking contacts: Individual
 * members (board-decisions §1). It says who does, and links to the membership levels.
 */
export function BookingContactsNotice() {
  return (
    <p className="mb-4 flex items-start gap-2 rounded-card bg-accent-soft p-3 text-small text-ink">
      <LockIcon className="mt-0.5 size-3.5 flex-none" />
      <span>
        {`Booking contacts are for ${levelTitles(BOOKING_CONTACT_LEVELS)} members. `}
        <Link href={JOIN_PATH} className="text-ink focus-visible:outline-primary-dark">
          Compare membership levels
        </Link>
      </span>
    </p>
  );
}
