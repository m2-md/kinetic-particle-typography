import { describe, expect, it } from "vitest";
import { morton2D, part1By1 } from "../src/assign/morton";
import { mortonOrder, reorder } from "../src/assign/rank";
import { mulberry32 } from "../src/rng";

describe("morton code", () => {
  it("spreads the bits by interleaving zeros", () => {
    expect(part1By1(0b1111)).toBe(0b01010101);
    expect(part1By1(0)).toBe(0);
    expect(part1By1(0xffff)).toBe(0x55555555);
  });

  it("is monotonic along a single axis", () => {
    // With y fixed, the code has to grow as x grows.
    let previous = -1;
    for (let i = 0; i <= 100; i++) {
      const code = morton2D(i / 100, 0.5);
      expect(code).toBeGreaterThan(previous);
      previous = code;
    }
  });

  it("nearby points get nearby codes (in the same quadrant the top bits are shared)", () => {
    const a = morton2D(0.2501, 0.2501);
    const b = morton2D(0.2502, 0.2502);
    expect(a >>> 20).toBe(b >>> 20);
  });

  it("the corners: (0,0) is zero, (1,1) is all 32 bits", () => {
    expect(morton2D(0, 0)).toBe(0);
    expect(morton2D(1, 1)).toBe(0xffffffff);
  });

  it("out-of-range input gets clamped", () => {
    expect(morton2D(-0.5, -2)).toBe(morton2D(0, 0));
    expect(morton2D(1.5, 3)).toBe(morton2D(1, 1));
  });
});

describe("the 52-bit key", () => {
  it("packing the code and the index is lossless", () => {
    const count = 1000;
    const points = new Float32Array(count * 2);
    const rng = mulberry32(5);
    for (let i = 0; i < count * 2; i++) points[i] = rng();

    const order = mortonOrder(points, count);
    // The ordering MUST be a permutation: every index exactly once.
    const seen = new Uint8Array(count);
    for (const i of order) seen[i]++;
    expect(Array.from(seen).every((c) => c === 1)).toBe(true);
  });

  it("the result is non-decreasing by Morton code", () => {
    const count = 500;
    const points = new Float32Array(count * 2);
    const rng = mulberry32(11);
    for (let i = 0; i < count * 2; i++) points[i] = rng();

    const order = mortonOrder(points, count);
    let previous = -1;
    for (const i of order) {
      const code = morton2D(points[i * 2], points[i * 2 + 1]);
      expect(code).toBeGreaterThanOrEqual(previous);
      previous = code;
    }
  });

  it("throws when the index does not fit in 20 bits", () => {
    const count = 2 ** 20 + 1;
    expect(() => mortonOrder(new Float32Array(2), count)).toThrow(/20 bits/);
  });

  it("reorder actually applies the ordering", () => {
    const points = new Float32Array([0, 0, 1, 1, 2, 2]);
    const out = reorder(points, new Uint32Array([2, 0, 1]));
    expect(Array.from(out)).toEqual([2, 2, 0, 0, 1, 1]);
  });
});
