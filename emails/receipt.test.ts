// @vitest-environment node
import { describe, expect, it } from "vitest";
import ReceiptEmail, { type ReceiptEmailProps } from "./receipt";
import { renderEmail } from "./render";

const props = ReceiptEmail.PreviewProps;
const renderReceipt = (overrides: Partial<ReceiptEmailProps> = {}) =>
  renderEmail(ReceiptEmail, { ...props, ...overrides });

describe("receipt email", () => {
  it("confirms an online payment with its details", async () => {
    const { subject, html, text } = await renderReceipt();

    expect(subject).toBe("Your Ozark Blues Society receipt");
    expect(html).toContain("Thank you, Jordan");
    expect(text).toMatch(/Amount paid +\$50\.00\n/);
    expect(text).toMatch(/Paid on +November 26, 2026\n/);
    expect(text).toMatch(/Membership +Band\n/);
    expect(text).toMatch(/Paid by +Online payment\n/);
    expect(text).toMatch(/Reference +1234-5678\n/);
    expect(text).toMatch(/Member until +November 26, 2027\n/);
  });

  it("points online payers to Stripe's receipt and My Account", async () => {
    const { html, text } = await renderReceipt({ siteUrl: "https://example.org" });

    expect(text).toContain("Stripe, which handles our online payments, also emails you a receipt.");
    expect(html).toContain('href="https://example.org/account"');
    expect(text).toContain("Go to My Account https://example.org/account");
  });

  it("confirms a check or cash payment that staff recorded, without mentioning Stripe", async () => {
    const check = await renderReceipt({ method: "check", reference: "Check 1042" });
    expect(check.text).toMatch(/Paid by +Check\n/);
    expect(check.text).toMatch(/Reference +Check 1042\n/);
    expect(check.text).not.toContain("Stripe");

    const cash = await renderReceipt({ method: "cash", reference: null });
    expect(cash.text).toMatch(/Paid by +Cash\n/);
    expect(cash.text).not.toContain("Reference");
    expect(cash.text).not.toContain("Stripe");
  });

  it("shows the amount for each level's dues", async () => {
    const { html, text } = await renderReceipt({ level: "sponsor", amountCents: 50000 });

    expect(text).toMatch(/Amount paid +\$500\.00\n/);
    expect(text).toMatch(/Membership +Sponsor\n/);
    expect(html).toContain("We received your $500.00 payment for your Sponsor membership.");
  });

  it("dates the payment in the Society's time zone", async () => {
    // 9:30 PM on Nov 26 in the Ozarks is already Nov 27 in UTC.
    const { text } = await renderReceipt({ paidAt: "2026-11-27T03:30:00Z" });

    expect(text).toMatch(/Paid on +November 26, 2026\n/);
  });

  it("thanks members without a first name", async () => {
    const { text } = await renderReceipt({ firstName: null });

    expect(text).toContain("Thank you for your payment");
  });

  it("shows a reference as text, never as markup", async () => {
    const { html } = await renderReceipt({ reference: "<script>alert(1)</script>" });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
