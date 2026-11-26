"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/form-fields";
import { Table } from "@/components/ui/table";
import { stringColumns, stringRows } from "./string-table";

type SearchableTableProps = {
  /** Names the table for screen readers (the heading above it says the same). */
  caption: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
  /** The search box's label: "Search the directory". */
  searchLabel: string;
};

/** A table with a search box above it that keeps only the rows containing what's typed. */
export function SearchableTable({ caption, columns, rows, searchLabel }: SearchableTableProps) {
  const [query, setQuery] = useState("");
  const allRows = stringRows(rows);
  const search = query.trim().toLowerCase();
  const shown = search
    ? allRows.filter((row) => row.cells.some((cell) => cell.toLowerCase().includes(search)))
    : allRows;

  return (
    <>
      <TextField
        type="search"
        label={searchLabel}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="max-w-sm"
      />
      {/* Screen readers announce the count as it changes. */}
      <p role="status" className="mt-2 mb-3 min-h-5 text-small text-muted">
        {search ? `Showing ${shown.length} of ${allRows.length}` : ""}
      </p>
      <Card className="overflow-hidden">
        <Table
          caption={caption}
          hideCaption
          columns={stringColumns(columns)}
          rows={shown}
          rowKey={(row) => row.key}
          empty={`Nothing matches “${query.trim()}”.`}
        />
      </Card>
    </>
  );
}
