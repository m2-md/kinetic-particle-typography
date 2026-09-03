export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** A particle's own clock. spread must stay < 1, otherwise the window has zero width. */
export function localTime(t: number, phase: number, spread: number): number {
  const start = phase * spread;
  return smoothstep(start, start + (1 - spread), t);
}

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * CPU twin of the bow math in the vertex shader. On a zero-length displacement
 * `normalize` yields NaN; the divisor is clamped with `max(len, 1e-6)` — the exact
 * same line as in the shader. The readability measurement runs through this function.
 */
export function bowedPosition(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  tl: number,
  bowAmount: number,
  r: number,
): Vec2 {
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.max(Math.sqrt(dx * dx + dy * dy), 1e-6);
  const nx = -dy / len;
  const ny = dx / len;
  const side = r < 0.5 ? -1 : 1;
  const bow = Math.sin(tl * Math.PI) * bowAmount * (0.35 + r) * side;
  return { x: sx + dx * tl + nx * bow, y: sy + dy * tl + ny * bow };
}
