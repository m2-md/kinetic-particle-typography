import { describe, expect, it } from "vitest";
import { buildCoverageIndex, sampleTargets } from "../src/raster/extractTargets";
import { sampleTargetsBinary } from "../src/raster/sampleTargetsBinary";
import { sampleTargetsRandom } from "../src/raster/sampleTargetsRandom";
import { solidBox, syntheticWord } from "../src/raster/syntheticRaster";
import { mulberry32 } from "../src/rng";

const RASTERS = [
  { name: "a single solid block", raster: solidBox(64, 32, 8, 4, 20, 16, 255, 0) },
  { name: "an antialiased synthetic word", raster: syntheticWord(128, 48, 5) },
  { name: "a two-level field", raster: solidBox(48, 48, 4, 4, 30, 30, 200, 40) },
];

const COUNTS = [37, 1000, 9999];

describe("walk ≡ binary search", () => {
  for (const { name, raster } of RASTERS) {
    it(`${name}: same seed, a bit-identical Float32Array`, () => {
      const index = buildCoverageIndex(raster, 32);
      for (const count of COUNTS) {
        const walk = sampleTargets(raster, index, count, mulberry32(count + 1));
        const binary = sampleTargetsBinary(raster, index, count, mulberry32(count + 1));
        expect(binary).toEqual(walk);
      }
    });
  }

  it("the pure random draw produces a DIFFERENT array (the control really is a control)", () => {
    const raster = RASTERS[1].raster;
    const index = buildCoverageIndex(raster, 32);
    const stratified = sampleTargets(raster, index, 2000, mulberry32(3));
    const random = sampleTargetsRandom(raster, index, 2000, mulberry32(3));
    expect(random).not.toEqual(stratified);
    expect(random.length).toBe(stratified.length);
  });
});
