# Membership statuses and automatic emails

For the membership manager and administrators. The website keeps each membership's status up to
date and emails members about renewing on its own, every morning. There's nothing to press. This page
explains what members receive and when, so you can answer their questions.

## What each status means

The status is worked out from the date a membership ends. It's updated every morning at about 7 AM
(8 AM in summer).

| Status   | Means                                                                  |
| -------- | ---------------------------------------------------------------------- |
| Active   | The membership ends more than 30 days from now.                        |
| Expiring | It ends within 30 days. Members on yearly auto-renew show this too.    |
| Lapsed   | It has ended. There's no grace period: members-only access stops then. |

Members-only pages, events and files close at the exact moment a membership ends, even though the
status may say "Expiring" until the next morning.

## The emails members get

| When                   | Email                                                       | Who gets it                         |
| ---------------------- | ----------------------------------------------------------- | ----------------------------------- |
| 30 days before it ends | "Time to renew your Ozark Blues Society membership"         | Members not on yearly auto-renew    |
| 7 days before it ends  | "Last reminder: your membership ends on …"                  | Members not on yearly auto-renew    |
| 14 days after it ended | "Your Ozark Blues Society membership has ended" (sent once) | Every member whose membership ended |

Members on yearly auto-renew don't get the two reminders: Stripe, which takes the payments, emails
them before it renews their membership.

Each email has a button to renew on the website. When a member renews, their membership gets a new
end date, and the reminders come again before that one.

## Questions members ask

- **"I renewed, but I got a reminder."** The reminder may have gone out the same morning, before
  they paid. Once their payment is recorded, the new end date stops any more reminders.
- **"I never got a reminder."** Check the date their membership ends, whether they're on yearly
  auto-renew (they get Stripe's emails instead), and their spam folder. Emails come from the
  Society's no-reply address; replies to it aren't read.

The emails come from the website's email service. A technical volunteer can see each one in the
service's dashboard (Resend).
