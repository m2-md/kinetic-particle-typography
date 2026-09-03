/** Girdi dizisini MUTASYONA UĞRATMAZ; kopya üzerinde sıralar. */
export function median(values: readonly number[]): number {
  return percentile(values, 50);
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];

  const rank = (Math.min(100, Math.max(0, p)) / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

export function round(x: number, digits: number): number {
  if (!Number.isFinite(x)) return Number.NaN;
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}
