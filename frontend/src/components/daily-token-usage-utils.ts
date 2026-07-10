import type { DailyTokenUsageRow } from "@/types";

/**
 * Walk the date spine right-to-left and return the first date
 * that has a matching row (i.e., non-gap day).
 * Returns `null` when every day in the spine is a gap.
 */
export function lastNonGapDay(
  spine: string[],
  rows: DailyTokenUsageRow[],
): string | null {
  const datesWithData = new Set(rows.map((r) => r.date));
  for (let i = spine.length - 1; i >= 0; i--) {
    if (datesWithData.has(spine[i])) return spine[i];
  }
  return null;
}

/**
 * Convert a raw `convertFromPixel` result into a valid category index.
 *
 * Handles the ECharts return type (`number | number[] | null | undefined`):
 * extracts the first element if an array, validates finiteness and range,
 * and rounds to the nearest integer for nearest-day resolution.
 *
 * Returns `null` when the coordinate is invalid, out of range, or the
 * spine is empty (no day to resolve).
 */
export function resolveClickIndex(
  result: number | number[] | null | undefined,
  spineLength: number,
): number | null {
  if (spineLength === 0) return null;
  const raw = Array.isArray(result) ? result[0] : result;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const idx = Math.round(raw);
  if (idx < 0 || idx >= spineLength) return null;
  return idx;
}
