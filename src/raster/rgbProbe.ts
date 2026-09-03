export interface EdgeRgbProbe {
  /** max(|R-255|, |G-255|, |B-255|) among the pixels with 0 < a < 255. */
  readonly maxDeviation: number;
  readonly edgePixels: number;
}

/**
 * In an RGBA buffer with white text drawn into it the edge pixels' RGB should in
 * theory be 255. The browser keeps the canvas premultiplied and `getImageData` undoes
 * the multiply; at low alpha the division rounding leaves a deviation. This measures it.
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
