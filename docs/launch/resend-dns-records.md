# Resend DNS records (Launch 1)

**For:** the Dec 8 GoDaddy call (Parker and Diane). **Why:** decision
[0004](../decisions/0004-email-dns-guide-launch-1.md). **Status:** waiting for the Society's Resend
account (due Dec 3). Values marked **FILL IN** come from that account.

The site sends sign-in and welcome emails through Resend. Resend can send from the Society's domain
only after two or three DNS records exist. This guide lists those records and shows how to add them
in GoDaddy. Adding them is a human step (DNS is a gate in [`HUMAN_GATES.md`](../HUMAN_GATES.md)).
Agents only keep this guide up to date.

Not part of this call: MailerLite records and DMARC (Launch 2, backlog E-5). If Resend's page
suggests a DMARC record (`_dmarc`), skip it.

In the examples, `example.org` stands for the Society's domain.

## 1. Dec 3: add the domain in Resend

Whoever sets up the Society's Resend account adds the domain under **Domains** → **Add domain**.
The domain, region and return path can't be changed afterwards. Changing one later means adding the
domain to Resend again, with new DNS records.

- **Domain:** `mail.example.org`, the Society's domain with `mail.` in front, not the main domain
  (decision [0005](../decisions/0005-resend-sending-subdomain.md)).
- **Region:** North Virginia (`us-east-1`), the default. It's Resend's US region, and the Society's
  members are in the US.
- **Custom return path** (under **Advanced options**): leave the default, `send`. The record names
  below assume it.
