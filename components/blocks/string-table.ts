import type { TableColumn } from "@/components/ui/table";

/** A row of a table typed in the Studio: one string per column. */
export type StringRow = { key: string; cells: readonly string[] };

/** Table columns for rows of strings. The first column names each row. */
export function stringColumns(headers: readonly string[]): TableColumn<StringRow>[] {
  return headers.map((header, index) => ({
    key: String(index),
    header,
    cell: (row) => row.cells[index],
    rowHeader: index === 0,
  }));
}

/** Rows of strings, keyed by their position. */
export function stringRows(rows: readonly (readonly string[])[]): StringRow[] {
  return rows.map((cells, index) => ({ key: String(index), cells }));
}
