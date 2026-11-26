import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { LOGO_PLACEMENTS, OptionValue } from "@/sanity/schemas/options";

type LogoPlacement = OptionValue<typeof LOGO_PLACEMENTS>;

type SponsorLogoProps = {
  name: string;
  /** The sponsor's website. */
  href?: string;
  /**
   * The logo image, with the sponsor's name as its alt text, at most 40px high (56px for a large
   * placement). The name shows in its place until there is one.
   */
  logo?: ReactNode;
  /** The sponsor tier's logo placement: a large logo, a logo, or the name only. */
  placement?: LogoPlacement;
  className?: string;
};

const PLACEMENTS: Record<LogoPlacement, string> = {
  large: "px-10 py-6.5 text-2xl",
  logo: "px-5.5 py-3.5 text-lg",
  name: "px-4 py-2.5 text-[0.9375rem]",
};

/** A sponsor's logo, or its name in a dashed box until the logo arrives. */
export function SponsorLogo({ name, href, logo, placement = "logo", className }: SponsorLogoProps) {
  const showLogo = Boolean(logo) && placement !== "name";
  const classes = cx(
    "inline-flex items-center justify-center rounded-lg border bg-white font-serif text-muted no-underline",
    showLogo ? "border-transparent" : "border-dashed border-line",
    href && "hover:border-line-strong",
    PLACEMENTS[placement],
    className,
  );
  const content = showLogo ? logo : name;

  return href ? (
    <a href={href} className={classes}>
      {content}
    </a>
  ) : (
    <span className={classes}>{content}</span>
  );
}
