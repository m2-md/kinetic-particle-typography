import { morton2D } from "./morton";

const INDEX_BITS = 20; // up to 1,048,576 particles
const INDEX_SCALE = 2 ** INDEX_BITS;

/**
 * We pack the Morton code (32 bit) and the index (20 bit) into one float64:
 * 52 bits, below 2^53, lossless. The sorting is done by
 * Float64Array.prototype.sort without a comparator.
 */
export function mortonOrder(points: Float32Array, count: number): Uint32Array {
  if (count > INDEX_SCALE) throw new Error("index does not fit in 20 bits");

  const keys = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const code = morton2D(points[i * 2], points[i * 2 + 1]);
    keys[i] = code * INDEX_SCALE + i;
  }
  keys.sort();

  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = keys[i] % INDEX_SCALE;
  return order;
}

/** Applies the ordering and produces a new target array. */
export function reorder(points: Float32Array, order: Uint32Array): Float32Array {
  const out = new Float32Array(order.length * 2);
  for (let i = 0; i < order.length; i++) {
    const s = order[i] * 2;
    out[i * 2] = points[s];
    out[i * 2 + 1] = points[s + 1];
  }
  return out;
}
