import { mortonOrder } from "./rank";

export type PairingMode = "morton" | "identity" | "byX" | "shuffled";

export const PAIRING_MODES: readonly PairingMode[] = ["morton", "identity", "byX", "shuffled"];

const INDEX_BITS = 20;
const INDEX_SCALE = 2 ** INDEX_BITS;

/** Whatever order the sampler emitted. Does nothing, on purpose. */
export function orderIdentity(count: number): Uint32Array {
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = i;
  return order;
}

/**
 * Sort by horizontal position. Uses the SAME technique as Morton — pack the key
 * (32-bit quantized x) and the index (20 bit) into one float64, then `sort()`
 * without a comparator. So that the ms gap between the two rows really is the
 * gap between sort criteria; comparing against a comparator version would be unfair.
 */
export function orderByX(points: Float32Array, count: number): Uint32Array {
  if (count > INDEX_SCALE) throw new Error("index does not fit in 20 bits");

  const keys = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const qx = Math.min(0xffffffff, Math.max(0, Math.round(points[i * 2] * 0xffffffff)));
    keys[i] = qx * INDEX_SCALE + i;
  }
  keys.sort();

  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = keys[i] % INDEX_SCALE;
  return order;
}

/** Fisher-Yates. The stampede itself; it stands as the lower bound in the measurement. */
export function orderShuffled(count: number, rng: () => number): Uint32Array {
  const order = orderIdentity(count);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order;
}

/** Z-curve order: two dimensions collapse into a single sequence. */
export function orderMorton(points: Float32Array, count: number): Uint32Array {
  return mortonOrder(points, count);
}

export function orderFor(
  mode: PairingMode,
  points: Float32Array,
  count: number,
  rng: () => number,
): Uint32Array {
  switch (mode) {
    case "morton":
      return orderMorton(points, count);
    case "byX":
      return orderByX(points, count);
    case "shuffled":
      return orderShuffled(count, rng);
    case "identity":
      return orderIdentity(count);
  }
}
