import { EmailLayout } from "./_components/layout";
import {
  RENEWAL_REMINDER_REASON,
  RenewalReminderDetails,
  type RenewalReminderProps,
} from "./_components/renewal";
import { Eyebrow, Paragraph, SignOff, Title } from "./_components/ui";
import { formatDate, levelName } from "./_lib/format";
import { firstNameOf } from "./_lib/template";

export type RenewalReminderEmailProps = RenewalReminderProps;

/**
 * The first renewal reminder, 30 days before a membership ends (board decisions §4), for members
 * who aren't on yearly auto-renew. The daily email job (backlog E-2) sends it. The last reminder,
 * 7 days before, is renewal-last-reminder.tsx.
 */
export default function RenewalReminderEmail(props: RenewalReminderEmailProps) {
  const { siteUrl, level, expiresAt } = props;
  const firstName = firstNameOf(props.firstName);
  const date = formatDate(expiresAt);

  return (
    <EmailLayout
      title={RenewalReminderEmail.subject()}
      preview={`Your ${levelName(level)} membership ends on ${date}. Renew online to keep your benefits.`}
      reason={RENEWAL_REMINDER_REASON}
      siteUrl={siteUrl}
    >
      <Eyebrow>Renewal reminder</Eyebrow>
      <Title>{firstName ? `Time to renew, ${firstName}` : "Time to renew your membership"}</Title>
      <Paragraph>
        Thank you for being a member of the Ozark Blues Society! Your membership ends on {date}.
        Renew before then to keep your benefits, including members-only events and pages, without a
        break.
      </Paragraph>
      <RenewalReminderDetails siteUrl={siteUrl} level={level} expiresAt={expiresAt} />
      <SignOff>Thanks for keeping the blues alive,</SignOff>
    </EmailLayout>
  );
}

RenewalReminderEmail.subject = () => "Time to renew your Ozark Blues Society membership";

/** Sample props for the preview server and the tests. Synthetic: not a real member. */
RenewalReminderEmail.PreviewProps = {
  siteUrl: "http://localhost:3000",
  firstName: "Jordan",
  level: "band",
  expiresAt: "2026-12-26T18:00:00Z",
} satisfies RenewalReminderEmailProps;
