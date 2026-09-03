/**
 * Shader'daki `hash01(uint)` fonksiyonunun BİREBİR TS ikizi.
 * `Math.imul` 32 bit taşmayı GLSL'in `uint` çarpımıyla aynı şekilde yapıyor,
 * `>>> 0` her adımda işareti temizliyor.
 */
export function hash01(i: number): number {
  let h = Math.imul(i, 2654435761) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return (h >>> 8) / 16777216;
}
