import { describe, expect, it } from "vitest";
import { withDefines } from "../src/gl/program";
import { FRAGMENT_SRC, VERTEX_SRC } from "../src/gl/shaders";

describe("withDefines", () => {
  it("#version satırını bozmuyor", () => {
    const out = withDefines(VERTEX_SRC, ["POINTS"]);
    expect(out.split("\n")[0]).toBe("#version 300 es");
  });

  it("define'lar ikinci satırdan başlıyor", () => {
    const out = withDefines(VERTEX_SRC, ["POINTS", "DEBUG"]);
    const lines = out.split("\n");
    expect(lines[1]).toBe("#define POINTS");
    expect(lines[2]).toBe("#define DEBUG");
  });

  it("boş define listesinde kaynak değişmiyor", () => {
    expect(withDefines(FRAGMENT_SRC, [])).toBe(FRAGMENT_SRC);
  });
});

describe("shader kaynağı", () => {
  it("sıfır uzunluk kelepçesi duruyor (NaN regresyonu)", () => {
    expect(VERTEX_SRC).toContain("max(length(d), 1e-6)");
    expect(VERTEX_SRC).not.toContain("normalize(");
  });

  it("hash sin() tabanlı DEĞİL, tamsayı karıştırması", () => {
    expect(VERTEX_SRC).toContain("2654435761u");
    expect(VERTEX_SRC).toContain("2246822519u");
    // sin yalnızca yay genliğinde geçiyor; hash'te geçmemeli.
    expect(VERTEX_SRC).not.toContain("fract(sin(");
    expect(VERTEX_SRC).not.toContain("43758.5453");
  });

  it("iki shader da GLSL ES 3.00 ve aynı hassasiyette (varying eşleşmesi)", () => {
    for (const src of [VERTEX_SRC, FRAGMENT_SRC]) {
      expect(src.split("\n")[0]).toBe("#version 300 es");
      // ESSL3'te varying'lerin hassasiyeti iki aşamada AYNI olmak zorunda.
      expect(src).toContain("precision highp float;");
    }
  });

  it("POINTS ve dörtgen yolları tek kaynakta", () => {
    expect(VERTEX_SRC).toContain("#ifdef POINTS");
    expect(VERTEX_SRC).toContain("gl_InstanceID");
    expect(VERTEX_SRC).toContain("gl_PointSize");
    expect(FRAGMENT_SRC).toContain("gl_PointCoord");
  });
});
