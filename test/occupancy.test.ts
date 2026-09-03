import { describe, expect, it } from "vitest";
import { occupancyCv } from "../src/measure/occupancy";
import { maskFromRaster } from "../src/measure/readability";
import { solidBox } from "../src/raster/syntheticRaster";

/** 8×8 raster, 4 piksellik hücre → 2×2 = dört hücrelik ızgara, hepsi kapsanan. */
const SUPPORT = maskFromRaster(solidBox(8, 8, 0, 0, 8, 8, 255, 0), 128, 4);

function repeat(pairs: readonly [number, number][], times: number): Float32Array {
  const out = new Float32Array(pairs.length * times * 2);
  let k = 0;
  for (const [x, y] of pairs) {
    for (let i = 0; i < times; i++) {
      out[k++] = x;
      out[k++] = y;
    }
  }
  return out;
}

describe("doluluk değişim katsayısı", () => {
  it("her hücreye eşit sayıda düşen bulutta 0", () => {
    const points = repeat(
      [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ],
      10,
    );
    expect(occupancyCv(points, 8, 8, 4, SUPPORT)).toBeCloseTo(0, 12);
  });

  it("tek hücreye yığılmış bulutta yüksek", () => {
    const points = repeat([[0.25, 0.25]], 40);
    // Üç boş + bir dolu hücre → std/ortalama = sqrt(3).
    expect(occupancyCv(points, 8, 8, 4, SUPPORT)).toBeCloseTo(Math.sqrt(3), 6);
  });

  it("dengesiz dağılım eşit dağılımdan büyük CV veriyor", () => {
    const even = repeat(
      [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ],
      10,
    );
    const skewed = new Float32Array(even.length);
    skewed.set(even);
    // İkinci hücrenin on noktasını birinciye taşı: dengeyi boz.
    for (let i = 20; i < 40; i += 2) {
      skewed[i] = 0.25;
      skewed[i + 1] = 0.25;
    }
    expect(occupancyCv(skewed, 8, 8, 4, SUPPORT)).toBeGreaterThan(
      occupancyCv(even, 8, 8, 4, SUPPORT),
    );
  });

  it("boş girdide tanımlı değer", () => {
    expect(occupancyCv(new Float32Array(0), 8, 8, 4, SUPPORT)).toBe(0);
    expect(occupancyCv(new Float32Array(0), 8, 8, 4)).toBe(0);
  });
});
