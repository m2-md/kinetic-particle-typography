import { maskDims, type Mask } from "./readability";

/**
 * Izgara doluluğunun değişim katsayısı (std / ortalama).
 * Düşük değer = parçacıklar hücrelere düzgün dağılmış.
 *
 * `support` verilirse yalnızca o hücreler sayılır — harfin kapsadığı alan.
 * Verilmezse en az bir parçacık alan hücreler sayılır. Kümelenmeyi ölçerken
 * doğru payda harf silüeti: boş kalan hücreleri paydadan atarsanız rastgele
 * çekiş haksız yere iyi görünür.
 */
export function occupancyCv(
  points: Float32Array,
  width: number,
  height: number,
  cell = 8,
  support?: Mask,
): number {
  const { cols, rows } = maskDims(width, height, cell);
  const counts = new Int32Array(cols * rows);

  const n = points.length / 2;
  for (let i = 0; i < n; i++) {
    const cx = Math.min(cols - 1, Math.max(0, ((points[i * 2] * width) / cell) | 0));
    const cy = Math.min(rows - 1, Math.max(0, ((points[i * 2 + 1] * height) / cell) | 0));
    counts[cy * cols + cx]++;
  }

  if (support && (support.cols !== cols || support.rows !== rows)) {
    throw new Error("support maskesi ızgarayla uyuşmuyor");
  }

  let used = 0;
  let sum = 0;
  for (let i = 0; i < counts.length; i++) {
    const inside = support ? support.bits[i] === 1 : counts[i] > 0;
    if (!inside) continue;
    used++;
    sum += counts[i];
  }
  if (used === 0) return 0;

  const mean = sum / used;
  if (mean === 0) return 0;

  let variance = 0;
  for (let i = 0; i < counts.length; i++) {
    const inside = support ? support.bits[i] === 1 : counts[i] > 0;
    if (!inside) continue;
    const d = counts[i] - mean;
    variance += d * d;
  }
  variance /= used;

  return Math.sqrt(variance) / mean;
}
