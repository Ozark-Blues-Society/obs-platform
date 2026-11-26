"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// The Server Function arrives as a prop (from page.tsx), so the form can be tested on its own.
type ConfirmAction = (formData: FormData) => Promise<void>;

type FinishSignInFormProps = {
  action: ConfirmAction;
  /** The one-time token hash from the emailed link. */
  tokenHash: string;
  /** Where to go after signing in, already checked with safeNextPath. */
  next: string;
};

export function FinishSignInForm({ action, tokenHash, next }: FinishSignInFormProps) {
  return (
    <form action={action} className="mt-8">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="next" value={next} />
      <p className="text-lg">
        You&rsquo;re almost there. Use the button to finish signing in to your Ozark Blues Society
        account.
      </p>
      <SubmitButton />
      <p className="mt-6 text-sm text-muted">
        Why the extra step? Some email services open the links in incoming email to check them for
        safety. A sign-in link works only once, so waiting for your click means those checks
        can&rsquo;t use it up.
      </p>
    </form>
  );
}

function SubmitButton() {
  // Disabled while signing in: a second press would find the link already used.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="dark" disabled={pending} className="mt-4 w-full">
      {pending ? "Signing in…" : "Finish signing in"}
    </Button>
  );
}
