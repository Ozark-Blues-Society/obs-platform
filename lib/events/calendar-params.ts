// The events calendar's address (backlog P-2): ?month=2026-12 picks the month (this month by
// default), ?view=list shows it as a list, ?category=jam filters it. Plain functions, because
// the page (a server component) and the calendar (a client component) both use them: a client
// component's own exports can't be called from the server.
import { isMonth, societyMonth } from "@/lib/society-time";
import { EVENTS_PATH } from "@/sanity/paths";
import { EVENT_CATEGORIES, type OptionValue } from "@/sanity/schemas/options";

export type CalendarView = "month" | "list";
export type CategoryFilter = "all" | OptionValue<typeof EVENT_CATEGORIES>;

/** The category filters, "All" first, with the labels the pills show. */
export const CATEGORY_FILTERS: readonly { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...EVENT_CATEGORIES.map(({ value, title }) => ({ value, label: title })),
];

export function isCategoryFilter(value: unknown): value is CategoryFilter {
  return CATEGORY_FILTERS.some((option) => option.value === value);
}

type SearchParams = Record<string, string | string[] | undefined>;

/** What the address asks for; anything it doesn't say, or says wrong, is the default. */
export function readCalendarParams(params: SearchParams, now: Date) {
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const month = first("month");
  return {
    month: isMonth(month) ? month : societyMonth(now),
    ...choices(first("view"), first("category")),
  };
}

/**
 * The view and category in the browser's address (useSearchParams), read as readCalendarParams
 * reads them: the first value of each, the default if it's missing or wrong.
 */
export function readCalendarChoices(search: { get(key: string): string | null }) {
  return choices(search.get("view") ?? undefined, search.get("category") ?? undefined);
}

function choices(view: string | undefined, category: string | undefined) {
  return {
    view: (view === "list" ? "list" : "month") as CalendarView,
    category: isCategoryFilter(category) ? category : ("all" as CategoryFilter),
  };
}

/** The calendar's address for a month, view and category, leaving out the defaults. */
export function calendarHref(month: string, view: CalendarView, category: CategoryFilter): string {
  const query = new URLSearchParams({ month });
  if (view !== "month") query.set("view", view);
  if (category !== "all") query.set("category", category);
  return `${EVENTS_PATH}?${query}`;
}
