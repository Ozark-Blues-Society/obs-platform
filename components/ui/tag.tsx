import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export type TagTone = "primary" | "accent" | "success" | "danger" | "muted";

const TONES: Record<TagTone, string> = {
  /** Categories ("Concert", "Recap"). */
  primary: "bg-primary-soft text-primary",
  /** "Members only", "Pending", "Expiring soon". */
  accent: "bg-accent-soft text-accent-dark",
  /** "Active", "Published", "Live". */
  success: "bg-success-soft text-success",
  /** "Lapsed", "Rejected". */
  danger: "bg-danger-soft text-danger",
  /** "Weekly", "Expired". */
  muted: "bg-muted-soft text-muted",
};

type TagProps = HTMLAttributes<HTMLSpanElement> & { tone?: TagTone };

/** A small uppercase label for a category or a status. */
export function Tag({ tone = "primary", className, ...props }: TagProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-sm px-2 py-[3px] text-tag uppercase",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
