import { NewsletterSignup } from "@/components/blog/newsletter-signup";
import { serverEnv } from "@/lib/env/server";
import { signUpForNewsletter } from "@/lib/newsletter/signup-actions";

/**
 * The newsletter signup box (decision 0015), while MailerLite is connected (MAILERLITE_API_KEY);
 * nothing until then. Render it where the page already renders at request time, so the key is read
 * then, never when the site is built.
 */
export function NewsletterBox() {
  if (!serverEnv("MAILERLITE_API_KEY").MAILERLITE_API_KEY) return null;
  return <NewsletterSignup action={signUpForNewsletter} />;
}
