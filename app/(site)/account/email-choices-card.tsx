import { Card } from "@/components/ui/card";
import { memberAddress } from "@/lib/account/email-choices";
import { saveEmailChoicesAction } from "@/lib/account/email-choices-actions";
import { EMAIL_CHOICES_MESSAGES } from "@/lib/account/email-choices-state";
import { requireUser } from "@/lib/auth/user";
import { serverEnv } from "@/lib/env/server";
import { getMailerLiteClient, MAILERLITE_ENV } from "@/lib/mailerlite/client";
import { readEmailChoices, type EmailChoicesState } from "@/lib/mailerlite/topics";
import { ACCOUNT_PATH } from "@/lib/site/navigation";
import { EmailChoicesForm } from "./email-choices-form";

/**
 * The email switches on My Account (decision 0016), read from MailerLite each time: MailerLite is
 * the only record of them. Nothing while MailerLite isn't connected (MAILERLITE_API_KEY). It waits
 * on MailerLite, so the page gives it its own <Suspense> boundary.
 */
export async function EmailChoicesCard() {
  const user = await requireUser(ACCOUNT_PATH);
  const client = getMailerLiteClient(serverEnv(...MAILERLITE_ENV));
  if (!client) return null;

  let initial: EmailChoicesState | null = null;
  try {
    const member = await memberAddress(user);
    if (member) initial = await readEmailChoices(client, member);
  } catch (error) {
    console.error(
      "Reading a member's email choices from MailerLite failed:",
      error instanceof Error ? error.message : String(error),
    );
  }

  return (
    <Card as="section" aria-labelledby="email-choices-heading" className="p-5.5">
      <p className="text-eyebrow text-accent-dark uppercase">Email</p>
      <h2 id="email-choices-heading" className="mt-1.5 text-h3">
        Newsletter and announcements
      </h2>
      {initial ? (
        <EmailChoicesForm action={saveEmailChoicesAction} initial={initial} />
      ) : (
        <p role="alert" className="mt-3 text-sm">
          {EMAIL_CHOICES_MESSAGES.cantShow}
        </p>
      )}
    </Card>
  );
}
