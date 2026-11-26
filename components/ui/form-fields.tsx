// Form fields: each one is a labelled control with optional help text and an error message, wired
// up for screen readers (the label names the control; the help and the error describe it).
// Mark optional fields in the label, as the concept does: "Photo (optional)".
import { useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "@/lib/cx";

type FieldText = {
  label: ReactNode;
  /** Help under the control: what to enter, or what happens with it. */
  hint?: ReactNode;
  /** What's wrong with the value. The field is marked invalid while there is one. */
  error?: ReactNode;
};

const labelClasses = "block text-small font-semibold text-ink";
// 16px text, so phones don't zoom in on focus. Focus shows the outline from app/globals.css.
const controlClasses =
  "mt-1 block w-full rounded-lg border border-line-strong bg-white px-3 py-2.5 text-base text-ink " +
  "placeholder:text-muted aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-60";
const hintClasses = "mt-1 text-xs text-muted";
const errorClasses = "mt-1 text-small font-medium text-danger";

/** The ids that tie a control to its label, help text and error message. */
function useFieldIds(
  id: string | undefined,
  { hint, error }: Pick<FieldText, "hint" | "error">,
  describedBy: string | undefined,
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  return {
    controlId,
    hintId,
    errorId,
    control: {
      id: controlId,
      "aria-describedby": [describedBy, hintId, errorId].filter(Boolean).join(" ") || undefined,
      "aria-invalid": error ? true : undefined,
    },
  };
}

function HintAndError({
  ids,
  hint,
  error,
}: { ids: ReturnType<typeof useFieldIds> } & Pick<FieldText, "hint" | "error">) {
  return (
    <>
      {hint && (
        <p id={ids.hintId} className={hintClasses}>
          {hint}
        </p>
      )}
      {error && (
        <p id={ids.errorId} className={errorClasses}>
          {error}
        </p>
      )}
    </>
  );
}

type InputFieldProps = FieldText &
  Omit<ComponentProps<"input">, "type"> & {
    /** Any text-like type. Checkboxes use `<CheckboxField>`. */
    type?: "text" | "email" | "password" | "tel" | "url" | "search" | "number" | "date" | "file";
  };

/** A one-line text input with its label. `className` goes on the wrapper. */
export function TextField({ label, hint, error, id, className, ...props }: InputFieldProps) {
  const ids = useFieldIds(id, { hint, error }, props["aria-describedby"]);
  return (
    <div className={className}>
      <label htmlFor={ids.controlId} className={labelClasses}>
        {label}
      </label>
      <input type="text" {...props} {...ids.control} className={controlClasses} />
      <HintAndError ids={ids} hint={hint} error={error} />
    </div>
  );
}

type TextareaFieldProps = FieldText & ComponentProps<"textarea">;

/** A multi-line text input with its label. `className` goes on the wrapper. */
export function TextareaField({ label, hint, error, id, className, ...props }: TextareaFieldProps) {
  const ids = useFieldIds(id, { hint, error }, props["aria-describedby"]);
  return (
    <div className={className}>
      <label htmlFor={ids.controlId} className={labelClasses}>
        {label}
      </label>
      <textarea rows={4} {...props} {...ids.control} className={controlClasses} />
      <HintAndError ids={ids} hint={hint} error={error} />
    </div>
  );
}

type SelectFieldProps = FieldText & ComponentProps<"select">;

/** A drop-down list with its label; the `<option>`s are its children. */
export function SelectField({ label, hint, error, id, className, ...props }: SelectFieldProps) {
  const ids = useFieldIds(id, { hint, error }, props["aria-describedby"]);
  return (
    <div className={className}>
      <label htmlFor={ids.controlId} className={labelClasses}>
        {label}
      </label>
      <select {...props} {...ids.control} className={controlClasses} />
      <HintAndError ids={ids} hint={hint} error={error} />
    </div>
  );
}

type CheckboxFieldProps = FieldText & Omit<ComponentProps<"input">, "type">;

/** A checkbox with its label beside it. Put related ones in a `<Fieldset>`. */
export function CheckboxField({ label, hint, error, id, className, ...props }: CheckboxFieldProps) {
  const ids = useFieldIds(id, { hint, error }, props["aria-describedby"]);
  return (
    <div className={cx("flex gap-2", className)}>
      <input
        {...props}
        {...ids.control}
        type="checkbox"
        className="mt-0.5 size-4 flex-none accent-primary disabled:cursor-not-allowed"
      />
      <div>
        <label htmlFor={ids.controlId} className="text-sm text-ink">
          {label}
        </label>
        <HintAndError ids={ids} hint={hint} error={error} />
      </div>
    </div>
  );
}

type FieldsetProps = Omit<FieldText, "label"> & {
  /** The question the fields answer, for example "I can help with…". */
  legend: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Groups related checkboxes or fields under one label (a `<legend>`). */
export function Fieldset({ legend, hint, error, children, className }: FieldsetProps) {
  const ids = useFieldIds(undefined, { hint, error }, undefined);
  return (
    <fieldset
      aria-describedby={ids.control["aria-describedby"]}
      className={cx("min-w-0", className)}
    >
      <legend className={labelClasses}>{legend}</legend>
      <div className="mt-2 grid gap-1.5">{children}</div>
      <HintAndError ids={ids} hint={hint} error={error} />
    </fieldset>
  );
}
