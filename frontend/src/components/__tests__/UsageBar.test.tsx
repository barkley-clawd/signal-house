import { describe, expect, it } from "@jest/globals";
import { getUsageBarWidth } from "../usage-bar-utils";

describe("UsageBar", () => {
  it("returns null width when max is 0", () => {
    expect(getUsageBarWidth(100, 0)).toBeNull();
  });

  it("enforces minimum 4% width for tiny values", () => {
    expect(getUsageBarWidth(1, 1000)).toBe("4%");
  });

  it("fills to 100% when value equals max", () => {
    expect(getUsageBarWidth(50, 50)).toBe("100%");
  });

  it("clamps to 100% when value exceeds max", () => {
    expect(getUsageBarWidth(200, 100)).toBe("100%");
  });
});
