import { EmailLayout } from "./_components/layout";
import {
  RENEWAL_REMINDER_REASON,
  RenewalReminderDetails,
  type RenewalReminderProps,
} from "./_components/renewal";
import { Eyebrow, Paragraph, SignOff, Title } from "./_components/ui";
import { formatDate, levelName } from "./_lib/format";
import { firstNameOf } from "./_lib/template";

export type RenewalLastReminderEmailProps = RenewalReminderProps;

/**
 * The last renewal reminder, 7 days before a membership ends (board decisions §4), for members who
 * aren't on yearly auto-renew. The daily email job (backlog E-2) sends it. There's no grace period,
 * so it says that members-only access ends with the membership.
 */
export default function RenewalLastReminderEmail(props: RenewalLastReminderEmailProps) {
  const { siteUrl, level, expiresAt } = props;
  const firstName = firstNameOf(props.firstName);
  const date = formatDate(expiresAt);

  return (
    <EmailLayout
      title={RenewalLastReminderEmail.subject(props)}
      preview={`Renew your ${levelName(level)} membership before ${date} to keep your benefits without a break.`}
      reason={RENEWAL_REMINDER_REASON}
      siteUrl={siteUrl}
    >
      <Eyebrow>Last reminder</Eyebrow>
      <Title>
        {firstName ? `Your membership ends soon, ${firstName}` : "Your membership ends soon"}
      </Title>
      <Paragraph>
        Your Ozark Blues Society membership ends on {date}, and this is our last reminder before
        then. If you haven&apos;t renewed by that day, your access to members-only events and pages
        ends with it.
      </Paragraph>
      <RenewalReminderDetails siteUrl={siteUrl} level={level} expiresAt={expiresAt} />
      <SignOff>Thanks for keeping the blues alive,</SignOff>
    </EmailLayout>
  );
}

RenewalLastReminderEmail.subject = ({ expiresAt }: Pick<RenewalReminderProps, "expiresAt">) =>
  `Last reminder: your membership ends on ${formatDate(expiresAt)}`;

/** Sample props for the preview server and the tests. Synthetic: not a real member. */
RenewalLastReminderEmail.PreviewProps = {
  siteUrl: "http://localhost:3000",
  firstName: "Jordan",
  level: "band",
  expiresAt: "2026-12-03T18:00:00Z",
} satisfies RenewalLastReminderEmailProps;
