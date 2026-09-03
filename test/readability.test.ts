import { describe, expect, it } from "vitest";
import { iou, maskFromRaster, splat } from "../src/measure/readability";
import { solidBox } from "../src/raster/syntheticRaster";

describe("mask and IoU", () => {
  it("is 1 for an identical mask, 0 for a disjoint one", () => {
    const left = maskFromRaster(solidBox(32, 8, 0, 0, 16, 8, 255, 0), 128, 4);
    const right = maskFromRaster(solidBox(32, 8, 16, 0, 16, 8, 255, 0), 128, 4);

    expect(iou(left, left, 0, 1)).toBe(1);
    expect(iou(left, right, 0, 1)).toBe(0);
  });

  it("the band boundaries cut in the right place", () => {
    const left = maskFromRaster(solidBox(32, 8, 0, 0, 16, 8, 255, 0), 128, 4);
    const right = maskFromRaster(solidBox(32, 8, 16, 0, 16, 8, 255, 0), 128, 4);

    // In the left half `left` is full and `right` empty → intersection 0, union the left.
    expect(iou(left, right, 0, 0.5)).toBe(0);
    // Compare the left mask with itself over the right band: empty union → 0.
    expect(iou(left, left, 0.5, 1)).toBe(0);
    // Over the right band `right` overlaps itself exactly.
    expect(iou(right, right, 0.5, 1)).toBe(1);
  });

  it("splat clamps a point that spills outside the grid", () => {
    const points = new Float32Array([-5, -5, 5, 5, 0.5, 0.5]);
    const mask = splat(points, 32, 16, 4);
    expect(mask.cols).toBe(8);
    expect(mask.rows).toBe(4);
    // Top-left, bottom-right and center cells are marked; the overflow was not dropped.
    expect(mask.bits[0]).toBe(1);
    expect(mask.bits[mask.bits.length - 1]).toBe(1);
    let filled = 0;
    for (const b of mask.bits) filled += b;
    expect(filled).toBe(3);
  });

  it("masks with mismatched dimensions raise an error", () => {
    const a = splat(new Float32Array([0.5, 0.5]), 32, 16, 4);
    const b = splat(new Float32Array([0.5, 0.5]), 32, 16, 8);
    expect(() => iou(a, b, 0, 1)).toThrow(/do not match/);
  });
});
