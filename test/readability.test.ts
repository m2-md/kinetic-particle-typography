import { describe, expect, it } from "vitest";
import { iou, maskFromRaster, splat } from "../src/measure/readability";
import { solidBox } from "../src/raster/syntheticRaster";

describe("maske ve IoU", () => {
  it("özdeş maskede 1, ayrık maskede 0", () => {
    const left = maskFromRaster(solidBox(32, 8, 0, 0, 16, 8, 255, 0), 128, 4);
    const right = maskFromRaster(solidBox(32, 8, 16, 0, 16, 8, 255, 0), 128, 4);

    expect(iou(left, left, 0, 1)).toBe(1);
    expect(iou(left, right, 0, 1)).toBe(0);
  });

  it("bant sınırları doğru kesiyor", () => {
    const left = maskFromRaster(solidBox(32, 8, 0, 0, 16, 8, 255, 0), 128, 4);
    const right = maskFromRaster(solidBox(32, 8, 16, 0, 16, 8, 255, 0), 128, 4);

    // Sol yarıda `left` dolu, `right` boş → kesişim 0 ama birleşim de sol kadar.
    expect(iou(left, right, 0, 0.5)).toBe(0);
    // Sol maskeyi kendisiyle sağ bantta karşılaştırınca birleşim boş → 0.
    expect(iou(left, left, 0.5, 1)).toBe(0);
    // Sağ bantta `right` kendisiyle tam örtüşüyor.
    expect(iou(right, right, 0.5, 1)).toBe(1);
  });

  it("splat ızgara dışına taşan noktayı kelepçeliyor", () => {
    const points = new Float32Array([-5, -5, 5, 5, 0.5, 0.5]);
    const mask = splat(points, 32, 16, 4);
    expect(mask.cols).toBe(8);
    expect(mask.rows).toBe(4);
    // Sol üst, sağ alt ve merkez hücreleri işaretlenmiş; taşma atılmamış.
    expect(mask.bits[0]).toBe(1);
    expect(mask.bits[mask.bits.length - 1]).toBe(1);
    let filled = 0;
    for (const b of mask.bits) filled += b;
    expect(filled).toBe(3);
  });

  it("boyutu uyuşmayan maskeler hata veriyor", () => {
    const a = splat(new Float32Array([0.5, 0.5]), 32, 16, 4);
    const b = splat(new Float32Array([0.5, 0.5]), 32, 16, 8);
    expect(() => iou(a, b, 0, 1)).toThrow(/uyuşmuyor/);
  });
});
