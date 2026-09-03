/**
 * One source, two programs. If `POINTS` is defined the `gl_PointSize` path is
 * compiled, otherwise the instanced quad path. The defines are injected from the
 * second line on by `withDefines` — `#version` MUST be the first line.
 */
export const VERTEX_SRC = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aCorner; // template quad; absent on the POINTS path
layout(location = 1) in vec2 aSource; // [0,1] raster space
layout(location = 2) in vec2 aTarget;

uniform vec2 uAspect;     // scale carrying the raster ratio into clip space
uniform vec2 uViewportPx;
uniform float uRadiusPx;
uniform float uT;         // 0 → 1
uniform float uSpread;    // 0 ≤ spread < 1
uniform float uBow;

out vec2 vLocal;
out float vGlow;

const float PI = 3.14159265359;

float localTime(float t, float phase, float spread) {
  float start = phase * spread;
  return smoothstep(start, start + (1.0 - spread), t);
}

/**
 * Integer hash. A sin()-based hash gives different results from driver to driver;
 * integer ops are bit-identical everywhere.
 */
float hash01(uint i) {
  uint h = i * 2654435761u;
  h ^= h >> 15;
  h *= 2246822519u;
  h ^= h >> 13;
  return float(h >> 8) * (1.0 / 16777216.0);
}

void main() {
  float tl = localTime(uT, aTarget.x, uSpread);

  vec2 d = aTarget - aSource;
  // normalize on a zero length yields NaN; the divisor is clamped.
  vec2 normal = vec2(-d.y, d.x) / max(length(d), 1e-6);

#ifdef POINTS
  uint id = uint(gl_VertexID);
#else
  uint id = uint(gl_InstanceID);
#endif

  float r = hash01(id);
  float side = r < 0.5 ? -1.0 : 1.0;
  float bow = sin(tl * PI) * uBow * (0.35 + r) * side;

  vec2 p = mix(aSource, aTarget, tl) + normal * bow;

  // Raster space (y down) → clip space (y up)
  vec2 clip = (p * 2.0 - 1.0) * vec2(1.0, -1.0) * uAspect;

  vGlow = 0.35 + 0.65 * (1.0 - abs(tl * 2.0 - 1.0));

#ifdef POINTS
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = uRadiusPx * 2.0;
  vLocal = vec2(0.0);
#else
  vec2 offset = aCorner * uRadiusPx / uViewportPx * 2.0;
  gl_Position = vec4(clip + offset, 0.0, 1.0);
  vLocal = aCorner;
#endif
}
`;

export const FRAGMENT_SRC = `#version 300 es
precision highp float;

in vec2 vLocal;
in float vGlow;

uniform vec3 uColor;
out vec4 fragColor;

void main() {
#ifdef POINTS
  // gl_PointCoord's origin is TOP LEFT (y down). The radial falloff is symmetric
  // so it makes no difference here; with a textured sprite it would.
  vec2 local = gl_PointCoord * 2.0 - 1.0;
#else
  vec2 local = vLocal;
#endif

  float d = dot(local, local); // squared distance to the center
  if (d > 1.0) discard;

  float falloff = 1.0 - d;
  fragColor = vec4(uColor * vGlow * falloff * falloff, 1.0);
}
`;

/**
 * Tiny program for the shader/CPU parity measurement: writes every particle's
 * `localTime` value into a 1×N RGBA32F target. Compared against the TS twin.
 */
export const PARITY_VERTEX_SRC = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aCorner;
out vec2 vUv;

void main() {
  vUv = aCorner * 0.5 + 0.5;
  gl_Position = vec4(aCorner, 0.0, 1.0);
}
`;

export const PARITY_FRAGMENT_SRC = `#version 300 es
precision highp float;

in vec2 vUv;
uniform float uT;
uniform float uSpread;
uniform float uCount;
out vec4 fragColor;

float localTime(float t, float phase, float spread) {
  float start = phase * spread;
  return smoothstep(start, start + (1.0 - spread), t);
}

void main() {
  // Phase from the column center: i / (count - 1)
  float i = floor(gl_FragCoord.x);
  float phase = i / max(uCount - 1.0, 1.0);
  fragColor = vec4(localTime(uT, phase, uSpread), phase, 0.0, 1.0);
}
`;
