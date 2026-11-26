# MailerLite DNS records and DMARC (Launch 2)

**For:** a GoDaddy session after launch (Parker, and whoever can sign in to the domain's GoDaddy
account). **Why:** decision [0004](../decisions/0004-email-dns-guide-launch-1.md) kept these records
in Launch 2. **Status:** waiting for the Society's MailerLite account. Values marked **FILL IN**
come from that account.

Newsletters go out through MailerLite, from an address on the Society's main domain (decision
[0005](../decisions/0005-resend-sending-subdomain.md)). According to
[MailerLite's docs](https://www.mailerlite.com/help/how-to-verify-and-authenticate-your-domain)
(checked 2026-11-26), MailerLite sends from the Society's own domain only after its DNS records
exist (except during a new account's 14-day trial). This guide lists those records (step 2) and adds
a DMARC record (step 3), which tells mailbox providers what to do with email that pretends to come
from the Society's domain. Step 7 tightens it once both senders pass. Adding records is a human step
(DNS is a gate in [`HUMAN_GATES.md`](../HUMAN_GATES.md)). Agents only keep this guide up to date.

The Resend records ([`resend-dns-records.md`](resend-dns-records.md), added on the Dec 8 call)
should already be in place. This guide doesn't change them.

In the examples, `example.org` stands for the Society's domain and `news@example.org` for the
newsletter's sender address.

## 1. In MailerLite: add the sending domain

Whoever sets up the Society's MailerLite account:

- **Sending domain:** under **Account settings** → **Domains** → **Sending domains**, click
  **+ Add sending domain** and enter the sender address: FILL IN, an address at the main domain,
  such as `news@example.org`. Not an address at `mail.example.org`: that subdomain is Resend's
  (decision 0005). MailerLite advises against no-reply addresses.
- **Setup:** MailerLite offers to add the records in GoDaddy for you. That's fine, but compare the
  result with step 2 afterwards. MailerLite says this doesn't work if you sign in to GoDaddy with
  Google or another social login. In that case, or if you prefer, choose **Authenticate manually**,
  pick GoDaddy, and copy the values into step 2.
- **Domain alignment** (a card on the domain's page): skip it for now. MailerLite recommends it but
  doesn't require it, and DMARC passes without it (step 3). It adds three more records on a new
  subdomain, and turning it off later breaks the links in every newsletter sent while it was on. It
  can be added later if newsletters have trouble reaching inboxes.
- **Reply-to address:** nothing on the domain receives email (board decisions), so replies to the
  sender address reach no one. Under **Account settings** → **Default settings**, tick
  **Use a custom reply-to address** and enter an address someone reads: FILL IN, such as the
  Society's shared email once it exists.

DNS values aren't secret, since anyone can look them up. MailerLite's API key (for the site's group
sync, backlog E-3) is a secret and never goes in this guide or the repo.

## 2. MailerLite's records

MailerLite's
[GoDaddy guide](https://www.mailerlite.com/help/how-to-authenticate-a-domain-with-godaddy) (checked
2026-11-26) lists three records. The names are written the way GoDaddy's **Name** field takes them:
`@` means the main domain itself. M1 comes from that guide. If MailerLite's page shows a different
name or value, use MailerLite's.

| #   | Type  | Name                 | Value                                                                         | What it's for                                         |
| --- | ----- | -------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| M1  | CNAME | `litesrv._domainkey` | `litesrv._domainkey.mlsend.com`                                               | DKIM: lets receivers check who signed the email       |
| M2  | TXT   | `@`                  | FILL IN (starts `v=spf1`, such as `v=spf1 a mx include:_spf.mlsend.com ~all`) | SPF: lists MailerLite's sending servers               |
| M3  | TXT   | `@`                  | FILL IN                                                                       | Shows MailerLite that the Society controls the domain |

**Only one SPF record.** A name can have only one TXT record that starts with `v=spf1`. With two,
SPF stops working for that name. If step 4 finds one at `@` already, don't add M2 as a second
record: ask before the session. MailerLite's
[merge guide](https://www.mailerlite.com/help/how-to-merge-spf-records) shows how to combine the
two, and MailerLite offers a merged value after **Check DNS records**. Resend's SPF record is at
`send.mail`, a different name, so it doesn't count.

## 3. The DMARC record

| #   | Type | Name     | Value              | What it's for                                                      |
| --- | ---- | -------- | ------------------ | ------------------------------------------------------------------ |
| D1  | TXT  | `_dmarc` | `v=DMARC1; p=none` | DMARC: tells receivers what to do with email that fails the checks |

DMARC applies to email whose From address is at `example.org`, or at a subdomain that has no
`_dmarc` record of its own, so this one record covers both senders. It starts at `p=none`, which
filters nothing. Step 7 tightens it.

An email passes DMARC when DKIM or SPF passes for a domain that matches its From address. Under the
default (relaxed) rules, `send.mail.example.org` matches `mail.example.org`, because both belong to
`example.org` ([RFC 7489](https://www.rfc-editor.org/rfc/rfc7489)). Both senders pass through DKIM:

| Sender                                         | From address               | DKIM signs as                             | SPF checks                                     | Passes DMARC through |
| ---------------------------------------------- | -------------------------- | ----------------------------------------- | ---------------------------------------------- | -------------------- |
| Resend: sign-in, welcome and other site emails | `noreply@mail.example.org` | `mail.example.org` (Resend's DKIM record) | `send.mail.example.org` (Resend's return path) | DKIM and SPF         |
| MailerLite: newsletters                        | `news@example.org`         | `example.org` (M1)                        | a MailerLite domain                            | DKIM                 |

Add the value exactly as shown:

- No `sp=` part, so subdomains follow `p=`.
- No `adkim=s` or `aspf=s`. The default (relaxed) is what lets Resend's SPF match.
- No `rua=` part, so no reports (see below).
- No second record. If `_dmarc` already has one, ask before the session: with two DMARC records at
  one name, receivers ignore both (RFC 7489, section 6.6.3).
- No `_dmarc.mail` record, which would replace this policy for Resend's emails. If one exists
  (Resend's domain page may suggest one), delete it in step 5.

**Reports (optional).** Adding `; rua=mailto:` and an address to the value asks mailbox providers to
email daily reports (XML files) on who sends as the domain and whether it passed. D1 leaves them
out:

- Nothing at `example.org` receives email. Making it receive (a mailbox or forwarding) is an account
  decision for Parker (HUMAN_GATES).
- Providers send reports to an address at another domain only if that domain publishes a record
  allowing it (RFC 7489, section 7.1). gmail.com doesn't (checked 2026-11-26), so a Gmail address
  may get no reports. DMARC report services publish that record, but signing up for one is also an
  account decision.
- The domain has two senders, and step 6 checks both directly, so reports would add little for now.

If Parker wants reports later, add `; rua=mailto:` followed by the address to the end of D1's value.
Resend's free [checkdmarc.email](https://checkdmarc.email) turns a report's XML into a readable
summary.

## 4. Before the session

To see what's already on the domain, enter `example.org` at <https://dns.email>, or run:

```
nslookup -type=TXT example.org
nslookup -type=TXT _dmarc.example.org
nslookup -type=TXT _dmarc.mail.example.org
```

The first lists the main domain's TXT records. None should start with `v=spf1`. The other two should
find nothing.

- [ ] Step 1 is done, and step 2's FILL IN values are copied from MailerLite.
- [ ] Someone in the session can sign in to the GoDaddy account that holds the domain, and someone
      can sign in to MailerLite.
- [ ] Resend shows `mail.example.org` as **Verified**
      ([`resend-dns-records.md`](resend-dns-records.md) step 5).
- [ ] The lookups above found no SPF or DMARC record. If they found one, see step 2 (SPF) or step 3
      (DMARC).

## 5. In GoDaddy: add the records

Allow about 10 minutes. Add M1, M2, M3 and D1 as in
[step 4 of the Resend guide](resend-dns-records.md#4-on-the-call-add-the-records-in-godaddy):
**Add New Record**, then Type, Name, Value, TTL (Custom, 600 seconds) and **Save**. For these
records:

- **Name:** `@` for M2 and M3. GoDaddy uses `@` for the main domain itself.
- **M1:** if GoDaddy shows the value with `example.org` added on the end, edit it and put a full
  stop at its end: `litesrv._domainkey.mlsend.com.`.
- **D1:** type the value exactly: `v=DMARC1; p=none`.
- Don't change or delete any other record, Resend's included (`resend._domainkey.mail`, `send.mail`,
  `rsend.mail`). The one exception is a `_dmarc.mail` record (step 3).

## 6. Verify

1. In MailerLite, open **Account settings** → **Domains**, click **…** next to the domain, and
   choose **Check DNS records**. **Authenticated** means done. MailerLite says it can take up to 24
   hours, and the status reads **Authentication in process** meanwhile.
2. To check the records yourself, enter `example.org` at <https://dns.email>, or run:

   ```
   nslookup -type=CNAME litesrv._domainkey.example.org
   nslookup -type=TXT example.org
   nslookup -type=TXT _dmarc.example.org
   ```

   The first should return `litesrv._domainkey.mlsend.com.`, the second M2 and M3 (and only one
   value that starts with `v=spf1`), the third `v=DMARC1; p=none`. As in the Resend guide, nslookup
   puts quote marks around TXT values and a full stop at the end of a CNAME value.

3. Check both senders. In a draft MailerLite campaign, choose **Preview and test** →
   **Send a test email** and send it to your own address (look in spam too: MailerLite says the
   `[TEST]` label can put it there). Then request a sign-in link from the site to the same address,
   as in step 7 of the Resend guide. In Gmail, open each email, choose **⋮** → **Show original**,
   and check:
   - The newsletter: `DKIM: 'PASS' with domain example.org` and `DMARC: 'PASS'`. SPF may name a
     MailerLite domain, which is expected.
   - The sign-in email: SPF, DKIM (`mail.example.org`) and DMARC all say `PASS`.

## 7. Tighten the policy (DMARC tuning)

At `p=none`, email that pretends to come from the Society still reaches inboxes. Tighten D1 in
stages:

1. **Stay at `p=none`** until at least one real newsletter has gone out, and the step 6.3 checks
   pass on real emails: that newsletter and a site email such as a sign-in link or a receipt.
2. **Check that nothing else sends as the domain.** Today only Resend and MailerLite do (the board
   said no email is used on the domain). Anything else that sends from an `@example.org` address,
   such as a mailbox on the domain or another tool, needs its own SPF and DKIM records first, or its
   email lands in spam after the next stage. The same applies to any sender added later.
3. **Set D1 to `v=DMARC1; p=quarantine`.** Email that fails DMARC then goes to spam. Then run the
   step 6.3 checks again.
4. **`p=reject` is optional.** Failing email then bounces instead of going to spam, so email from a
   forgotten sender is lost rather than misfiled. This guide stops at `p=quarantine`; going further
   is Parker's call.

**Undo:** if real newsletters or site emails land in spam after a change, set D1 back to
`v=DMARC1; p=none`. With a 600-second TTL, receivers see the change within about 10 minutes. Then
use step 6.3 to find the sender that fails.

## 8. If MailerLite doesn't verify

According to MailerLite's
[troubleshooting page](https://www.mailerlite.com/help/troubleshooting-domain-authentication)
(checked 2026-11-26), most failures are one of these:

- M1: the name isn't `litesrv._domainkey` (GoDaddy adds the domain itself), or the value has
  `example.org` added on the end (step 5).
- M2: the value doesn't match MailerLite's exactly, capitals included, or there are two SPF records
  (step 2).
- M3: part of the value is missing. Compare its length with MailerLite's.
- The records haven't spread yet. That usually takes up to 24 hours, sometimes 72.

A "Failed authentication" email that arrives while the **Domains** page shows **Authenticated** was
sent before the records spread, and MailerLite says to ignore it. After a fix, choose
**Check DNS records** again.

**Undo:** delete M1, M2, M3 and D1. Nothing else uses them, but until they're back, MailerLite can't
send newsletters from the domain.

## 9. After it verifies

Tell the Foreman, so this guide's status can be updated and the step 7 check can be planned for
after the first newsletter.
