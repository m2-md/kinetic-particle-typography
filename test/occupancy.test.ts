import { describe, expect, it } from "vitest";
import { occupancyCv } from "../src/measure/occupancy";
import { maskFromRaster } from "../src/measure/readability";
import { solidBox } from "../src/raster/syntheticRaster";

/** 8×8 raster, 4-pixel cells → a 2×2 = four-cell grid, all of them covered. */
const SUPPORT = maskFromRaster(solidBox(8, 8, 0, 0, 8, 8, 255, 0), 128, 4);

function repeat(pairs: readonly [number, number][], times: number): Float32Array {
  const out = new Float32Array(pairs.length * times * 2);
  let k = 0;
  for (const [x, y] of pairs) {
    for (let i = 0; i < times; i++) {
      out[k++] = x;
      out[k++] = y;
    }
  }
  return out;
}

describe("occupancy coefficient of variation", () => {
  it("is 0 for a cloud that lands equally in every cell", () => {
    const points = repeat(
      [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ],
      10,
    );
    expect(occupancyCv(points, 8, 8, 4, SUPPORT)).toBeCloseTo(0, 12);
  });

  it("is high for a cloud piled into a single cell", () => {
    const points = repeat([[0.25, 0.25]], 40);
    // Three empty cells + one full → std/mean = sqrt(3).
    expect(occupancyCv(points, 8, 8, 4, SUPPORT)).toBeCloseTo(Math.sqrt(3), 6);
  });

  it("an uneven distribution gives a larger CV than an even one", () => {
    const even = repeat(
      [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ],
      10,
    );
    const skewed = new Float32Array(even.length);
    skewed.set(even);
    // Move ten of the second cell's points into the first: break the balance.
    for (let i = 20; i < 40; i += 2) {
      skewed[i] = 0.25;
      skewed[i + 1] = 0.25;
    }
    expect(occupancyCv(skewed, 8, 8, 4, SUPPORT)).toBeGreaterThan(
      occupancyCv(even, 8, 8, 4, SUPPORT),
    );
  });

  it("returns a defined value on empty input", () => {
    expect(occupancyCv(new Float32Array(0), 8, 8, 4, SUPPORT)).toBe(0);
    expect(occupancyCv(new Float32Array(0), 8, 8, 4)).toBe(0);
  });
});
