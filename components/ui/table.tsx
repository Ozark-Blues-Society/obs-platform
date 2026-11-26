import { useId, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export type TableColumn<Row> = {
  /** Unique among the columns. */
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Right-aligns the column, with figures of equal width, for amounts and counts. */
  numeric?: boolean;
  /** The column that names each row, such as a member's name. Screen readers read it with each cell. */
  rowHeader?: boolean;
};

type TableProps<Row> = {
  /** What the table lists. Screen readers announce it, and it names the scrolling region. */
  caption: string;
  /** Hides the caption on screen when a heading above the table already says it. */
  hideCaption?: boolean;
  columns: readonly TableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  /** Shown in place of the rows when there are none. */
  empty?: ReactNode;
  className?: string;
};

/**
 * A data table. On a narrow screen it scrolls sideways inside its own region, which keyboard users
 * can focus and scroll with the arrow keys.
 */
export function Table<Row>({
  caption,
  hideCaption = false,
  columns,
  rows,
  rowKey,
  empty = "Nothing to show.",
  className,
}: TableProps<Row>) {
  const captionId = useId();
  const cellClasses = (column: TableColumn<Row>) =>
    cx("px-3 py-2.5", column.numeric ? "text-right tabular-nums" : "text-left");

  return (
    <div
      role="region"
      aria-labelledby={captionId}
      tabIndex={0}
      className={cx("overflow-x-auto", className)}
    >
      <table className="w-full border-collapse text-sm">
        <caption
          id={captionId}
          className={hideCaption ? "sr-only" : "px-3 pt-3 pb-2 text-left font-semibold"}
        >
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(
                  cellClasses(column),
                  "border-b border-line bg-canvas text-tag text-muted uppercase",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-muted">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-line last:border-b-0">
                {columns.map((column) =>
                  column.rowHeader ? (
                    <th
                      key={column.key}
                      scope="row"
                      className={cx(cellClasses(column), "font-semibold")}
                    >
                      {column.cell(row)}
                    </th>
                  ) : (
                    <td key={column.key} className={cellClasses(column)}>
                      {column.cell(row)}
                    </td>
                  ),
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
