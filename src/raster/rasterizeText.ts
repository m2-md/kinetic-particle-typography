import type { AlphaRaster } from "./alphaRaster";

export interface RasterOptions {
  readonly fontFamily: string;
  readonly fontSize: number; // px
  readonly padding: number; // px
}

export interface TextBox {
  readonly width: number;
  readonly height: number;
  readonly baseline: number;
  readonly ascent: number;
  readonly descent: number;
}

let scratch: CanvasRenderingContext2D | null = null;

/** Tek seferlik 1×1 ölçüm canvas'ı. Piksel okunmuyor, `willReadFrequently` gereksiz. */
export function scratchContext(): CanvasRenderingContext2D {
  if (scratch) return scratch;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context alınamadı");
  scratch = ctx;
  return ctx;
}

/**
 * BÜTÜN kelimeler için TEK kutu. En geniş genişlik ve en yüksek çıkıntı kazanır;
 * yoksa kutuyu ilk kelimeye göre kuran kod sonraki kelimelerin şapkasını kırpar.
 */
export function measureBox(words: readonly string[], o: RasterOptions): TextBox {
  const ctx = scratchContext();
  ctx.font = `${o.fontSize}px ${o.fontFamily}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";

  let ink = 0;
  let ascent = 0;
  let descent = 0;

  for (const word of words) {
    const m = ctx.measureText(word);
    // actualBoundingBoxLeft sola doğru POZİTİF ölçülüyor; toplamı mürekkep genişliği.
    ink = Math.max(ink, m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
    ascent = Math.max(ascent, m.actualBoundingBoxAscent);
    descent = Math.max(descent, m.actualBoundingBoxDescent);
  }

  return {
    width: Math.ceil(ink) + o.padding * 2,
    height: Math.ceil(ascent + descent) + o.padding * 2,
    baseline: Math.ceil(ascent) + o.padding,
    ascent,
    descent,
  };
}

export function rasterizeText(text: string, box: TextBox, o: RasterOptions): AlphaRaster {
  const canvas = document.createElement("canvas");
  canvas.width = box.width;
  canvas.height = box.height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d context alınamadı");

  ctx.clearRect(0, 0, box.width, box.height);
  ctx.font = `${o.fontSize}px ${o.fontFamily}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff"; // renk önemsiz: yalnızca alfayı okuyacağız
  ctx.fillText(text, box.width / 2, box.baseline);

  const rgba = ctx.getImageData(0, 0, box.width, box.height).data;
  const data = new Uint8Array(box.width * box.height);
  for (let i = 0, p = 3; i < data.length; i++, p += 4) data[i] = rgba[p];

  return { width: box.width, height: box.height, data };
}

/* ------------------------------------------------------------------ */
/* Aşağısı yalnızca ölçüm için. `rasterizeText`in adımlarını ayırıyor:  */
/* fillText / getImageData / alfa taraması ayrı ayrı saatlensin diye.   */
/* ------------------------------------------------------------------ */

export interface WordMetrics {
  readonly word: string;
  readonly ascent: number;
  readonly descent: number;
  readonly inkWidth: number;
}

/** Kelime kelime mürekkep metrikleri + fonta ait sabit ascent. */
export function measureWords(
  words: readonly string[],
  o: RasterOptions,
): { words: WordMetrics[]; fontAscent: number; fontDescent: number } {
  const ctx = scratchContext();
  ctx.font = `${o.fontSize}px ${o.fontFamily}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";

  const out: WordMetrics[] = [];
  let fontAscent = 0;
  let fontDescent = 0;

  for (const word of words) {
    const m = ctx.measureText(word);
    fontAscent = m.fontBoundingBoxAscent;
    fontDescent = m.fontBoundingBoxDescent;
    out.push({
      word,
      ascent: m.actualBoundingBoxAscent,
      descent: m.actualBoundingBoxDescent,
      inkWidth: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
    });
  }

  return { words: out, fontAscent, fontDescent };
}

/** Metni boş bir canvas'a çizip context'i döndürür; piksel OKUMAZ. */
export function drawTextToCanvas(
  text: string,
  box: TextBox,
  o: RasterOptions,
  willReadFrequently: boolean,
): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = box.width;
  canvas.height = box.height;

  const ctx = canvas.getContext("2d", { willReadFrequently });
  if (!ctx) throw new Error("2d context alınamadı");

  ctx.clearRect(0, 0, box.width, box.height);
  ctx.font = `${o.fontSize}px ${o.fontFamily}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.fillText(text, box.width / 2, box.baseline);
  return ctx;
}

/** RGBA dizisinden yalnızca alfa kanalını çeker. Dört baytta bir okuma. */
export function alphaFromRgba(rgba: Uint8ClampedArray, width: number, height: number): AlphaRaster {
  const data = new Uint8Array(width * height);
  for (let i = 0, p = 3; i < data.length; i++, p += 4) data[i] = rgba[p];
  return { width, height, data };
}
