import { EmailLayout } from "./_components/layout";
import { Details, Eyebrow, Note, Paragraph, PrimaryButton, SignOff, Title } from "./_components/ui";
import { formatAmount, formatDate, levelName, siteLink, type MembershipLevel } from "./_lib/format";
import { firstNameOf } from "./_lib/template";

/** How a payment was made: payments.kind (docs/spec/architecture.md). Imports get no receipt. */
export type PaymentMethod = "stripe" | "check" | "cash";

const METHOD_NAMES: Record<PaymentMethod, string> = {
  stripe: "Online payment",
  check: "Check",
  cash: "Cash",
};

export interface ReceiptEmailProps {
  /** The site's address, such as https://example.org. */
  siteUrl: string;
  /** profiles.first_name. Null when the member didn't give one. */
  firstName: string | null;
  /** The level the payment is for. */
  level: MembershipLevel;
  /** The amount paid, in cents: 5000 is $50.00. */
  amountCents: number;
  /** When it was paid (ISO 8601). */
  paidAt: string;
  method: PaymentMethod;
  /** The payment's reference, such as a Stripe receipt number or a check number, if there is one. */
  reference: string | null;
  /** profiles.expires_at after this payment (ISO 8601). */
  expiresAt: string;
}

/**
 * The Society's own confirmation of a dues payment, for card payments and for check or cash
 * payments that staff record. Stripe also sends its own receipt for card payments (decision 0002).
 */
export default function ReceiptEmail(props: ReceiptEmailProps) {
  const { siteUrl, level, amountCents, paidAt, method, reference, expiresAt } = props;
  const firstName = firstNameOf(props.firstName);

  return (
    <EmailLayout
      title={ReceiptEmail.subject()}
      preview={`We received your ${formatAmount(amountCents)} payment for your ${levelName(level)} membership.`}
      reason="You're getting this email because we received a payment for your Ozark Blues Society membership."
      siteUrl={siteUrl}
    >
      <Eyebrow>Payment received</Eyebrow>
      <Title>{firstName ? `Thank you, ${firstName}` : "Thank you for your payment"}</Title>
      <Paragraph>
        We received your membership payment. Thank you for supporting the Ozark Blues Society! Keep
        this email for your records.
      </Paragraph>
      <Details
        rows={[
          { label: "Amount paid", value: formatAmount(amountCents) },
          { label: "Paid on", value: formatDate(paidAt) },
          { label: "Membership", value: levelName(level) },
          { label: "Paid by", value: METHOD_NAMES[method] },
          ...(reference ? [{ label: "Reference", value: reference }] : []),
          { label: "Member until", value: formatDate(expiresAt) },
        ]}
      />
      {method === "stripe" && (
        <Note>
          Stripe, which handles our online payments, also emails you a receipt. You can find the
          receipts for your online payments in My Account.
        </Note>
      )}
      <PrimaryButton href={siteLink(siteUrl, "/account")}>Go to My Account</PrimaryButton>
      <SignOff>With thanks,</SignOff>
    </EmailLayout>
  );
}

ReceiptEmail.subject = () => "Your Ozark Blues Society receipt";

/** Sample props for the preview server and the tests. Synthetic: not a real payment. */
ReceiptEmail.PreviewProps = {
  siteUrl: "http://localhost:3000",
  firstName: "Jordan",
  level: "band",
  amountCents: 5000,
  paidAt: "2026-11-26T18:00:00Z",
  method: "stripe",
  reference: "1234-5678",
  expiresAt: "2027-11-26T18:00:00Z",
} satisfies ReceiptEmailProps;
