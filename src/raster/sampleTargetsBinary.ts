import type { AlphaRaster } from "./alphaRaster";
import type { CoverageIndex } from "./extractTargets";

/**
 * Kontrol grubu. `sampleTargets` ile BİREBİR aynı çıktıyı üretir; tek fark,
 * dilimin hangi piksele düştüğünü sıralı yürüyüşle değil ikili aramayla
 * bulması. Yürüyüş `O(N + M)`, bu `O(N log M)`.
 *
 * Aynı sırada aynı sayıda `rng()` çağrısı yapmak ZORUNDA: eşdeğerlik testi
 * bit-birebir karşılaştırıyor.
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

    // prefix[j + 1] >= u koşulunu sağlayan EN KÜÇÜK j; yoksa son piksel.
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
