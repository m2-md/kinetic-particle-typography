/** Spreads the bits of a 16-bit number, interleaving a zero between each. */
export function part1By1(n: number): number {
  let x = n & 0xffff;
  x = (x | (x << 8)) & 0x00ff00ff;
  x = (x | (x << 4)) & 0x0f0f0f0f;
  x = (x | (x << 2)) & 0x33333333;
  x = (x | (x << 1)) & 0x55555555;
  return x >>> 0;
}

/** x, y ∈ [0,1] → 32-bit Morton (Z-curve) code. */
export function morton2D(x: number, y: number): number {
  const qx = Math.min(0xffff, Math.max(0, Math.round(x * 0xffff)));
  const qy = Math.min(0xffff, Math.max(0, Math.round(y * 0xffff)));
  return ((part1By1(qy) << 1) | part1By1(qx)) >>> 0;
}
