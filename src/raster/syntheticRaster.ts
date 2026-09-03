import { mulberry32 } from "../rng";
import type { AlphaRaster } from "./alphaRaster";

/**
 * Raster generators that need NO canvas. The tests and `npm run bench` use them:
 * in headless vitest there is no `document` and no `fillText`.
 */

/** Hard-edged rectangle. So that the covered pixel count can be counted by hand. */
export function solidBox(
  width: number,
  height: number,
  x: number,
  y: number,
  boxWidth: number,
  boxHeight: number,
  inside: number,
  outside: number,
): AlphaRaster {
  const data = new Uint8Array(width * height);
  data.fill(outside);
  for (let j = y; j < y + boxHeight; j++) {
    if (j < 0 || j >= height) continue;
    for (let i = x; i < x + boxWidth; i++) {
      if (i < 0 || i >= width) continue;
      data[j * width + i] = inside;
    }
  }
  return { width, height, data };
}

interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

interface Disk {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

/** Intersection AREA of an axis-aligned rectangle with one pixel — exact value. */
function rectCoverage(px: number, py: number, r: Rect): number {
  const ox = Math.min(px + 1, r.x1) - Math.max(px, r.x0);
  if (ox <= 0) return 0;
  const oy = Math.min(py + 1, r.y1) - Math.max(py, r.y0);
  if (oy <= 0) return 0;
  return Math.min(1, ox) * Math.min(1, oy);
}

/** A one-pixel-wide linear ramp for the disk — a cheap imitation of antialiasing. */
function diskCoverage(px: number, py: number, d: Disk): number {
  const dx = px + 0.5 - d.cx;
  const dy = py + 0.5 - d.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.min(1, Math.max(0, d.r + 0.5 - dist));
}

/**
 * A procedural "word": five letter slots, each with two vertical bars plus one
 * horizontal bar, some of them also carrying a diacritic disk. The edges are
 * antialiased analytically, so the alpha ramp is continuous over 0–255 like a real raster.
 */
export function syntheticWord(width: number, height: number, seed: number): AlphaRaster {
  const rng = mulberry32(seed);
  const rects: Rect[] = [];
  const disks: Disk[] = [];

  const letters = 5;
  const slot = width / letters;
  const top = height * 0.18;
  const bottom = height * 0.86;
  const stroke = Math.max(3, height * 0.11);

  for (let i = 0; i < letters; i++) {
    const cx = slot * (i + 0.5);
    const halfWidth = slot * (0.24 + rng() * 0.08);
    const y0 = top + rng() * height * 0.05;

    rects.push({ x0: cx - halfWidth, y0, x1: cx - halfWidth + stroke, y1: bottom });
    rects.push({ x0: cx + halfWidth - stroke, y0, x1: cx + halfWidth, y1: bottom });

    const barY = y0 + (bottom - y0) * (0.35 + rng() * 0.3);
    rects.push({ x0: cx - halfWidth, y0: barY, x1: cx + halfWidth, y1: barY + stroke });

    // Diacritic: thin, above the body, the structure most sensitive to the threshold.
    if (rng() < 0.5) {
      disks.push({ cx, cy: y0 - height * 0.07, r: stroke * 0.42 });
    }
  }

  const data = new Uint8Array(width * height);
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      let cov = 0;
      for (const r of rects) {
        const c = rectCoverage(px, py, r);
        if (c > cov) cov = c;
        if (cov >= 1) break;
      }
      if (cov < 1) {
        for (const d of disks) {
          const c = diskCoverage(px, py, d);
          if (c > cov) cov = c;
          if (cov >= 1) break;
        }
      }
      data[py * width + px] = Math.round(cov * 255);
    }
  }

  return { width, height, data };
}