- **Receiving** (on the domain's page): leave it off. The Society doesn't receive email through
  Resend.
- **Open and click tracking** (the domain's **Configuration** tab): leave it off, the default.
  Resend recommends it off for emails like sign-in links, and turning it on adds a tracking record
  that this guide doesn't cover.

Next, copy the records from the domain's page in Resend into step 2, and delete the set, and any
row, that Resend didn't show. Parker can fill it in, or an agent can work from a screenshot of that
page. DNS values aren't secret, since anyone can look them up. The Resend API key is a secret and
never goes in this guide or the repo.

## 2. The records

Resend shows one of two sets of records. According to
[Resend's docs](https://resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying) (checked
2026-11-26), a domain added after August 2026 may show set A, and older domains show set B. Copy
each value exactly as Resend shows it, and check that the names match.

The names are for `mail.example.org` (step 1), written the way GoDaddy's **Name** field takes them:
without `.example.org` on the end (step 4). A name Resend shows with `.example.org` on the end still
matches.

Set A has one or two CNAME records. If Resend shows only one, delete the CNAME row it doesn't show.
If Resend's records match neither set, copy its rows exactly as shown and ask before the call.

**Set A: CNAME records**

| #   | Type  | Name                     | Value                 | What it's for                                   |
| --- | ----- | ------------------------ | --------------------- | ----------------------------------------------- |
| A1  | TXT   | `resend._domainkey.mail` | FILL IN (starts `p=`) | DKIM: lets receivers check who signed the email |
| A2  | CNAME | `send.mail`              | FILL IN               | Return path and SPF: bounces go back to Resend  |
| A3  | CNAME | `rsend.mail`             | FILL IN               | The same, for Resend's second sending server    |

**Set B: MX and TXT records**

| #   | Type | Name                     | Value                                                              | Priority | What it's for                                       |
| --- | ---- | ------------------------ | ------------------------------------------------------------------ | -------- | --------------------------------------------------- |
| B1  | TXT  | `resend._domainkey.mail` | FILL IN (starts `p=`)                                              |          | DKIM: lets receivers check who signed the email     |
| B2  | MX   | `send.mail`              | FILL IN (for `us-east-1`: `feedback-smtp.us-east-1.amazonses.com`) | 10       | Return path: bounces go back to Resend              |
| B3  | TXT  | `send.mail`              | `v=spf1 include:amazonses.com ~all`                                |          | SPF: lets Resend's servers send for the return path |

None of these records touches the website, the nameservers or any record already on the domain.

## 3. Before the call

- [ ] Step 2 is filled in, and only the rows Resend shows are left.
- [ ] Someone on the call can sign in to the GoDaddy account that holds the domain, and Parker can
      sign in to Resend.
- [ ] The domain's DNS is hosted at GoDaddy. `nslookup -type=NS example.org` (or
      <https://dns.email>) should list `nsNN.domaincontrol.com` servers. If it lists another
      provider, add the records there instead.

## 4. On the call: add the records in GoDaddy

Allow about 15 minutes to add the records, plus time to verify (step 5). Resend's own
[GoDaddy guide](https://resend.com/docs/guides/dns/godaddy) covers the same steps.

1. Sign in at <https://sso.godaddy.com> with the account that holds the domain.
2. Open the domain's DNS records. The page lists records and has an **Add New Record** button.
   GoDaddy moves its menus around; try **Domain Portfolio** → the domain → **DNS**.
3. Look for records that already use the names in step 2. There shouldn't be any, because nothing
   on the domain uses email today. If there are, stop and ask before changing them. A CNAME can't
   share its name with any other record.
4. Add each row of step 2. Click **Add New Record**, then fill in:
   - **Type**: as in the table.
   - **Name**: as in the table. GoDaddy adds the domain itself, so type `send.mail`, not
     `send.mail.example.org`.
   - **Value**: paste the whole value, with no quote marks or spaces around it.
   - **Priority** (MX only): `10`.
   - **TTL**: Custom, 600 seconds, so a corrected typo takes effect within 10 minutes. The default
     (1 hour) also works.
   - **Save**.
5. Compare each saved record with the table. If GoDaddy shows a CNAME or MX value with
   `example.org` added on the end, edit the value and put a full stop at its end, for example
   `feedback-smtp.us-east-1.amazonses.com.`.
6. Don't change or delete any other record. The website's records, the nameservers and any existing
   MX or TXT records stay as they are.

Resend may offer **Auto Configure** for GoDaddy. It adds the records for you after you sign in to
GoDaddy and approve. Using it is fine, but compare the result with step 2 afterwards.

## 5. Verify

1. In Resend, open **Domains** → the domain and click **Verify DNS Records**. Verification often
   finishes within 15 minutes, but DNS changes can take up to 72 hours to spread. Resend marks any
   record it can't match.
2. To check a record yourself, enter `mail.example.org` at <https://dns.email>, or run these
   commands in a terminal. For set A, check only the CNAME rows left in step 2.

   ```
   nslookup -type=TXT resend._domainkey.mail.example.org
   nslookup -type=CNAME send.mail.example.org    # set A
   nslookup -type=CNAME rsend.mail.example.org   # set A
   nslookup -type=MX send.mail.example.org       # set B
   nslookup -type=TXT send.mail.example.org      # set B
   ```

   Each one should return the value in step 2. nslookup puts quote marks around a TXT value and a
   full stop at the end of a CNAME or MX value. That's normal: don't change the record for it.

3. **Verified** means done. **Partially verified** (set A with two CNAME records) means one of them
   hasn't verified yet. Resend can still send, but without a fallback sending server, so check that
   record.

## 6. If it doesn't verify

According to Resend's troubleshooting page (linked in step 2) and its GoDaddy guide (linked in
step 4), most failures are one of these:

- The name has the domain in it twice (`send.mail.example.org.example.org`), because the full name
  was typed into GoDaddy's Name field. Rename it to `send.mail`.
- A CNAME or MX value has the domain added on the end, such as
  `feedback-smtp.us-east-1.amazonses.com.example.org`. Put a full stop at the end of the value
  (step 4.5).
- The value doesn't match exactly: it has quote marks or a space, part of a long DKIM key is
  missing, or SPF text was pasted into the DKIM record.
- The records went to a DNS host that doesn't serve the domain (see the nameserver check in step 3).
- Set B only: the MX value names a different region from the one on the domain's page in Resend.

After a fix, click **Restart verification** in Resend. If it still fails, ask
<https://resend.com/help> and include the domain name and a screenshot of the GoDaddy records.

**Undo:** delete the records this guide added. Nothing else on the domain uses them. Until they're
back, Resend can't send from the domain.

## 7. After it verifies

- Tell the Foreman so this guide's status can be updated. The production sender address for
  Supabase Auth and the app is set during launch prep (backlog Q-5, the launch runbook). Production
  environment variables are a human gate.
- At the Dec 9 launch rehearsal, request a sign-in link to your own address. In Gmail, open the
  email, choose **⋮** → **Show original**, and check that SPF and DKIM both say `PASS`.
