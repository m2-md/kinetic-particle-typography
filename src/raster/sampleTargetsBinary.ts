import type { AlphaRaster } from "./alphaRaster";
import type { CoverageIndex } from "./extractTargets";

/**
 * Control group. Produces output BIT-IDENTICAL to `sampleTargets`; the only
 * difference is that it finds which pixel a slice lands on with a binary search
 * instead of a sequential walk. The walk is `O(N + M)`, this is `O(N log M)`.
 *
 * It MUST make the same number of `rng()` calls in the same order: the
 * equivalence test compares bit for bit.
 */
export function sampleTargetsBinary(
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
  const last = pixels.length - 1;

  for (let k = 0; k < count; k++) {
    const u = (k + rng()) * step;

    // The SMALLEST j satisfying prefix[j + 1] >= u; the last pixel if there is none.
    let lo = 0;
    let hi = last;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (prefix[mid + 1] < u) lo = mid + 1;
      else hi = mid;
    }

    const p = pixels[lo];
    const px = p % raster.width;
    const py = (p / raster.width) | 0;

    out[k * 2] = (px + rng()) * invW;
    out[k * 2 + 1] = (py + rng()) * invH;
  }

  return out;
}
