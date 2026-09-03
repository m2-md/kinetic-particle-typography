import { mortonOrder } from "./rank";

export type PairingMode = "morton" | "identity" | "byX" | "shuffled";

export const PAIRING_MODES: readonly PairingMode[] = ["morton", "identity", "byX", "shuffled"];

const INDEX_BITS = 20;
const INDEX_SCALE = 2 ** INDEX_BITS;

/** Örnekleyici hangi sırayla ürettiyse o sıra. Hiçbir şey yapmıyor, bilerek. */
export function orderIdentity(count: number): Uint32Array {
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = i;
  return order;
}

/**
 * Yatay konuma göre sıralama. Morton ile AYNI tekniği kullanıyor —
 * anahtar (32 bit kuantize x) ile indeksi (20 bit) tek bir float64'e paketleyip
 * comparator'sız `sort()`. İki satırın ms farkı gerçekten sıralama ölçütünün
 * farkı olsun diye; comparator'lı bir sürümle kıyaslamak haksızlık olurdu.
 */
export function orderByX(points: Float32Array, count: number): Uint32Array {
  if (count > INDEX_SCALE) throw new Error("indeks 20 bite sığmıyor");

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

/** Fisher-Yates. İzdihamın kendisi; ölçümde alt sınır olarak duruyor. */
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

/** Z-eğrisi sırası: iki boyut tek bir sıraya iniyor. */
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
