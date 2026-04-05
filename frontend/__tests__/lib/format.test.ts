import { formatEuroStat } from "@/lib/format";

describe("formatEuroStat", () => {
  it("keeps small values as localized integers", () => {
    expect(formatEuroStat(12345)).toBe("12.345");
  });

  it("formats millions compactly", () => {
    expect(formatEuroStat(1500000)).toBe("1,5 Mio.");
  });
});
