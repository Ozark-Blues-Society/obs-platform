# Member groups in MailerLite

For the newsletter writer, the membership manager and administrators. The website keeps seven
groups in the Society's MailerLite account up to date with its members, so you can send a campaign
to just the members who need it. There's nothing to press: the website updates the groups itself.

## The groups

Their names start with "Website:", so they sit together in MailerLite's list of groups.

| Group                       | Who's in it                                              |
| --------------------------- | -------------------------------------------------------- |
| Website: Active members     | Members whose membership ends more than 30 days from now |
| Website: Expiring members   | Members whose membership ends within 30 days             |
| Website: Lapsed members     | Members whose membership has ended                       |
| Website: Individual members | Individual members whose membership hasn't ended         |
| Website: Band members       | Band members whose membership hasn't ended               |
| Website: Business members   | Business members whose membership hasn't ended           |
| Website: Sponsor members    | Sponsor members whose membership hasn't ended            |

Every member is in one of the first three groups, the one for their status (see
[Membership statuses and automatic emails](membership-emails.md)). Until their membership ends,
they're also in their level's group. When it ends, they move to **Website: Lapsed members** and
leave their level's group. Someone who signed up on the website but has never paid isn't in any.

Members on yearly auto-renew are in **Website: Expiring members** in their last 30 days too, like
on the website. Their card is charged on its own, so a "please renew" campaign isn't for them.

The groups follow the statuses every morning at about 7 AM (8 AM in summer). A change to a
membership, such as a payment, shows in the groups by the next morning at the latest.

## Sending to members

In MailerLite, when you get to **Select recipients** for a campaign, choose the groups. For
example:

- Everyone whose membership is current: **Website: Active members** and **Website: Expiring
  members**. The monthly newsletter goes to these two and the mailing list (see
  [Monthly email digest](monthly-digest.md)).
- A reminder to renew: **Website: Expiring members**, or **Website: Lapsed members** to invite back
  those whose membership has ended.
- News for sponsors: **Website: Sponsor members**.

Adding someone to a group sends them nothing. Only a campaign or an automation sends emails.

## Leave these groups to the website

- **Don't add or remove people in them by hand.** The website wouldn't know, and the group would
  stay wrong for that person.
- **Don't rename or delete them.** The website finds them by name. If one is missing, it makes a
  new one with the same name the next morning and puts the members back in it. A renamed group
  stops being updated.
- **Unsubscribe, don't delete.** To stop emails to someone, unsubscribe them in MailerLite.
  Unsubscribed people stay in the groups, but campaigns skip them, and the website never subscribes
  them again. Someone deleted from MailerLite comes back the next time their membership changes.

## What the website sends MailerLite

- Each member's email address, first name and last name, and which of these groups they're in.
  When a member changes their address or name on the website, it changes in MailerLite too.
- Members already in MailerLite, from the mailing list for example, keep their status and their
  other groups. Someone who unsubscribed stays unsubscribed.
- If the account asks new subscribers to confirm their address (double opt-in), new members get
  MailerLite's confirmation email first, as they would from MailerLite's own sign-up forms.
- Someone who stops being a member, say after a refund, leaves the website's groups and stays in
  MailerLite with their other groups.

The website starts doing this once a technical volunteer connects it to the Society's MailerLite
account (see "MailerLite member groups" in the README). The groups appear the morning after.
