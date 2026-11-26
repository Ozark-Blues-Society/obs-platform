import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "dark" | "ghost" | "approve" | "reject";
export type ButtonSize = "md" | "sm";

type ButtonStyle = { variant?: ButtonVariant; size?: ButtonSize };

// Every variant has a 1.5px border, so all are the same size. A transparent border still shows in
// forced-colors mode (Windows High Contrast), where background colors don't.
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] font-semibold " +
  "no-underline transition disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<ButtonVariant, string> = {
  /** Brass: the main call to action. On a brass background, use `dark`. */
  primary: "border-transparent bg-accent text-primary-dark hover:brightness-105",
  /** Navy: other actions. */
  dark: "border-transparent bg-primary text-white hover:bg-primary-light",
  /** An outline in the text color around it, so it works on light and dark backgrounds. */
  ghost: "border-current bg-transparent text-inherit hover:bg-current/10",
  /** Moderation and admin: approve. */
  approve: "border-transparent bg-success text-white hover:brightness-110",
  /** Moderation and admin: reject or remove. */
  reject: "border-current bg-transparent text-danger hover:bg-danger-soft",
};

const SIZES: Record<ButtonSize, string> = {
  md: "px-5 py-2.5 text-body",
  sm: "px-3.5 py-1.5 text-small",
};

/** The button classes, for an element that isn't a `<button>` or a link. */
export function buttonClasses({ variant = "primary", size = "md" }: ButtonStyle = {}): string {
  return cx(BASE, VARIANTS[variant], SIZES[size]);
}

type ButtonProps = ButtonStyle & ComponentProps<"button">;

/** A button. It's `type="button"` unless you say otherwise, so it never submits a form by accident. */
export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={cx(buttonClasses({ variant, size }), className)} {...props} />
  );
}

type ButtonLinkProps = ButtonStyle & ComponentProps<typeof Link>;

/** A link that looks like a button, for going somewhere ("Join", "Full calendar"). */
export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={cx(buttonClasses({ variant, size }), className)} {...props} />;
}
