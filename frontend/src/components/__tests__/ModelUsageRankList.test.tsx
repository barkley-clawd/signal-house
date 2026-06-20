import { describe, expect, it } from "vitest";
import { averageCostPerMessage, hasDetailData, totalTokens } from "../model-usage-utils";
import type { DashboardWindowSessionUsageSummary } from "@/types";

function makeSummary(
  overrides: Partial<DashboardWindowSessionUsageSummary> = {},
): DashboardWindowSessionUsageSummary {
  return {
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    totalSessions: 2,
    startedSessions: 2,
    completedSessions: 2,
    erroredSessions: 0,
    stuckSessions: 0,
    lastActivityAt: null,
    messages: 100,
    activeDays: 5,
    totalCost: 12.5,
    averageCostPerDay: 2.5,
    averageTokensPerSession: 1000,
    medianTokensPerSession: 900,
    inputTokens: 500,
    outputTokens: 300,
    cacheReadTokens: 100,
    cacheWriteTokens: 50,
    uniqueTools: [],
    toolUsage: [],
    modelUsage: [],
    topActions: [],
    errorCount: 0,
    status: "available",
    message: null,
    ...overrides,
  };
}

describe("ModelUsageRankList helpers", () => {
  it("computes total tokens from the session summary", () => {
    expect(totalTokens(makeSummary())).toBe(950);
  });

  it("recognizes when model details are empty", () => {
    expect(
      hasDetailData({
        modelName: "empty-model",
        messages: 3,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        cost: 0,
        isOther: false,
        proportion: 1,
      }),
    ).toBe(false);
  });

  it("computes average cost per message", () => {
    expect(
      averageCostPerMessage({
        modelName: "gpt-5.4-mini",
        messages: 80,
        inputTokens: 500,
        outputTokens: 250,
        cacheReadTokens: 100,
        cacheWriteTokens: 50,
        cost: 6.25,
        isOther: false,
        proportion: 0.8,
      }),
    ).toBeCloseTo(0.078125);
  });
});
