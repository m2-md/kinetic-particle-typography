import { describe, expect, it } from "vitest";
import { meanTravel } from "../src/assign/travel";

describe("meanTravel", () => {
  it("is zero for identical clouds", () => {
    const a = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
    expect(meanTravel(a, a)).toBe(0);
  });

  it("is exactly the offset for a constant shift", () => {
    const a = new Float32Array([0, 0, 1, 1, 0.5, 0.5]);
    const b = new Float32Array([3, 4, 4, 5, 3.5, 4.5]);
    // Every point moved by (3,4) → length 5.
    expect(meanTravel(a, b)).toBeCloseTo(5, 6);
  });

  it("handles a single-point cloud", () => {
    expect(meanTravel(new Float32Array([0, 0]), new Float32Array([0, 2]))).toBeCloseTo(2, 6);
  });
});
