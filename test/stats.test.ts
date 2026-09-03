import { describe, expect, it } from "vitest";
import { median, percentile, round } from "../src/stats";

describe("median / percentile", () => {
  it("tek sayıda elemanda ortadaki", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("çift sayıda elemanda ortalama", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("boş dizide NaN (0 DEĞİL)", () => {
    expect(Number.isNaN(percentile([], 50))).toBe(true);
    expect(Number.isNaN(median([]))).toBe(true);
  });

  it("p0 minimum, p100 maksimum", () => {
    const values = [5, 1, 9, 3];
    expect(percentile(values, 0)).toBe(1);
    expect(percentile(values, 100)).toBe(9);
  });

  it("girdi dizisi MUTASYONA UĞRAMIYOR", () => {
    const values = [9, 2, 7, 1];
    median(values);
    percentile(values, 95);
    expect(values).toEqual([9, 2, 7, 1]);
  });

  it("round sonlu olmayan girdide NaN", () => {
    expect(round(1.23456, 2)).toBe(1.23);
    expect(Number.isNaN(round(Number.POSITIVE_INFINITY, 2))).toBe(true);
  });
});
