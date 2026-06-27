export function formatCycleTime(seconds: number | null | undefined): string {
  if (seconds == null) return "";
  if (seconds < 120) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.round(seconds / 86400)}d`;
  const weeks = Math.floor(seconds / 604800);
  const remainderDays = Math.round((seconds % 604800) / 86400);
  if (remainderDays === 0) return `${weeks}w`;
  return `${weeks}w ${remainderDays}d`;
}
