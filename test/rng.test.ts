import { describe, expect, it } from "vitest";
import { mulberry32 } from "../src/rng";

describe("mulberry32", () => {
  it("the output stays in the [0,1) range", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("the same seed gives the same sequence", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 100; i++) expect(b()).toBe(a());
  });

  it("a different seed gives a different sequence", () => {
    const a = mulberry32(7);
    const b = mulberry32(8);
    let same = 0;
    for (let i = 0; i < 100; i++) if (a() === b()) same++;
    expect(same).toBe(0);
  });
});
