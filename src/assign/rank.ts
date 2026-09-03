import { morton2D } from "./morton";

const INDEX_BITS = 20; // 1.048.576 parçacığa kadar
const INDEX_SCALE = 2 ** INDEX_BITS;

/**
 * Morton kodu (32 bit) ile indeksi (20 bit) tek bir float64'e paketliyoruz:
 * 52 bit, 2^53'ün altında, kayıpsız. Sıralamayı comparator'sız
 * Float64Array.prototype.sort yapıyor.
 */
export function mortonOrder(points: Float32Array, count: number): Uint32Array {
  if (count > INDEX_SCALE) throw new Error("indeks 20 bite sığmıyor");

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

/** Sıralamayı uygulayıp yeni bir hedef dizisi üretir. */
export function reorder(points: Float32Array, order: Uint32Array): Float32Array {
  const out = new Float32Array(order.length * 2);
  for (let i = 0; i < order.length; i++) {
    const s = order[i] * 2;
    out[i * 2] = points[s];
    out[i * 2 + 1] = points[s + 1];
  }
  return out;
}
