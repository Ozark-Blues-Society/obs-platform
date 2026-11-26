// @vitest-environment node
import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "./contrast";

describe("contrastRatio", () => {
  it("gives 21:1 for black on white, in either order", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  it("gives 1:1 for a color on itself", () => {
    expect(contrastRatio("#c9973f", "#c9973f")).toBe(1);
  });

  it("matches known WCAG values", () => {
    // #777 on white is the classic just-under-AA grey (4.48:1).
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });

  it("uses the linear segment for very dark channels", () => {
    // 10/255 is below the 0.04045 threshold, so it is divided by 12.92.
    expect(relativeLuminance("#0a0a0a")).toBeCloseTo(10 / 255 / 12.92, 6);
  });

  it("accepts upper-case hex and rejects other formats", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(() => relativeLuminance("#fff")).toThrow(/#rrggbb/);
    expect(() => relativeLuminance("rgb(0 0 0)")).toThrow(/#rrggbb/);
  });
});
