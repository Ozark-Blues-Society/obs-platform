import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MemberFileRow } from "@/lib/admin/member-files-state";
import { FileList } from "./file-list";

const FILE: MemberFileRow = {
  id: "3f2b9c1e-8d4a-4e6f-9b2c-7a1d5e8f0c3b",
  title: "Board minutes",
  fileName: "Board minutes.pdf",
  sizeBytes: 16,
  audience: "members",
  levels: [],
  createdAt: "2026-11-20T18:00:00Z",
};

describe("FileList", () => {
  it("names each file's buttons after it, starting with the words they show", () => {
    render(<FileList files={[FILE]} action={vi.fn(async () => ({ status: "idle" as const }))} />);
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent(FILE.id);
    // Speech input users say the words they see (WCAG 2.5.3 Label in Name).
    const copy = within(item).getByRole("button", { name: "Copy code for Board minutes" });
    expect(copy).toHaveTextContent(/^Copy code$/);
    const remove = within(item).getByRole("button", { name: "Remove Board minutes" });
    expect(remove).toHaveTextContent(/^Remove$/);
  });
});
