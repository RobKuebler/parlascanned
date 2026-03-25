import { stripSoftHyphen, dataUrl } from "@/lib/data";

describe("stripSoftHyphen", () => {
  it("removes soft-hyphen and normalizes GRÜNEN party name", () => {
    expect(stripSoftHyphen("BÜNDNIS 90/\u00adDIE GRÜNEN")).toBe("Grüne");
    expect(stripSoftHyphen("BÜNDNIS 90/DIE GRÜNEN")).toBe("Grüne");
  });
  it("leaves strings without soft-hyphen unchanged", () => {
    expect(stripSoftHyphen("SPD")).toBe("SPD");
  });
  it("handles empty string", () => {
    expect(stripSoftHyphen("")).toBe("");
  });
});

describe("dataUrl", () => {
  it("builds correct URL for a period-specific file", () => {
    expect(dataUrl("politicians_{period}.json", 161)).toBe(
      "/data/politicians_161.json",
    );
  });
  it("builds correct URL for periods.json (no substitution needed)", () => {
    expect(dataUrl("periods.json", 161)).toBe("/data/periods.json");
  });
});
