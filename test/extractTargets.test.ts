import { describe, expect, it } from "vitest";
import { buildCoverageIndex, sampleTargets } from "../src/raster/extractTargets";
import { solidBox } from "../src/raster/syntheticRaster";
import { mulberry32 } from "../src/rng";

describe("coverage index", () => {
  it("never takes pixels below the threshold", () => {
    // 8x8, the middle 4x4 area is 200, the rest 20.
    const raster = solidBox(8, 8, 2, 2, 4, 4, 200, 20);
    const index = buildCoverageIndex(raster, 128);
    expect(index.pixels.length).toBe(16);
  });

  it("the prefix strictly increases and ends on the total", () => {
    const raster = solidBox(16, 16, 3, 3, 8, 8, 255, 0);
    const index = buildCoverageIndex(raster, 1);
    for (let i = 1; i < index.prefix.length; i++) {
      expect(index.prefix[i]).toBeGreaterThan(index.prefix[i - 1]);
    }
    expect(index.prefix[index.prefix.length - 1]).toBeCloseTo(index.total, 10);
  });

  it("a pixel EXACTLY on the threshold is included (>= comparison)", () => {
    const raster = solidBox(4, 4, 1, 1, 2, 2, 64, 63);
    expect(buildCoverageIndex(raster, 64).pixels.length).toBe(4);
    // Had 63 been included too, the entire pixel area would have come in.
    expect(buildCoverageIndex(raster, 63).pixels.length).toBe(16);
  });

  it("coverage carries weight: an alpha-128 pixel casts half the vote of a 255 one", () => {
    // Left half 255, right half 128; a threshold of 64 takes both.
    const raster = solidBox(8, 4, 0, 0, 4, 4, 255, 128);
    const index = buildCoverageIndex(raster, 64);
    expect(index.pixels.length).toBe(32);
    // 16 pixels × 1.0 + 16 pixels × (128/255)
    expect(index.total).toBeCloseTo(16 + (16 * 128) / 255, 10);

    const points = sampleTargets(raster, index, 20_000, mulberry32(4));
    let left = 0;
    for (let i = 0; i < 20_000; i++) if (points[i * 2] < 0.5) left++;
    // The left half's share is 16 / (16 + 8.03) ≈ 0.666
    expect(left / 20_000).toBeCloseTo(16 / (16 + (16 * 128) / 255), 2);
  });
});

describe("stratified sampling", () => {
  it("always produces exactly count targets", () => {
    const raster = solidBox(32, 32, 8, 8, 4, 4, 255, 0);
    const index = buildCoverageIndex(raster, 128);
    for (const n of [1, 7, 1000]) {
      expect(sampleTargets(raster, index, n, mulberry32(1)).length).toBe(n * 2);
    }
  });

  it("every point produced lies inside a pixel that passes the threshold", () => {
    const raster = solidBox(32, 32, 8, 8, 6, 6, 255, 0);
    const index = buildCoverageIndex(raster, 128);
    const pts = sampleTargets(raster, index, 500, mulberry32(3));

    for (let i = 0; i < 500; i++) {
      const px = Math.floor(pts[i * 2] * 32);
      const py = Math.floor(pts[i * 2 + 1] * 32);
      expect(px).toBeGreaterThanOrEqual(8);
      expect(px).toBeLessThan(14);
      expect(py).toBeGreaterThanOrEqual(8);
      expect(py).toBeLessThan(14);
    }
  });

  it("the same seed gives a bit-identical cloud", () => {
    const raster = solidBox(32, 32, 4, 4, 10, 10, 255, 0);
    const index = buildCoverageIndex(raster, 128);
    const a = sampleTargets(raster, index, 2000, mulberry32(9));
    const b = sampleTargets(raster, index, 2000, mulberry32(9));
    expect(a).toEqual(b);
  });

  it("when no pixel passes the threshold, a zero array of length count*2", () => {
    const raster = solidBox(8, 8, 2, 2, 4, 4, 10, 0);
    const index = buildCoverageIndex(raster, 128);
    expect(index.pixels.length).toBe(0);
    const pts = sampleTargets(raster, index, 50, mulberry32(1));
    expect(pts.length).toBe(100);
    expect(Array.from(pts).every((v) => v === 0)).toBe(true);
  });
});
