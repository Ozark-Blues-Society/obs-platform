import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemberFiles } from "./member-files";

const CODE = "3f2b9c1e-8d4a-4e6f-9b2c-7a1d5e8f0c3b";
const OTHER = "00000000-0000-4000-8920-000000000002";

/** Appends an invisible edit marker, as Sanity's stega encoding does in a preview. */
function withEditMarker(text: string): string {
  const digits = [0x200b, 0x200c, 0x200d, 0xfeff].map((code) => String.fromCharCode(code));
  const bytes = new TextEncoder().encode(JSON.stringify({ origin: "sanity.io", href: "/studio" }));
  const marker = [...bytes]
    .map((byte) => [6, 4, 2, 0].map((shift) => digits[(byte >> shift) & 3]).join(""))
    .join("");
  return `${text}${digits[0].repeat(4)}${marker}`;
}

describe("MemberFiles", () => {
  it("links each file to its download route, marked members only", () => {
    render(
      <MemberFiles
        files={[
          { title: "Board minutes (PDF)", fileId: CODE },
          { title: "Booking guide", fileId: OTHER },
        ]}
      />,
    );
    const section = screen.getByRole("region", { name: "Files for members" });
    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole("link", { name: "Board minutes (PDF)" })).toHaveAttribute(
      "href",
      `/files/${CODE}`,
    );
    expect(items[0]).toHaveTextContent("Members only");
    expect(within(items[1]).getByRole("link")).toHaveAttribute("href", `/files/${OTHER}`);
  });

  it("skips entries without link text or a valid code", () => {
    render(
      <MemberFiles
        files={[
          { title: "Pasted a web address", fileId: "https://example.org/a.pdf" },
          { title: "  ", fileId: CODE },
          { fileId: OTHER },
          { title: "Kept", fileId: OTHER },
        ]}
      />,
    );
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["Kept"]);
  });

  it("cleans a preview's edit markers out of the code, but keeps them in the text", () => {
    render(
      <MemberFiles files={[{ title: withEditMarker("Minutes"), fileId: withEditMarker(CODE) }]} />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/files/${CODE}`);
    expect(link.textContent).not.toBe("Minutes");
  });

  it("renders nothing when there are no files", () => {
    for (const files of [undefined, null, [], [{ title: "No code" }]]) {
      const { container, unmount } = render(<MemberFiles files={files} />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("can sit under another heading", () => {
    render(<MemberFiles files={[{ title: "Minutes", fileId: CODE }]} headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3, name: "Files for members" })).toBeVisible();
  });
});
