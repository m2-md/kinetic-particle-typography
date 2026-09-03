import type { AlphaRaster } from "./alphaRaster";

export interface CoverageIndex {
  /** Flat (row-major) indices of the pixels that pass the threshold. */
  readonly pixels: Int32Array;
  /** prefix[k] = coverage sum of the first k pixels. Length pixels.length + 1. */
  readonly prefix: Float64Array;
  readonly total: number;
}

export function buildCoverageIndex(raster: AlphaRaster, threshold: number): CoverageIndex {
  const { data } = raster;

  let count = 0;
  for (let i = 0; i < data.length; i++) if (data[i] >= threshold) count++;

  const pixels = new Int32Array(count);
  const prefix = new Float64Array(count + 1);

  let k = 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const a = data[i];
    if (a < threshold) continue;
    pixels[k] = i;
    sum += a / 255; // a half-covered pixel casts half a vote
    prefix[++k] = sum;
  }

  return { pixels, prefix, total: sum };
}

export function sampleTargets(
  raster: AlphaRaster,
  index: CoverageIndex,
  count: number,
  rng: () => number,
): Float32Array {
  const { pixels, prefix, total } = index;
  if (pixels.length === 0) return new Float32Array(count * 2);

  const out = new Float32Array(count * 2);
  const step = total / count;
  const invW = 1 / raster.width;
  const invH = 1 / raster.height;

  let j = 0; // walking cursor: never steps back
  for (let k = 0; k < count; k++) {
    // Stratum jitter: the k-th particle comes out of the [k, k+1) slice.
    const u = (k + rng()) * step;
    while (j < pixels.length - 1 && prefix[j + 1] < u) j++;

    const p = pixels[j];
    const px = p % raster.width;
    const py = (p / raster.width) | 0;

    // Intra-pixel jitter: particles landing on the same pixel do not stack up.
    out[k * 2] = (px + rng()) * invW;
    out[k * 2 + 1] = (py + rng()) * invH;
  }

  return out;
}
