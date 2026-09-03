import { describe, expect, it } from "vitest";
import { hash01 } from "../src/anim/hash";

/**
 * It MUST give the exact same numbers as the shader's `hash01(uint)`.
 * These constants are the reference: the shader side is additionally checked
 * against the parity comparison in measurement mode.
 */
const EXPECTED = [
  0, 0.36358022689819336, 0.8319404125213623, 0.058440983295440674, 0.1870782971382141,
  0.8396884799003601, 0.05823761224746704, 0.3739044666290283,
];

describe("hash01", () => {
  it("hits the expected constants on the first eight indices", () => {
    for (let i = 0; i < EXPECTED.length; i++) {
      expect(hash01(i)).toBe(EXPECTED[i]);
    }
  });

  it("the output stays in the [0,1) range", () => {
    for (let i = 0; i < 5000; i++) {
      const v = hash01(i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is deterministic and varies from index to index", () => {
    expect(hash01(1234)).toBe(hash01(1234));
    const values = new Set<number>();
    for (let i = 0; i < 1000; i++) values.add(hash01(i));
    // 1000 indices, almost no collisions: the mixer really does mix.
    expect(values.size).toBeGreaterThan(990);
  });
});
