import { describe, expect, it } from "vitest";
import { solidBox, syntheticWord } from "../src/raster/syntheticRaster";

describe("solidBox", () => {
  it("boyut ve dolu piksel sayısı tam", () => {
    const raster = solidBox(10, 6, 2, 1, 4, 3, 255, 0);
    expect(raster.width).toBe(10);
    expect(raster.height).toBe(6);
    expect(raster.data.length).toBe(60);
    let filled = 0;
    for (const v of raster.data) if (v === 255) filled++;
    expect(filled).toBe(12);
  });

  it("kenardan taşan kutu kırpılıyor, hata vermiyor", () => {
    const raster = solidBox(8, 8, 6, 6, 8, 8, 200, 0);
    let filled = 0;
    for (const v of raster.data) if (v === 200) filled++;
    expect(filled).toBe(4);
  });
});

describe("syntheticWord", () => {
  it("aynı tohum bit-birebir aynı raster", () => {
    const a = syntheticWord(64, 32, 3);
    const b = syntheticWord(64, 32, 3);
    expect(b.data).toEqual(a.data);
  });

  it("farklı tohum farklı raster", () => {
    const a = syntheticWord(64, 32, 3);
    const b = syntheticWord(64, 32, 4);
    expect(b.data).not.toEqual(a.data);
  });

  it("kenar yumuşatması var: 0 ile 255 arasında ara değerler bulunuyor", () => {
    const raster = syntheticWord(128, 48, 1);
    let partial = 0;
    let full = 0;
    for (const v of raster.data) {
      if (v > 0 && v < 255) partial++;
      if (v === 255) full++;
    }
    expect(full).toBeGreaterThan(0);
    expect(partial).toBeGreaterThan(0);
  });

  it("eşik yükseldikçe kapsanan piksel sayısı azalıyor", () => {
    const raster = syntheticWord(128, 48, 2);
    const counts = [8, 32, 64, 128, 200].map((t) => {
      let n = 0;
      for (const v of raster.data) if (v >= t) n++;
      return n;
    });
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
    expect(counts[counts.length - 1]).toBeLessThan(counts[0]);
  });
});
