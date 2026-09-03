import type { AlphaRaster } from "./alphaRaster";
import type { CoverageIndex } from "./extractTargets";

/**
 * Kontrol grubu: katman jitter'ı VAR, piksel içi jitter YOK.
 * Parçacıklar seçilen pikselin tam merkezine oturuyor. Aynı piksele birden
 * fazla parçacık düştüğünde üst üste biniyorlar — jitter'ın ne işe yaradığını
 * gösteren tek fark bu.
 */
export function sampleTargetsNoJitter(
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

  let j = 0;
  for (let k = 0; k < count; k++) {
    const u = (k + rng()) * step;
    while (j < pixels.length - 1 && prefix[j + 1] < u) j++;

    const p = pixels[j];
    const px = p % raster.width;
    const py = (p / raster.width) | 0;

    out[k * 2] = (px + 0.5) * invW;
    out[k * 2 + 1] = (py + 0.5) * invH;
  }

  return out;
}
