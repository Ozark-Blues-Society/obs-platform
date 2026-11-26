import type { ReactElement } from "react";

/**
 * A Society email: a React Email component (the file's default export) with its subject line and
 * the sample props that the preview server (`pnpm email:preview`) and the tests render it with.
 */
export interface EmailTemplate<Props> {
  (props: Props): ReactElement;
  subject: (props: Props) => string;
  PreviewProps: Props;
}

/** The member's first name for a greeting, or null when there isn't one. */
export function firstNameOf(firstName: string | null): string | null {
  return firstName?.trim() || null;
}
