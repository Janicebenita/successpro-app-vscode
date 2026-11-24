export function calculatePrecisionRecallF1(correct: number, extracted: number, expected: number) {
  const precision = extracted === 0 ? (expected === 0 ? 1.0 : 0.0) : Math.min(1.0, correct / extracted);
  const recall = expected === 0 ? (extracted === 0 ? 1.0 : 0.0) : Math.min(1.0, correct / expected);
  const f1 = precision + recall === 0 ? 0.0 : (2 * precision * recall) / (precision + recall);
  return {
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    f1: Math.round(f1 * 1000) / 1000,
  };
}

export function calculateMAE(predicted: number[], actual: number[]): number {
  if (predicted.length === 0 || predicted.length !== actual.length) return 0;
  const sumDiff = predicted.reduce((acc, val, idx) => acc + Math.abs(val - actual[idx]), 0);
  return Math.round((sumDiff / predicted.length) * 100) / 100;
}

export function calculateSpearmanRankCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n <= 1 || n !== y.length) return 1.0;

  const rank = (arr: number[]): number[] => {
    const sorted = arr.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
    const ranks = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      ranks[sorted[i].idx] = i + 1;
    }
    return ranks;
  };

  const rankX = rank(x);
  const rankY = rank(y);

  let dSquaredSum = 0;
  for (let i = 0; i < n; i++) {
    const diff = rankX[i] - rankY[i];
    dSquaredSum += diff * diff;
  }

  const denominator = n * (n * n - 1);
  if (denominator === 0) return 1.0;
  const correlation = 1 - (6 * dSquaredSum) / denominator;
  return Math.round(correlation * 1000) / 1000;
}
