import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Table, type TableColumn } from "./table";

type Payment = { id: string; member: string; amount: string };

const COLUMNS: TableColumn<Payment>[] = [
  { key: "member", header: "Member", cell: (row) => row.member, rowHeader: true },
  { key: "amount", header: "Amount", cell: (row) => row.amount, numeric: true },
];

describe("Table", () => {
  it("names the table and its scrolling region with the caption", () => {
    render(
      <Table
        caption="Payments"
        columns={COLUMNS}
        rows={[{ id: "p1", member: "Jordan Ellis", amount: "$30.00" }]}
        rowKey={(row) => row.id}
      />,
    );

    expect(screen.getByRole("table", { name: "Payments" })).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Payments" });
    expect(region).toHaveAttribute("tabIndex", "0");
  });

  it("marks column and row headers for screen readers", () => {
    render(
      <Table
        caption="Payments"
        hideCaption
        columns={COLUMNS}
        rows={[{ id: "p1", member: "Jordan Ellis", amount: "$30.00" }]}
        rowKey={(row) => row.id}
      />,
    );

    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "Member",
      "Amount",
    ]);
    expect(screen.getByRole("rowheader", { name: "Jordan Ellis" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "$30.00" })).toHaveClass("text-right");
    expect(screen.getByText("Payments")).toHaveClass("sr-only");
  });

  it("says so when there are no rows", () => {
    render(
      <Table
        caption="Payments"
        columns={COLUMNS}
        rows={[]}
        rowKey={(row) => row.id}
        empty="No payments yet."
      />,
    );

    const [, body] = screen.getAllByRole("rowgroup");
    expect(within(body).getByRole("cell", { name: "No payments yet." })).toHaveAttribute(
      "colSpan",
      "2",
    );
  });
});
