export const SOURCE_LABELS: Record<string, string> = {
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
};

export function formatSourceLabel(key: string): string {
  if (SOURCE_LABELS[key]) return SOURCE_LABELS[key];
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (s) => s.toUpperCase());
}
