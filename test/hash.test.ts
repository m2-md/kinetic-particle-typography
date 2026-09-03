import { describe, expect, it } from "vitest";
import { hash01 } from "../src/anim/hash";

/**
 * Shader'daki `hash01(uint)` ile birebir aynı sayıları vermek ZORUNDA.
 * Bu sabitler referans: shader tarafı ayrıca ölçüm modundaki parite
 * kontrolüyle karşılaştırılıyor.
 */
const EXPECTED = [
  0, 0.36358022689819336, 0.8319404125213623, 0.058440983295440674, 0.1870782971382141,
  0.8396884799003601, 0.05823761224746704, 0.3739044666290283,
];

describe("hash01", () => {
  it("ilk sekiz indekste beklenen sabitler", () => {
    for (let i = 0; i < EXPECTED.length; i++) {
      expect(hash01(i)).toBe(EXPECTED[i]);
    }
  });

  it("çıktı [0,1) aralığında", () => {
    for (let i = 0; i < 5000; i++) {
      const v = hash01(i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("deterministik ve indeksten indekse değişiyor", () => {
    expect(hash01(1234)).toBe(hash01(1234));
    const values = new Set<number>();
    for (let i = 0; i < 1000; i++) values.add(hash01(i));
    // 1000 indeks, çakışma neredeyse yok: karıştırıcı gerçekten karıştırıyor.
    expect(values.size).toBeGreaterThan(990);
  });
});
