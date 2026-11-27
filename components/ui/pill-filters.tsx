"use client";

import { cx } from "@/lib/cx";
import { pillClasses } from "./pill-classes";

export type PillOption<Value extends string> = { value: Value; label: string };

type PillFiltersProps<Value extends string> = {
  /** Names the group for screen readers, for example "Event category". */
  label: string;
  options: readonly PillOption<Value>[];
  /** The selected option. One is always selected: include an "All" option to show everything. */
  value: Value;
  onChange: (value: Value) => void;
  className?: string;
};

/**
 * A row of pill buttons that picks one filter, such as an event category. Each pill is a toggle
 * button: screen readers announce the selected one as "pressed".
 */
export function PillFilters<Value extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: PillFiltersProps<Value>) {
  return (
    <div role="group" aria-label={label} className={cx("flex flex-wrap gap-1.5", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={pillClasses(selected)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
