/**
 * Rule 09: Keep full precision in effective weights/points.
 * Display parameter/pillar points to one or two decimals, total to one decimal,
 * and calculate the total from unrounded values.
 */
export function roundDisplay(value: number, decimals = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Rule 23: Proposed score labels / descriptive bands
 * Applied to final unrounded total only.
 */
export function getDescriptiveBand(score: number): string {
  if (score < 40) return "Substantial revision";
  if (score < 60) return "Major improvement";
  if (score < 75) return "Developing";
  if (score < 90) return "Strong foundation";
  return "Strong presentation of evidence";
}

/**
 * Checks whether independent row rounding creates a +/-0.1 difference from the unrounded total.
 * Returns a standard footnote if discrepancy exists per Rule 09.
 */
export function checkRowRoundingDiscrepancy(
  exactTotal: number,
  rowValues: number[],
  decimals = 1
): string | undefined {
  const sumOfRoundedRows = rowValues.reduce((sum, v) => sum + roundDisplay(v, decimals), 0);
  const roundedExactTotal = roundDisplay(exactTotal, decimals);
  const diff = Math.abs(sumOfRoundedRows - roundedExactTotal);

  if (diff > 0.001) {
    return "Displayed individual parameter points are rounded for presentation; the cumulative score is calculated from unrounded exact values.";
  }
  return undefined;
}
