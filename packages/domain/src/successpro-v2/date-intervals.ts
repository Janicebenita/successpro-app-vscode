export interface DateInterval {
  startYear: number;
  startMonth?: number; // 1–12
  endYear: number;
  endMonth?: number;   // 1–12
}

/**
 * Normalizes an interval into a start and end point in continuous months (year * 12 + month).
 * If month is omitted, startMonth defaults to 1 and endMonth defaults to 12.
 */
function toMonthIndex(year: number, month?: number, isEnd = false): number {
  const m = month !== undefined ? Math.max(1, Math.min(12, month)) : (isEnd ? 12 : 1);
  return year * 12 + (m - 1);
}

/**
 * Rule 17: Union overlapping relevant intervals before calculating duration.
 * Two concurrent 12-month jobs are 12 calendar months, not 24.
 */
export function unionDateIntervals(intervals: DateInterval[]): Array<[number, number]> {
  if (!intervals.length) return [];

  // Convert each interval to [startMonthIndex, endMonthIndex]
  const ranges: Array<[number, number]> = intervals
    .map((iv) => {
      const start = toMonthIndex(iv.startYear, iv.startMonth, false);
      const end = toMonthIndex(iv.endYear, iv.endMonth, true);
      return [Math.min(start, end), Math.max(start, end)] as [number, number];
    })
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const merged: Array<[number, number]> = [];
  let current = ranges[0];

  for (let i = 1; i < ranges.length; i++) {
    const next = ranges[i];
    // If next overlaps or is adjacent (within 1 month)
    if (next[0] <= current[1] + 1) {
      current[1] = Math.max(current[1], next[1]);
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Calculates total non-overlapping calendar months from a set of employment intervals.
 */
export function calculateTenureMonths(intervals: DateInterval[]): number {
  const merged = unionDateIntervals(intervals);
  return merged.reduce((total, [start, end]) => total + (end - start + 1), 0);
}

/**
 * Calculates total non-overlapping calendar years (in decimals to 1 place).
 */
export function calculateTenureYears(intervals: DateInterval[]): number {
  const months = calculateTenureMonths(intervals);
  return Math.round((months / 12) * 10) / 10;
}
