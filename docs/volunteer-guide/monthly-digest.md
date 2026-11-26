# Monthly email digest

For the newsletter writer, who needs the **Editor** or **Administrator** role (see
[Roles](roles.md)). Each month the website gathers the blog posts marked **Include in the monthly
email digest** into a newsletter in the Society's colors. You copy it from the website and paste it
into MailerLite, which sends it to the Society's mailing list.

## Before the first digest

- Put the Society's mailing address in the Content Studio, under **Site settings** → **Footer**
  (see [Site settings](site-settings.md)). The newsletter's footer shows it: MailerLite asks for the
  sender's postal address in every newsletter. Until it's there, the footer has a placeholder in
  its place, and the website warns you.
- You need a sign-in to the Society's MailerLite account. Every MailerLite plan, the free one
  included, has the custom HTML editor these steps use.

## Which posts go in

Turn on **Include in the monthly email digest** when you write a post (see
[Blog posts](blog-posts.md)). A post goes in the digest for the month of its publish date, once
that date has come, so a scheduled post joins when it's published.

- A post everyone can read goes in with its headline, category, date, short summary and a link to
  read it on the website.
- A members-only post goes in with its headline, category and date, marked "Members only", and a
  link to sign in and read it. Its summary stays on the website: the newsletter also reaches
  people who aren't members.

Posts come newest first. Unpublished changes (drafts) never go in.

## Making the month's newsletter

1. Open the website's admin screens and choose **Monthly digest** in the menu, or add
   `/admin/digest` to the website's address. Sign in if the website asks.
2. Under **Month**, choose the month and select **Show**. The page lists the posts in that month's
   digest, then shows the newsletter.
3. Read the newsletter's preview. Links in it open in a new tab.
4. Select **Copy the newsletter**. The page says "Copied." If your browser won't copy, open **Show
   the HTML**, select everything in the box and copy it.

The page also suggests a subject, such as "November 2026 at the Ozark Blues Society".

## Sending it from MailerLite

1. In MailerLite, open **Campaigns** and select **Create**. Choose **Regular campaign**, then
   **Start from scratch**, then **Custom HTML editor**, then **Code from scratch**.
2. Paste the newsletter into the code editor. The preview next to it shows the newsletter.
3. To change the opening sentence ("Here's what's new on the Society's blog."), find it in the code
   and type your own words in its place. Change only the words, not the code around them.
4. Select **Done editing**. On the next page, give the campaign a name, the subject and the sender,
   and leave **Preheader** empty: the newsletter brings its own, the line inboxes show after the
   subject. Then choose who gets it under **Select recipients**.
5. Send a test to yourself first (**Send a test**), check it, then choose **Send now** or **Send
   later**.

The newsletter's footer has MailerLite's own **Unsubscribe** and **View this email in your browser**
links. MailerLite fills them in for each subscriber, so they work only in the emails it sends, not
in the preview on the website.
