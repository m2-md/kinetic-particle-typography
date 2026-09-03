/**
 * EXACT TS twin of the shader's `hash01(uint)`.
 * `Math.imul` wraps at 32 bits the same way GLSL's `uint` multiply does,
 * and `>>> 0` clears the sign bit at every step.
 */
export function hash01(i: number): number {
  let h = Math.imul(i, 2654435761) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return (h >>> 8) / 16777216;
}
