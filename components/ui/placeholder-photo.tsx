import { useId } from "react";
import { cx } from "@/lib/cx";

export type PlaceholderPhotoTone = "night" | "rust" | "brass" | "green";

// The scene's colors for each tone: the sky from top to bottom, and the spotlights. Each is a text
// color class, read by the SVG through currentColor, so only design tokens are used.
const TONES: Record<PlaceholderPhotoTone, { top: string; bottom: string; light: string }> = {
  night: { top: "text-primary-light", bottom: "text-primary-dark", light: "text-accent-light" },
  rust: { top: "text-danger", bottom: "text-ink", light: "text-accent-light" },
  brass: { top: "text-accent-dark", bottom: "text-ink", light: "text-accent-soft" },
  green: { top: "text-success", bottom: "text-ink", light: "text-success-soft" },
};

// The crowd along the bottom: heads and shoulders.
const CROWD = Array.from({ length: 23 }, (_, i) => ({
  x: i * 18 + (i % 3) * 4 - 4,
  y: 208 + (i % 4) * 3,
}));

type PlaceholderPhotoProps = {
  tone?: PlaceholderPhotoTone;
  /**
   * What the picture stands in for, for screen readers ("Placeholder photo: a band on stage").
   * Leave it out where the picture is only decoration: screen readers then skip it.
   */
  label?: string;
  className?: string;
};

/**
 * A drawn stage scene (the concept's) where a photo goes, until the Society's own photos arrive
 * (docs/spec/board-decisions.md, "Brand and content"). It fills its container and crops to fit.
 */
export function PlaceholderPhoto({ tone = "night", label, className }: PlaceholderPhotoProps) {
  const id = useId();
  const colors = TONES[tone];
  const sky = `${id}-sky`;
  const beam = `${id}-beam`;
  const glow = `${id}-glow`;

  return (
    <svg
      viewBox="0 0 400 225"
      preserveAspectRatio="xMidYMid slice"
      className={cx("block size-full", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" className={colors.top} />
          <stop offset="1" stopColor="currentColor" className={colors.bottom} />
        </linearGradient>
        <linearGradient id={beam} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.6" className={colors.light} />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" className={colors.light} />
        </linearGradient>
        <radialGradient id={glow}>
          <stop offset="0" stopColor="currentColor" stopOpacity="0.95" className={colors.light} />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" className={colors.light} />
        </radialGradient>
      </defs>
      <rect width="400" height="225" fill={`url(#${sky})`} />
      <polygon points="150,0 172,0 250,180 95,180" fill={`url(#${beam})`} />
      <polygon points="300,0 318,0 330,180 228,180" fill={`url(#${beam})`} opacity="0.6" />
      <circle cx="161" cy="4" r="20" fill={`url(#${glow})`} />
      <circle cx="309" cy="4" r="15" fill={`url(#${glow})`} />
      <rect y="178" width="400" height="47" className={cx("fill-current", colors.bottom)} />
      <g className="fill-ink">
        {/* A guitarist at a microphone, and a drummer behind a kit. */}
        <circle cx="168" cy="96" r="10" />
        <path d="M156 108 Q168 103 180 108 L186 150 L178 151 L176 178 L170 178 L168 154 L165 178 L159 178 L158 151 L150 150 Z" />
        <ellipse cx="176" cy="138" rx="15" ry="10" transform="rotate(-25 176 138)" />
        <rect x="182" y="124" width="36" height="3.5" transform="rotate(-28 182 124)" />
        <rect x="137" y="96" width="2.5" height="82" />
        <circle cx="141" cy="95" r="3.5" />
        <circle cx="262" cy="112" r="9" />
        <path d="M252 122 Q262 118 272 122 L276 158 L268 158 L267 178 L257 178 L256 158 L248 158 Z" />
        <rect x="238" y="148" width="48" height="30" rx="3" />
        {CROWD.map(({ x, y }) => (
          <g key={x}>
            <circle cx={x} cy={y} r="8" />
            <ellipse cx={x} cy={y + 18} rx="14" ry="12" />
          </g>
        ))}
      </g>
    </svg>
  );
}
