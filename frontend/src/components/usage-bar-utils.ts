export function getUsageBarWidth(value: number, max: number): string | null {
  if (max === 0) return null;
  const clampedPercent = Math.min(value / max, 1);
  return `${Math.max(clampedPercent * 100, 4)}%`;
}
