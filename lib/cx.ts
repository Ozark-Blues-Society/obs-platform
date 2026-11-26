/**
 * Joins class names, skipping the empty ones: `cx("a", isOn && "b")` gives "a b" or "a".
 *
 * It doesn't resolve conflicts: with two classes that set the same property (`px-2` and `px-5`),
 * the one later in Tailwind's stylesheet wins, whatever their order here. Components choose
 * between such classes with a condition, and take a `className` only for layout (margins, width).
 */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
