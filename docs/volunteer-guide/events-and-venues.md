# Events and venues

Add an event once and it shows on the calendar, on its own event page and on the home page.

## Adding an event

Open **Events** and select **+** (Create).

- **Title**: the event's name as the calendar shows it.
- **Web address**: press **Generate**. The event page lives at `/events/<web address>`.
- **Date and start time**: always in Central Time, whatever time zone your computer is in.
- **Repeats**: choose **Every week** or **Every month** for a regular event such as a jam, then
  set its **Last date**. Weekly events repeat on the same weekday. Monthly events keep the first
  date's weekday and its place in the month: if the first date is the first Friday, it repeats on
  every first Friday. A first date on the 29th, 30th or 31st repeats on the last such weekday of
  each month (the last Friday, say), since most months have no fifth one. The calendar shows every
  date up to and including the last date, which has to be after the first date.
- **Venue**: pick the venue from the list. If it isn't there yet, create it right there and fill
  in its name, address and map link. Leave the venue empty for a private gathering whose address
  goes out by email.
- **Category**: Concert, Jam, Workshop or Society. Visitors can filter the calendar by category.
- **Price**: what visitors pay, as you'd say it: `$15`, `Free`, or `$10 at the door`.
- **Members' price**: optional, for example `$10`. Signed-in members see it highlighted.
- **Who can see this event?**: see [Who can see it](content-studio.md#who-can-see-it). Visitors
  who can't see a members-only event still see its title and date, but not the place or details.
- **Photo** and **Description**: optional, but they make the event page much better.

## The calendar

The **Events** page (`/events`) shows a month at a time, as a grid or as a list, with arrows to the
months before and after. Visitors can filter it by category; the address keeps their choices, so a
link to "jams in March" works. Repeating events appear on every date, up to their last date.
**Coming up** beside it lists each event once, at its next date.

Everyone can subscribe to the calendar in Google Calendar, Apple Calendar or Outlook, with the
links under Coming up: new and changed events then show up in their own calendar app by
themselves, usually within a few hours. The subscription has every event from the last 30 days and
the next two years. Members-only events are in it with their title, date and prices only, never
the venue or the description, even for members.

## The event page

Every event has its own page at `/events/<web address>`. It shows the date and time, the venue
with its address and map link, the prices and the description. A member who is signed in sees
their price highlighted. A repeating event's page says how it repeats and lists its next dates.

**Add to calendar** gives a calendar file that Google Calendar, Apple Calendar and Outlook open. A
repeating event goes in with all its dates, up to the last date. Events have a start time but no
end time, so calendars show each one as two hours long.

Visitors who can't see a members-only event still see its title, date, time and prices, with
"Location visible to members" and a sign-in prompt in place of the venue and the description.
They can't add it to a calendar.

## Venues

A venue holds a name, an address and a map link, typed once and reused by every event there.
Open **Venues** to fix a typo or add a map link; every event at that venue picks up the change.

Everything on a venue is public, so never put booking contacts there. They go in the venue's
directory entry, which only members see.

## The venue directory

The venue directory is a members-only list of venues that book blues, with who to contact. Each
row is a **Directory entry**:

- **Venue**: pick the venue, or create it there. The row shows the venue's name, and the rows are
  in order of venue name. An entry with no venue picked doesn't show.
- **Capacity**, **How it pays** and **Notes**: details every member sees while their membership
  is active.
- **Booking contact** (name, email and phone): only **Band, Business and Sponsor** members see
  these. Individual members and visitors never do.

To show the directory on the website, add a **Table** block to a page (usually one built from the
Directory template) and set **What the table shows** to **The venue directory**. The rows fill
themselves from the directory entries, with a search box above them. Who sees what, even if the
page itself is open to everyone:

| Who                                              | What they see                                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Band, Business and Sponsor members               | Every row: venue, booking contact, capacity, how it pays and notes                                        |
| Individual members                               | Every row without the booking contact column, and a note that contacts are for Band, Business and Sponsor |
| Visitors, and members whose membership has ended | The block's heading and a lock asking them to sign in or join, or to renew                                |

The website leaves out what someone may not see before it sends the page, so it can't be found in
the page's code either. A preview link doesn't change this: it shows the directory only to
members, as above.
