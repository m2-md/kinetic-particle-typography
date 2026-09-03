import type { AlphaRaster } from "./alphaRaster";
import type { CoverageIndex } from "./extractTargets";

/**
 * Control group: unstratified, pure random draw. `u = rng() * total`.
 * The queries are not ordered, so a walking cursor is out and a binary search is
 * mandatory. This is the clustering reference point in the occupancy measurement.
 */
export function sampleTargetsRandom(
  raster: AlphaRaster,
  index: CoverageIndex,
  count: number,
  rng: () => number,
): Float32Array {
  const { pixels, prefix, total } = index;
  if (pixels.length === 0) return new Float32Array(count * 2);

  const out = new Float32Array(count * 2);
  const invW = 1 / raster.width;
  const invH = 1 / raster.height;
  const last = pixels.length - 1;

  for (let k = 0; k < count; k++) {
    const u = rng() * total;

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
