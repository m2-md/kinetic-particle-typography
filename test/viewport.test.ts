import { describe, expect, it } from "vitest";
import { MAX_DPR, backingSize } from "../src/viewport";

describe("backingSize", () => {
  it("clamps dpr to 2", () => {
    expect(MAX_DPR).toBe(2);
    expect(backingSize(100, 50, 3, 1)).toEqual({ width: 200, height: 100 });
    expect(backingSize(100, 50, 0.5, 1)).toEqual({ width: 100, height: 50 });
  });

  it("clamps the scale to the [0.25, 1] range", () => {
    expect(backingSize(400, 200, 1, 0.1)).toEqual({ width: 100, height: 50 });
    expect(backingSize(400, 200, 1, 2)).toEqual({ width: 400, height: 200 });
  });

  it("the result is never 0", () => {
    const size = backingSize(1, 1, 1, 0.25);
    expect(size.width).toBeGreaterThanOrEqual(1);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });

  it("dpr and scale multiply", () => {
    expect(backingSize(960, 540, 2, 0.5)).toEqual({ width: 960, height: 540 });
  });
});
