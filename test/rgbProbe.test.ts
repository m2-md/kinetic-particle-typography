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
  it("counts only the pixels with 0 < a < 255", () => {
    const rgba = rgbaFrom([
      [0, 0, 0, 0], // fully empty
      [255, 255, 255, 255], // fully covered
      [250, 255, 255, 40], // edge
      [255, 244, 255, 120], // edge
    ]);
    const probe = probeEdgeRgb(rgba);
    expect(probe.edgePixels).toBe(2);
    expect(probe.maxDeviation).toBe(11);
  });

  it("a perfectly white edge deviates by 0", () => {
    const rgba = rgbaFrom([
      [255, 255, 255, 7],
      [255, 255, 255, 200],
    ]);
    expect(probeEdgeRgb(rgba)).toEqual({ maxDeviation: 0, edgePixels: 2 });
  });

  it("returns zero when there is no edge pixel at all", () => {
    const rgba = rgbaFrom([
      [0, 0, 0, 0],
      [255, 255, 255, 255],
    ]);
    expect(probeEdgeRgb(rgba)).toEqual({ maxDeviation: 0, edgePixels: 0 });
  });
});
