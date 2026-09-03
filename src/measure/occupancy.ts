import { maskDims, type Mask } from "./readability";

/**
 * Coefficient of variation of grid occupancy (std / mean).
 * A low value = the particles are spread evenly across the cells.
 *
 * If `support` is given only those cells count — the area the letter covers.
 * If it is not, the cells holding at least one particle count. When measuring
 * clustering the right denominator is the letter silhouette: drop the empty
 * cells from the denominator and the random draw looks unfairly good.
 */
export function occupancyCv(
  points: Float32Array,
  width: number,
  height: number,
  cell = 8,
  support?: Mask,
): number {
  const { cols, rows } = maskDims(width, height, cell);
  const counts = new Int32Array(cols * rows);

  const n = points.length / 2;
  for (let i = 0; i < n; i++) {
    const cx = Math.min(cols - 1, Math.max(0, ((points[i * 2] * width) / cell) | 0));
    const cy = Math.min(rows - 1, Math.max(0, ((points[i * 2 + 1] * height) / cell) | 0));
    counts[cy * cols + cx]++;
  }

  if (support && (support.cols !== cols || support.rows !== rows)) {
    throw new Error("support mask does not match the grid");
  }

  let used = 0;
  let sum = 0;
  for (let i = 0; i < counts.length; i++) {
    const inside = support ? support.bits[i] === 1 : counts[i] > 0;
    if (!inside) continue;
    used++;
    sum += counts[i];
  }
  if (used === 0) return 0;

  const mean = sum / used;
  if (mean === 0) return 0;

  let variance = 0;
  for (let i = 0; i < counts.length; i++) {
    const inside = support ? support.bits[i] === 1 : counts[i] > 0;
    if (!inside) continue;
    const d = counts[i] - mean;
    variance += d * d;
  }
  variance /= used;

  return Math.sqrt(variance) / mean;
}
