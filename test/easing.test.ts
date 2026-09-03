import { describe, expect, it } from "vitest";
import { bowedPosition, localTime, smoothstep } from "../src/anim/easing";

describe("smoothstep", () => {
  it("sınırların dışını kelepçeliyor", () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
  });
});

describe("localTime", () => {
  it("spread = 0'da faz fark etmiyor ve klasik smoothstep'e eşit", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const base = smoothstep(0, 1, t);
      for (const phase of [0, 0.3, 1]) {
        expect(localTime(t, phase, 0)).toBeCloseTo(base, 12);
      }
    }
  });

  it("spread = 0,6'da sol taraf her t'de önde", () => {
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      expect(localTime(t, 0, 0.6)).toBeGreaterThanOrEqual(localTime(t, 1, 0.6));
    }
  });

  it("pencere kapanınca 1'e oturuyor", () => {
    expect(localTime(1, 1, 0.6)).toBe(1);
    expect(localTime(0, 0, 0.6)).toBe(0);
  });
});

describe("bowedPosition", () => {
  it("sıfır uzunluklu yer değiştirmede NaN üretmiyor", () => {
    // Aynı kelimeye geçiş: kaynak = hedef. normalize(0) NaN verirdi.
    for (const tl of [0, 0.5, 1]) {
      const p = bowedPosition(0.4, 0.7, 0.4, 0.7, tl, 0.05, 0.9);
      expect(Number.isNaN(p.x)).toBe(false);
      expect(Number.isNaN(p.y)).toBe(false);
      expect(p.x).toBeCloseTo(0.4, 6);
      expect(p.y).toBeCloseTo(0.7, 6);
    }
  });

  it("tl = 0 kaynakta, tl = 1 hedefte (yay uçlarda sıfır)", () => {
    const start = bowedPosition(0, 0, 1, 0, 0, 0.5, 0.9);
    const end = bowedPosition(0, 0, 1, 0, 1, 0.5, 0.9);
    expect(start.x).toBeCloseTo(0, 6);
    expect(start.y).toBeCloseTo(0, 6);
    expect(end.x).toBeCloseTo(1, 6);
    expect(end.y).toBeCloseTo(0, 6);
  });

  it("yay yönü hash değerinin yarısında ters dönüyor", () => {
    const left = bowedPosition(0, 0, 1, 0, 0.5, 0.5, 0.1);
    const right = bowedPosition(0, 0, 1, 0, 0.5, 0.5, 0.9);
    expect(Math.sign(left.y)).toBe(-Math.sign(right.y));
  });
});
