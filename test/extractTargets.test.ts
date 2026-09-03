import { describe, expect, it } from "vitest";
import { buildCoverageIndex, sampleTargets } from "../src/raster/extractTargets";
import { solidBox } from "../src/raster/syntheticRaster";
import { mulberry32 } from "../src/rng";

describe("kapsama dizini", () => {
  it("eşiğin altındaki pikselleri hiç almıyor", () => {
    // 8x8, ortadaki 4x4 alan 200, gerisi 20.
    const raster = solidBox(8, 8, 2, 2, 4, 4, 200, 20);
    const index = buildCoverageIndex(raster, 128);
    expect(index.pixels.length).toBe(16);
  });

  it("prefix kesinlikle artıyor ve toplamla bitiyor", () => {
    const raster = solidBox(16, 16, 3, 3, 8, 8, 255, 0);
    const index = buildCoverageIndex(raster, 1);
    for (let i = 1; i < index.prefix.length; i++) {
      expect(index.prefix[i]).toBeGreaterThan(index.prefix[i - 1]);
    }
    expect(index.prefix[index.prefix.length - 1]).toBeCloseTo(index.total, 10);
  });

  it("eşiğin TAM sınırındaki piksel dâhil (>= karşılaştırması)", () => {
    const raster = solidBox(4, 4, 1, 1, 2, 2, 64, 63);
    expect(buildCoverageIndex(raster, 64).pixels.length).toBe(4);
    // 63 de dâhil olsaydı bütün piksel alanı girerdi.
    expect(buildCoverageIndex(raster, 63).pixels.length).toBe(16);
  });

  it("kapsama ağırlık taşıyor: alfa 128 olan piksel 255'in yarısı kadar oy kullanıyor", () => {
    // Sol yarı 255, sağ yarı 128; eşik 64 ikisini de alıyor.
    const raster = solidBox(8, 4, 0, 0, 4, 4, 255, 128);
    const index = buildCoverageIndex(raster, 64);
    expect(index.pixels.length).toBe(32);
    // 16 piksel × 1,0 + 16 piksel × (128/255)
    expect(index.total).toBeCloseTo(16 + (16 * 128) / 255, 10);

    const points = sampleTargets(raster, index, 20_000, mulberry32(4));
    let left = 0;
    for (let i = 0; i < 20_000; i++) if (points[i * 2] < 0.5) left++;
    // Sol yarının payı 16 / (16 + 8,03) ≈ 0,666
    expect(left / 20_000).toBeCloseTo(16 / (16 + (16 * 128) / 255), 2);
  });
});

describe("katmanlı örnekleme", () => {
  it("her zaman tam olarak count hedef üretiyor", () => {
    const raster = solidBox(32, 32, 8, 8, 4, 4, 255, 0);
    const index = buildCoverageIndex(raster, 128);
    for (const n of [1, 7, 1000]) {
      expect(sampleTargets(raster, index, n, mulberry32(1)).length).toBe(n * 2);
    }
  });

  it("üretilen her nokta eşiği geçen bir pikselin içinde", () => {
    const raster = solidBox(32, 32, 8, 8, 6, 6, 255, 0);
    const index = buildCoverageIndex(raster, 128);
    const pts = sampleTargets(raster, index, 500, mulberry32(3));

    for (let i = 0; i < 500; i++) {
      const px = Math.floor(pts[i * 2] * 32);
      const py = Math.floor(pts[i * 2 + 1] * 32);
      expect(px).toBeGreaterThanOrEqual(8);
      expect(px).toBeLessThan(14);
      expect(py).toBeGreaterThanOrEqual(8);
      expect(py).toBeLessThan(14);
    }
  });

  it("aynı tohum bit-birebir aynı bulutu veriyor", () => {
    const raster = solidBox(32, 32, 4, 4, 10, 10, 255, 0);
    const index = buildCoverageIndex(raster, 128);
    const a = sampleTargets(raster, index, 2000, mulberry32(9));
    const b = sampleTargets(raster, index, 2000, mulberry32(9));
    expect(a).toEqual(b);
  });

  it("hiçbir piksel eşiği geçmezse count*2 uzunlukta sıfır dizi", () => {
    const raster = solidBox(8, 8, 2, 2, 4, 4, 10, 0);
    const index = buildCoverageIndex(raster, 128);
    expect(index.pixels.length).toBe(0);
    const pts = sampleTargets(raster, index, 50, mulberry32(1));
    expect(pts.length).toBe(100);
    expect(Array.from(pts).every((v) => v === 0)).toBe(true);
  });
});
