import type { AlphaRaster } from "../raster/alphaRaster";

/**
 * Coarse grid mask. Raster space is cut into `cell`-pixel cells; a cell is
 * either full or empty. A single unit of measure so the particle cloud and the
 * letter silhouette can be compared at the same resolution.
 */
export interface Mask {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  readonly bits: Uint8Array;
}

export function maskDims(
  width: number,
  height: number,
  cell: number,
): { cols: number; rows: number } {
  return { cols: Math.ceil(width / cell), rows: Math.ceil(height / cell) };
}

function empty(width: number, height: number, cell: number): Mask {
  const { cols, rows } = maskDims(width, height, cell);
  return { cols, rows, cell, bits: new Uint8Array(cols * rows) };
}

/** A cell is full if any pixel in it passes the threshold. */
export function maskFromRaster(raster: AlphaRaster, threshold: number, cell: number): Mask {
  const mask = empty(raster.width, raster.height, cell);
  const { data, width, height } = raster;
  for (let y = 0; y < height; y++) {
    const row = ((y / cell) | 0) * mask.cols;
    for (let x = 0; x < width; x++) {
      if (data[y * width + x] >= threshold) mask.bits[row + ((x / cell) | 0)] = 1;
    }
  }
  return mask;
}

/** Stamps points in [0,1] space onto the grid. Anything outside is clamped. */
export function splat(points: Float32Array, width: number, height: number, cell: number): Mask {
  const mask = empty(width, height, cell);
  const n = points.length / 2;
  for (let i = 0; i < n; i++) {
    const cx = Math.min(mask.cols - 1, Math.max(0, ((points[i * 2] * width) / cell) | 0));
    const cy = Math.min(mask.rows - 1, Math.max(0, ((points[i * 2 + 1] * height) / cell) | 0));
    mask.bits[cy * mask.cols + cx] = 1;
  }
  return mask;
}

/**
 * Intersection over union, restricted to the horizontal band [x0, x1).
 * x0 and x1 are fractional: 0 is the left edge, 1 the right. Empty union → 0.
 */
export function iou(a: Mask, b: Mask, x0: number, x1: number): number {
  if (a.cols !== b.cols || a.rows !== b.rows) throw new Error("mask dimensions do not match");

  const from = Math.max(0, Math.min(a.cols, Math.round(x0 * a.cols)));
  const to = Math.max(from, Math.min(a.cols, Math.round(x1 * a.cols)));

  let inter = 0;
  let union = 0;
  for (let y = 0; y < a.rows; y++) {
    const row = y * a.cols;
    for (let x = from; x < to; x++) {
      const av = a.bits[row + x];
      const bv = b.bits[row + x];
      if (av && bv) inter++;
      if (av || bv) union++;
    }
  }
  return union === 0 ? 0 : inter / union;
}
