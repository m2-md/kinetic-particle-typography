export interface EdgeRgbProbe {
  /** 0 < a < 255 olan pikseller arasında max(|R-255|, |G-255|, |B-255|). */
  readonly maxDeviation: number;
  readonly edgePixels: number;
}

/**
 * Beyaz metin çizilmiş bir RGBA tamponunda kenar piksellerinin RGB'si teoride
 * 255 olmalı. Tarayıcı canvas'ı önceden çarpılmış tutuyor, `getImageData` çarpımı
 * geri alıyor; düşük alfada bölme yuvarlaması sapma bırakıyor. Sapmayı ölçer.
 */
export function probeEdgeRgb(rgba: Uint8ClampedArray | Uint8Array): EdgeRgbProbe {
  let maxDeviation = 0;
  let edgePixels = 0;

  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a === 0 || a === 255) continue;
    edgePixels++;
    const dr = Math.abs(rgba[i] - 255);
    const dg = Math.abs(rgba[i + 1] - 255);
    const db = Math.abs(rgba[i + 2] - 255);
    const d = Math.max(dr, dg, db);
    if (d > maxDeviation) maxDeviation = d;
  }

  return { maxDeviation, edgePixels };
}
