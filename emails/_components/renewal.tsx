// What the renewal reminders (30 and 7 days before a membership ends) and the lapsed note (14 days
// after) share. Members renew the way they join: on the Join page, signed in (backlog M-4).
import { JOIN_PATH } from "../../lib/site/navigation";
import { formatDate, levelName, siteLink, type MembershipLevel } from "../_lib/format";
import { Details, Note, Paragraph, PrimaryButton } from "./ui";

export interface RenewalReminderProps {
  /** The site's address, such as https://example.org. */
  siteUrl: string;
  /** profiles.first_name. Null when the member didn't give one. */
  firstName: string | null;
  level: MembershipLevel;
  /** profiles.expires_at (ISO 8601): when the membership ends. */
  expiresAt: string;
}

/**
 * The footer's reason for both reminders. They go only to members who aren't on yearly auto-renew;
 * Stripe emails those who are (docs/spec/architecture.md, "Scheduled jobs").
 */
export const RENEWAL_REMINDER_REASON =
  "You're getting this email because your Ozark Blues Society membership ends soon and isn't set to renew automatically.";

/** The rest of a reminder after its opening paragraph: the membership, how to renew, the button. */
export function RenewalReminderDetails({
  siteUrl,
  level,
  expiresAt,
}: Pick<RenewalReminderProps, "siteUrl" | "level" | "expiresAt">) {
  return (
    <>
      <Details
        rows={[
          { label: "Membership", value: levelName(level) },
          { label: "Member until", value: formatDate(expiresAt) },
        ]}
      />
      <Paragraph>
        Renewing takes a few minutes online. Pay for another year, or choose yearly auto-renew so
        you don&apos;t have to remember next time.
      </Paragraph>
      <RenewButton siteUrl={siteUrl} />
    </>
  );
}

/** The button to the Join page, where members renew, and how to sign in there. */
export function RenewButton({ siteUrl }: { siteUrl: string }) {
  return (
    <>
      <PrimaryButton href={siteLink(siteUrl, JOIN_PATH)}>Renew your membership</PrimaryButton>
      <Note>
        If the site asks you to sign in, enter the address this email was sent to, and we&apos;ll
        email you a sign-in link.
      </Note>
    </>
  );
}
