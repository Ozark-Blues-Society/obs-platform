import { describe, expect, it } from "vitest";
import {
  FILE_MESSAGES,
  MAX_FILE_BYTES,
  audienceLabel,
  checkFile,
  downloadName,
  formatBytes,
  idFromObjectPath,
  objectPathFor,
  parseAudience,
  parseTitle,
  safeObjectName,
} from "./member-files-state";

const ID = "3f2b9c1e-8d4a-4e6f-9b2c-7a1d5e8f0c3b";

describe("safeObjectName", () => {
  it("keeps only characters Storage accepts, and the extension", () => {
    expect(safeObjectName("Minutes, Nov 2026 (final).pdf")).toBe("Minutes-Nov-2026-final-.pdf");
    expect(safeObjectName("Caf\u00e9 M\u00e9ndez \u2013 menu.docx")).toBe("Cafe-Mendez-menu.docx");
    expect(safeObjectName("C:\\Users\\kelly\\booking guide.pdf")).toBe("booking-guide.pdf");
    expect(safeObjectName("../../etc/passwd")).toBe("passwd");
    expect(safeObjectName(".hidden")).toBe("hidden");
    expect(safeObjectName("???")).toBe("file");
  });

  it("shortens long names to 120 characters, keeping the extension", () => {
    const name = safeObjectName(`${"a".repeat(300)}.pdf`);
    expect(name).toHaveLength(120);
    expect(name.endsWith(".pdf")).toBe(true);
  });
});

describe("object paths", () => {
  it("put the file in a folder named after its id, and give the id back", () => {
    const path = objectPathFor(ID, "Board minutes.pdf");
    expect(path).toBe(`${ID}/Board-minutes.pdf`);
    expect(idFromObjectPath(path)).toBe(ID);
  });

  it("reject paths objectPathFor wouldn't make", () => {
    for (const path of [
      `${ID}`,
      `${ID}/`,
      `${ID}/a/b.pdf`,
      `${ID}/spaces here.pdf`,
      `x${ID}/a.pdf`,
      "../a.pdf",
      42,
      null,
    ]) {
      expect(idFromObjectPath(path), String(path)).toBeNull();
    }
  });
});

describe("downloadName", () => {
  it("keeps the original name, without folders, at most 200 characters", () => {
    expect(downloadName("Board minutes, Nov.pdf")).toBe("Board minutes, Nov.pdf");
    expect(downloadName("C:\\fakepath\\Booking guide.pdf")).toBe("Booking guide.pdf");
    expect(downloadName("  ")).toBe("file");
    expect(downloadName("b".repeat(250))).toHaveLength(200);
  });
});

describe("checkFile", () => {
  it("needs a file that isn't empty or over 50 MB", () => {
    expect(checkFile(null)).toBe(FILE_MESSAGES.fileMissing);
    expect(checkFile({ name: "", size: 10 })).toBe(FILE_MESSAGES.fileMissing);
    expect(checkFile({ name: "a.pdf", size: 0 })).toBe(FILE_MESSAGES.fileEmpty);
    expect(checkFile({ name: "a.pdf", size: MAX_FILE_BYTES + 1 })).toBe(FILE_MESSAGES.fileTooBig);
    expect(checkFile({ name: "a.pdf", size: MAX_FILE_BYTES })).toBeNull();
  });
});

describe("parseTitle", () => {
  it("trims the name and needs one under 200 characters", () => {
    expect(parseTitle("  Board   minutes ")).toEqual({ title: "Board minutes" });
    expect(parseTitle("   ")).toEqual({ problem: FILE_MESSAGES.titleMissing });
    expect(parseTitle(null)).toEqual({ problem: FILE_MESSAGES.titleMissing });
    expect(parseTitle("x".repeat(201))).toEqual({ problem: FILE_MESSAGES.titleTooLong });
  });
});

describe("parseAudience", () => {
  it("reads every member, or the ticked levels in the board's order", () => {
    expect(parseAudience("members", ["band"])).toEqual({ audience: "members", levels: [] });
    expect(parseAudience("levels", ["sponsor", "band", "family"])).toEqual({
      audience: "levels",
      levels: ["band", "sponsor"],
    });
  });

  it("needs a choice, and a level for some levels", () => {
    expect(parseAudience(null, [])).toEqual({ problem: FILE_MESSAGES.audienceMissing });
    expect(parseAudience("everyone", [])).toEqual({ problem: FILE_MESSAGES.audienceMissing });
    expect(parseAudience("levels", [])).toEqual({ problem: FILE_MESSAGES.levelsMissing });
  });
});

describe("audienceLabel", () => {
  it("says who can download a file in words", () => {
    expect(audienceLabel("members", [])).toBe("Every member");
    expect(audienceLabel("levels", ["sponsor"])).toBe("Sponsor members");
    expect(audienceLabel("levels", ["sponsor", "band", "business"])).toBe(
      "Band, Business and Sponsor members",
    );
    expect(audienceLabel("levels", [])).toBe("Nobody (no level ticked)");
  });
});

describe("formatBytes", () => {
  it("shows sizes the way people read them", () => {
    expect(formatBytes(120)).toBe("120 bytes");
    expect(formatBytes(830 * 1024)).toBe("830 KB");
    expect(formatBytes(2.4 * 1024 * 1024)).toBe("2.4 MB");
    expect(formatBytes(null)).toBe("");
  });
});
