import { formatCycleTime } from "@/lib/format-cycle-time";

describe("formatCycleTime", () => {
  it('returns "0s" for 0', () => {
    expect(formatCycleTime(0)).toBe("0s");
  });

  it("returns empty string for null", () => {
    expect(formatCycleTime(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatCycleTime(undefined)).toBe("");
  });

  it('returns "-100s" for negative value', () => {
    expect(formatCycleTime(-100)).toBe("-100s");
  });

  it('returns "30s" for 30', () => {
    expect(formatCycleTime(30)).toBe("30s");
  });

  it('returns "83s" for 83', () => {
    expect(formatCycleTime(83)).toBe("83s");
  });

  it('returns "118s" for 118', () => {
    expect(formatCycleTime(118)).toBe("118s");
  });

  it('returns "2m" for 120', () => {
    expect(formatCycleTime(120)).toBe("2m");
  });

  it('returns "6m" for 352', () => {
    expect(formatCycleTime(352)).toBe("6m");
  });

  it('returns "1h" for 3600', () => {
    expect(formatCycleTime(3600)).toBe("1h");
  });

  it('returns "2h" for 7200', () => {
    expect(formatCycleTime(7200)).toBe("2h");
  });

  it('returns "12h" for 43200', () => {
    expect(formatCycleTime(43200)).toBe("12h");
  });

  it('returns "1d" for 86400', () => {
    expect(formatCycleTime(86400)).toBe("1d");
  });

  it('returns "1w" for 604800', () => {
    expect(formatCycleTime(604800)).toBe("1w");
  });

  it('returns "1w 3d" for 864000', () => {
    expect(formatCycleTime(864000)).toBe("1w 3d");
  });
});
