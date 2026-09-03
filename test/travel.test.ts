import { describe, expect, it } from "vitest";
import { meanTravel } from "../src/assign/travel";

describe("meanTravel", () => {
  it("özdeş bulutlarda sıfır", () => {
    const a = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
    expect(meanTravel(a, a)).toBe(0);
  });

  it("sabit kaydırmada tam kaydırma miktarı", () => {
    const a = new Float32Array([0, 0, 1, 1, 0.5, 0.5]);
    const b = new Float32Array([3, 4, 4, 5, 3.5, 4.5]);
    // Her nokta (3,4) kadar kaymış → uzunluk 5.
    expect(meanTravel(a, b)).toBeCloseTo(5, 6);
  });

  it("tek noktalı bulut", () => {
    expect(meanTravel(new Float32Array([0, 0]), new Float32Array([0, 2]))).toBeCloseTo(2, 6);
  });
});
