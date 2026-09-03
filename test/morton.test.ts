import { describe, expect, it } from "vitest";
import { morton2D, part1By1 } from "../src/assign/morton";
import { mortonOrder, reorder } from "../src/assign/rank";
import { mulberry32 } from "../src/rng";

describe("morton kodu", () => {
  it("bitleri araya sıfır koyarak yayıyor", () => {
    expect(part1By1(0b1111)).toBe(0b01010101);
    expect(part1By1(0)).toBe(0);
    expect(part1By1(0xffff)).toBe(0x55555555);
  });

  it("tek eksende monoton", () => {
    // y sabitken x arttıkça kod artmak zorunda.
    let previous = -1;
    for (let i = 0; i <= 100; i++) {
      const code = morton2D(i / 100, 0.5);
      expect(code).toBeGreaterThan(previous);
      previous = code;
    }
  });

  it("yakın noktalar yakın kod alıyor (aynı çeyrekte üst bitler ortak)", () => {
    const a = morton2D(0.2501, 0.2501);
    const b = morton2D(0.2502, 0.2502);
    expect(a >>> 20).toBe(b >>> 20);
  });

  it("köşeler: (0,0) sıfır, (1,1) 32 bitin tamamı", () => {
    expect(morton2D(0, 0)).toBe(0);
    expect(morton2D(1, 1)).toBe(0xffffffff);
  });

  it("aralık dışı girdi kelepçeleniyor", () => {
    expect(morton2D(-0.5, -2)).toBe(morton2D(0, 0));
    expect(morton2D(1.5, 3)).toBe(morton2D(1, 1));
  });
});

describe("52 bitlik anahtar", () => {
  it("kod ve indeks paketlemesi kayıpsız", () => {
    const count = 1000;
    const points = new Float32Array(count * 2);
    const rng = mulberry32(5);
    for (let i = 0; i < count * 2; i++) points[i] = rng();

    const order = mortonOrder(points, count);
    // Sıralama bir permütasyon olmak ZORUNDA: her indeks tam bir kez.
    const seen = new Uint8Array(count);
    for (const i of order) seen[i]++;
    expect(Array.from(seen).every((c) => c === 1)).toBe(true);
  });

  it("sonuç Morton koduna göre azalmayan sırada", () => {
    const count = 500;
    const points = new Float32Array(count * 2);
    const rng = mulberry32(11);
    for (let i = 0; i < count * 2; i++) points[i] = rng();

    const order = mortonOrder(points, count);
    let previous = -1;
    for (const i of order) {
      const code = morton2D(points[i * 2], points[i * 2 + 1]);
      expect(code).toBeGreaterThanOrEqual(previous);
      previous = code;
    }
  });

  it("indeks 20 bite sığmıyorsa fırlatıyor", () => {
    const count = 2 ** 20 + 1;
    expect(() => mortonOrder(new Float32Array(2), count)).toThrow(/20 bite/);
  });

  it("reorder sıralamayı gerçekten uyguluyor", () => {
    const points = new Float32Array([0, 0, 1, 1, 2, 2]);
    const out = reorder(points, new Uint32Array([2, 0, 1]));
    expect(Array.from(out)).toEqual([2, 2, 0, 0, 1, 1]);
  });
});
