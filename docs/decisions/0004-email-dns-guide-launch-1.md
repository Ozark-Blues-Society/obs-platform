# 0004 — Resend DNS records guide moves to Launch 1

Status: Accepted (Parker, 2026-11-26, Q-20261126-022017-25661, option A). In scope, docs only.

## Context

Launch 1 sends sign-in and welcome emails (decision 0002) through Resend. Resend can't send from the
Society's domain until its DNS records exist. E-5 (email authentication guide) was labeled Launch 2.
The only DNS session before launch is Dec 8 (GoDaddy call with Diane). The Society's Resend account,
which provides the exact DKIM values, is due Dec 3.

## Decision

Split E-5:

- **Launch 1:** a short, step-by-step guide to the DNS records Resend needs for the Society's domain
  (SPF, DKIM, and the return-path/MX record Resend asks for), written so the records can be added on the
  Dec 8 call. Put placeholders where values come from the Resend account, and fill them in once it
  exists (Dec 3).
- **Launch 2 (unchanged):** MailerLite records and DMARC tuning.

Applying the records in DNS stays a human gate (Parker/Diane). Agents write the guide only.

## Options considered

- A) Move only the Resend part to Launch 1. **Chosen.**
- B) Move all of E-5 to Launch 1.
- C) Keep E-5 in Launch 2. Rejected: sign-in emails might not arrive from the Society's domain on
  launch day.
