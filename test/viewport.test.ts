import { describe, expect, it } from "vitest";
import { MAX_DPR, backingSize } from "../src/viewport";

describe("backingSize", () => {
  it("dpr 2'ye kelepçeli", () => {
    expect(MAX_DPR).toBe(2);
    expect(backingSize(100, 50, 3, 1)).toEqual({ width: 200, height: 100 });
    expect(backingSize(100, 50, 0.5, 1)).toEqual({ width: 100, height: 50 });
  });

  it("ölçek [0.25, 1] aralığına kelepçeli", () => {
    expect(backingSize(400, 200, 1, 0.1)).toEqual({ width: 100, height: 50 });
    expect(backingSize(400, 200, 1, 2)).toEqual({ width: 400, height: 200 });
  });

  it("sonuç asla 0 olmuyor", () => {
    const size = backingSize(1, 1, 1, 0.25);
    expect(size.width).toBeGreaterThanOrEqual(1);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });

  it("dpr ve ölçek çarpılıyor", () => {
    expect(backingSize(960, 540, 2, 0.5)).toEqual({ width: 960, height: 540 });
  });
});
