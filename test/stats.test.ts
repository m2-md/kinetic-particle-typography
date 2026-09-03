import { describe, expect, it } from "vitest";
import { median, percentile, round } from "../src/stats";

describe("median / percentile", () => {
  it("takes the middle element for an odd count", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("averages for an even count", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("gives NaN on an empty array (NOT 0)", () => {
    expect(Number.isNaN(percentile([], 50))).toBe(true);
    expect(Number.isNaN(median([]))).toBe(true);
  });

  it("p0 is the minimum, p100 the maximum", () => {
    const values = [5, 1, 9, 3];
    expect(percentile(values, 0)).toBe(1);
    expect(percentile(values, 100)).toBe(9);
  });

  it("the input array is NOT MUTATED", () => {
    const values = [9, 2, 7, 1];
    median(values);
    percentile(values, 95);
    expect(values).toEqual([9, 2, 7, 1]);
  });

  it("round gives NaN on non-finite input", () => {
    expect(round(1.23456, 2)).toBe(1.23);
    expect(Number.isNaN(round(Number.POSITIVE_INFINITY, 2))).toBe(true);
  });
});
