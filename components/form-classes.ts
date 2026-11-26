// Tailwind classes shared by the sign-in and password forms, until the form field components of
// backlog D-3 replace them.

export const labelClass = "block text-sm font-semibold text-ink";

export const inputClass =
  "mt-1 block w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-base text-ink " +
  "focus:border-ink focus:ring-2 focus:ring-focus focus:outline-none " +
  "aria-[invalid=true]:border-danger";

export const buttonClass =
  "mt-4 inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 " +
  "font-semibold text-white hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-focus disabled:cursor-wait disabled:opacity-70";

export const errorClass = "mt-2 text-sm font-medium text-danger";

/** A success message box, such as "Check your email." */
export const successBoxClass =
  "rounded-lg border border-success bg-success-soft p-4 text-sm text-ink";
