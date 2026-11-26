# 0005 — Resend sends from the "mail" subdomain

Status: Accepted (Parker, 2026-11-26, Q-20261126-031816-28406, option A).

## Context

Launch 1's sign-in and welcome emails go through Resend. When the Society's Resend account is set up
(Dec 3), someone adds the domain the emails are sent from. That choice sets the DNS record names for the
Dec 8 GoDaddy call, and changing it later means a new Resend domain and new DNS records.

## Decision

Transactional email sends from the subdomain **`mail.<Society domain>`**, from an address like
`noreply@mail.<Society domain>`, with the sender name "Ozark Blues Society". The domain added in Resend is
`mail.<Society domain>`, and the Resend DNS guide (`docs/launch/resend-dns-records.md`) uses record names
under that subdomain.

Newsletters (MailerLite, Launch 2) send from the main domain, so the two keep separate sender reputations.

## Options considered

- A) Subdomain `mail.` (Resend's recommendation). **Chosen.**
- B) Main domain. Rejected: transactional emails and newsletters would share one reputation.
