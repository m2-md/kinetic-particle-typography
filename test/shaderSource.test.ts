import { describe, expect, it } from "vitest";
import { withDefines } from "../src/gl/program";
import { FRAGMENT_SRC, VERTEX_SRC } from "../src/gl/shaders";

describe("withDefines", () => {
  it("does not break the #version line", () => {
    const out = withDefines(VERTEX_SRC, ["POINTS"]);
    expect(out.split("\n")[0]).toBe("#version 300 es");
  });

  it("the defines start from the second line", () => {
    const out = withDefines(VERTEX_SRC, ["POINTS", "DEBUG"]);
    const lines = out.split("\n");
    expect(lines[1]).toBe("#define POINTS");
    expect(lines[2]).toBe("#define DEBUG");
  });

  it("an empty define list leaves the source untouched", () => {
    expect(withDefines(FRAGMENT_SRC, [])).toBe(FRAGMENT_SRC);
  });
});

describe("shader source", () => {
  it("the zero-length clamp is still there (NaN regression)", () => {
    expect(VERTEX_SRC).toContain("max(length(d), 1e-6)");
    expect(VERTEX_SRC).not.toContain("normalize(");
  });

  it("the hash is NOT sin()-based but an integer mix", () => {
    expect(VERTEX_SRC).toContain("2654435761u");
    expect(VERTEX_SRC).toContain("2246822519u");
    // sin appears only in the bow amplitude; it must not appear in the hash.
    expect(VERTEX_SRC).not.toContain("fract(sin(");
    expect(VERTEX_SRC).not.toContain("43758.5453");
  });

  it("both shaders are GLSL ES 3.00 at the same precision (varying match)", () => {
    for (const src of [VERTEX_SRC, FRAGMENT_SRC]) {
      expect(src.split("\n")[0]).toBe("#version 300 es");
      // In ESSL3 the precision of the varyings has to be the SAME in both stages.
      expect(src).toContain("precision highp float;");
    }
  });

  it("the POINTS and quad paths live in one source", () => {
    expect(VERTEX_SRC).toContain("#ifdef POINTS");
    expect(VERTEX_SRC).toContain("gl_InstanceID");
    expect(VERTEX_SRC).toContain("gl_PointSize");
    expect(FRAGMENT_SRC).toContain("gl_PointCoord");
  });
});
