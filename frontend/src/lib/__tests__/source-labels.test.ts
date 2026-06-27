import { formatSourceLabel, SOURCE_LABELS } from "@/lib/source-labels";

describe("SOURCE_LABELS", () => {
  it("maps all known source keys to friendly labels", () => {
    expect(SOURCE_LABELS).toMatchObject({
      github: "GitHub",
      localGit: "Local Git",
      local_git: "Local Git",
      opencode: "OpenCode",
      opencodedb: "OpenCode",
      sessions: "Sessions",
      throughput: "Throughput",
      cycleTime: "Cycle Time",
      staleWork: "Stale Work",
      sessionUsage: "Session Usage",
      tokenUsage: "Token Usage",
      orchestrator: "Orchestrator",
      orchestrated: "Orchestrator",
    });
  });
});

describe("formatSourceLabel", () => {
  it("returns exact label for known keys", () => {
    expect(formatSourceLabel("localGit")).toBe("Local Git");
    expect(formatSourceLabel("tokenUsage")).toBe("Token Usage");
    expect(formatSourceLabel("github")).toBe("GitHub");
    expect(formatSourceLabel("opencode")).toBe("OpenCode");
    expect(formatSourceLabel("opencodedb")).toBe("OpenCode");
  });

  it("splits unknown camelCase into title case", () => {
    expect(formatSourceLabel("unknownKey")).toBe("Unknown Key");
    expect(formatSourceLabel("someRandomTest")).toBe("Some Random Test");
  });

  it("passes through already-friendly strings unchanged", () => {
    expect(formatSourceLabel("Throughput")).toBe("Throughput");
  });

  it("handles one-word lowercase keys gracefully", () => {
    expect(formatSourceLabel("test")).toBe("Test");
  });

  it("handles empty string gracefully", () => {
    expect(formatSourceLabel("")).toBe("");
  });
});