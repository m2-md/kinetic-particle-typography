import { describe, expect, it } from "vitest";
import { probeEdgeRgb } from "../src/raster/rgbProbe";

function rgbaFrom(pixels: readonly [number, number, number, number][]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b, a], i) => {
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = a;
  });
  return out;
}

describe("probeEdgeRgb", () => {
  it("yalnızca 0 < a < 255 olan pikselleri sayıyor", () => {
    const rgba = rgbaFrom([
      [0, 0, 0, 0], // tamamen boş
      [255, 255, 255, 255], // tamamen dolu
      [250, 255, 255, 40], // kenar
      [255, 244, 255, 120], // kenar
    ]);
    const probe = probeEdgeRgb(rgba);
    expect(probe.edgePixels).toBe(2);
    expect(probe.maxDeviation).toBe(11);
  });

  it("kusursuz beyaz kenarda sapma 0", () => {
    const rgba = rgbaFrom([
      [255, 255, 255, 7],
      [255, 255, 255, 200],
    ]);
    expect(probeEdgeRgb(rgba)).toEqual({ maxDeviation: 0, edgePixels: 2 });
  });

  it("hiç kenar pikseli yoksa sıfır", () => {
    const rgba = rgbaFrom([
      [0, 0, 0, 0],
      [255, 255, 255, 255],
    ]);
    expect(probeEdgeRgb(rgba)).toEqual({ maxDeviation: 0, edgePixels: 0 });
  });
});
