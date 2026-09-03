import { BOW, CONTROL_WORD, FONT_SIZE, WORDS, type App } from "../app";
import { hash01 } from "../anim/hash";
import { bowedPosition, localTime } from "../anim/easing";
import { orderByX, orderIdentity, orderMorton, orderShuffled } from "../assign/pairing";
import { reorder } from "../assign/rank";
import { meanTravel } from "../assign/travel";
import type { AlphaRaster } from "../raster/alphaRaster";
import { buildCoverageIndex, sampleTargets } from "../raster/extractTargets";
import { sampleTargetsBinary } from "../raster/sampleTargetsBinary";
import { sampleTargetsNoJitter } from "../raster/sampleTargetsNoJitter";
import { sampleTargetsRandom } from "../raster/sampleTargetsRandom";
import { drawTextToCanvas, measureWords } from "../raster/rasterizeText";
import { probeEdgeRgb } from "../raster/rgbProbe";
import type { LoadedFont } from "../raster/loadFont";
import { mulberry32 } from "../rng";
import { median, percentile, round } from "../stats";
import { occupancyCv } from "./occupancy";
import { iou, maskFromRaster, splat } from "./readability";
import { measureShaderParity } from "./shaderParity";

export const MEASURE_WIDTH = 960;
export const MEASURE_HEIGHT = 540;
export const MEASURE_WARMUP = 60;
export const MEASURE_FRAMES = 180;
export const COUNTS: readonly number[] = [25_000, 100_000, 250_000];
export const THRESHOLDS: readonly number[] = [8, 32, 64, 128, 200];
export const TIMING_RUNS = 3;
export const READABILITY_CELL = 4;
export const OCCUPANCY_CELL = 8;
const MAIN_COUNT = 100_000;
const MAIN_THRESHOLD = 32;

export interface TimingEntry {
  median: number;
  p95: number;
}

export interface MeasureReport {
  font: string;
  fontFallback: boolean;
  fontSize: number;
  gpu: string;
  backing: { width: number; height: number };
  warmup: number;
  frames: number;
  load: number;
  gpuTimer: boolean;
  pointSizeRange: [number, number];
  colorBufferFloat: boolean;
  box: {
    width: number;
    height: number;
    baseline: number;
    fontAscent: number;
    words: { word: string; ascent: number; descent: number; inkWidth: number }[];
  };
  rgb: { maxDeviation: number; edgePixels: number };
  readFrequently: { onMs: number; offMs: number };
  threshold: { t: number; withBreve: number; withoutBreve: number; delta: number }[];
  extract: {
    word: string;
    getImageDataMs: number;
    scanMs: number;
    sampleMs: number;
    sortMs: number;
    totalMs: number;
    covered: number;
  }[];
  sampling: { count: number; walkMs: number; binaryMs: number }[];
  occupancy: { cell: number; random: number; stratified: number; stratifiedJitter: number };
  pairing: {
    unit: string;
    shuffled: number;
    identity: number;
    byX: number;
    morton: number;
    /** Eksen ayrıştırması: kimliğin kazancı dikeyde mi, yatayda mı? */
    axis: Record<"shuffled" | "identity" | "byX" | "morton", { x: number; y: number }>;
    shuffleMs: number;
    sortXMs: number;
    sortMortonMs: number;
  };
  draw: {
    mode: string;
    count: number;
    gpuMs: TimingEntry | null;
    frameMs: TimingEntry;
  }[];
  morph: { t0: number | null; t05: number | null; t1: number | null };
  memory: { count: number; vramBytes: number; perWordBytes: number; perFrameBytes: number }[];
  rebuild: { count: number; totalMs: number; secondRunMs: number }[];
  parity: { maxAbsDiff: number | null; skipped: boolean };
  readability: {
    cell: number;
    spread06: { leftNew: number; midNew: number; rightOld: number; rightNew: number };
    spread0: { leftNew: number; rightOld: number; mean: number };
  };
}

const raf = (): Promise<number> => new Promise((resolve) => requestAnimationFrame(resolve));

function timeIt(fn: () => void, runs = TIMING_RUNS): number {
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  return median(samples);
}

/**
 * Yatay eksen kutu genişliğine göre normalize; dikey eksen kutu YÜKSEKLİĞİNE.
 * Mesafeyi tek bir birime (kutu genişliği) çekmek için y'yi orana göre ölçekliyoruz.
 */
function toBoxWidthUnits(points: Float32Array, width: number, height: number): Float32Array {
  const k = height / width;
  const out = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 2) {
    out[i] = points[i];
    out[i + 1] = points[i + 1] * k;
  }
  return out;
}

/** Shader'daki konum hesabının CPU ikizi; okunabilirlik ölçümü buna dayanıyor. */
function positionsAt(
  source: Float32Array,
  target: Float32Array,
  count: number,
  t: number,
  spread: number,
): Float32Array {
  const out = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const tl = localTime(t, target[i * 2], spread);
    const p = bowedPosition(
      source[i * 2],
      source[i * 2 + 1],
      target[i * 2],
      target[i * 2 + 1],
      tl,
      BOW,
      hash01(i),
    );
    out[i * 2] = p.x;
    out[i * 2 + 1] = p.y;
  }
  return out;
}

function coveredAt(raster: AlphaRaster, threshold: number): number {
  let n = 0;
  for (let i = 0; i < raster.data.length; i++) if (raster.data[i] >= threshold) n++;
  return n;
}

async function runFrames(
  app: App,
  frames: number,
  wall: number[] | null,
  gpu: number[] | null,
): Promise<void> {
  for (let i = 0; i < frames; i++) {
    const t0 = performance.now();
    app.render();
    await raf();
    if (wall) wall.push(performance.now() - t0);
  }
  const samples = app.takeGpuSamples();
  if (gpu) gpu.push(...samples);
}

function summarize(samples: number[]): TimingEntry {
  return { median: round(median(samples), 4), p95: round(percentile(samples, 95), 4) };
}

/**
 * Deterministik ölçüm koşusu (`?measure=1`).
 * Arka tampon sabit, tohumlar sabit, rAF döngüsü elle sürülüyor.
 */
export interface MeasureOptions {
  readonly load: number;
  /**
   * Kare bütçesi. Varsayılan 60 + 180; yalnızca hattın bütün alanları dolduruyor
   * mu diye BAKMAK için düşürülür (yavaş yazılım rasterleştiricide tam koşu
   * saatler sürüyor). Kullanılan değerler raporun `warmup`/`frames` alanlarına
   * yazılıyor, yani kısaltılmış koşu kendini ele veriyor — makaleye giren sayı
   * her zaman varsayılan bütçeden gelmeli.
   */
  readonly warmup?: number;
  readonly frames?: number;
}

export async function runMeasurement(
  app: App,
  font: LoadedFont,
  options: MeasureOptions,
): Promise<MeasureReport> {
  const { load } = options;
  const warmupFrames = Math.max(0, options.warmup ?? MEASURE_WARMUP);
  const measuredFrames = Math.max(1, options.frames ?? MEASURE_FRAMES);

  const { box, rasterOptions, context } = app;
  app.setAutoCycle(false);
  app.setFixedSize(MEASURE_WIDTH, MEASURE_HEIGHT);
  app.setZoom(1);
  app.setLoad(load);

  // 1) Font + kutu metrikleri.
  const metrics = measureWords([...WORDS, CONTROL_WORD], rasterOptions);

  // 2) RGB probu: "GÜNEŞ" rasterinin ham RGBA'sı.
  const probeCtx = drawTextToCanvas("GÜNEŞ", box, rasterOptions, true);
  const probeRgba = probeCtx.getImageData(0, 0, box.width, box.height).data;
  const rgb = probeEdgeRgb(probeRgba);

  // 3) willReadFrequently kıyası: aynı kutu, iki canvas, 20'şer geri okuma.
  const readOn = drawTextToCanvas("GÜNEŞ", box, rasterOptions, true);
  const readOff = drawTextToCanvas("GÜNEŞ", box, rasterOptions, false);
  const onSamples: number[] = [];
  const offSamples: number[] = [];
  for (let i = 0; i < 20; i++) {
    let t0 = performance.now();
    readOn.getImageData(0, 0, box.width, box.height);
    onSamples.push(performance.now() - t0);
    t0 = performance.now();
    readOff.getImageData(0, 0, box.width, box.height);
    offSamples.push(performance.now() - t0);
  }

  // 4) Eşik taraması: breve'in payı.
  const withBreveRaster = app.rasterOf("YAĞMUR");
  const withoutBreveRaster = app.rasterOf(CONTROL_WORD);
  const thresholdRows = THRESHOLDS.map((t) => {
    const withBreve = coveredAt(withBreveRaster, t);
    const withoutBreve = coveredAt(withoutBreveRaster, t);
    return { t, withBreve, withoutBreve, delta: withBreve - withoutBreve };
  });

  // 5) Kelime başına çıkarma faturası.
  const extractRows = WORDS.map((word) => {
    const r = app.extract(word, MAIN_COUNT, MAIN_THRESHOLD, "morton");
    return {
      word,
      getImageDataMs: round(r.getImageDataMs, 3),
      scanMs: round(r.scanMs, 3),
      sampleMs: round(r.sampleMs, 3),
      sortMs: round(r.sortMs, 3),
      totalMs: round(r.totalMs, 3),
      covered: r.covered,
    };
  });

  // 6) Örnekleme yolu: yürüyüş mü ikili arama mı.
  const gunesRaster = app.rasterOf("GÜNEŞ");
  const gunesIndex = buildCoverageIndex(gunesRaster, MAIN_THRESHOLD);
  const sampling = COUNTS.map((count) => ({
    count,
    walkMs: round(
      timeIt(() => {
        sampleTargets(gunesRaster, gunesIndex, count, mulberry32(2));
      }),
      3,
    ),
    binaryMs: round(
      timeIt(() => {
        sampleTargetsBinary(gunesRaster, gunesIndex, count, mulberry32(2));
      }),
      3,
    ),
  }));

  // 7) Doluluk CV: payda harfin kapsadığı hücreler.
  const support = maskFromRaster(gunesRaster, MAIN_THRESHOLD, OCCUPANCY_CELL);
  const randomPoints = sampleTargetsRandom(gunesRaster, gunesIndex, MAIN_COUNT, mulberry32(2));
  const stratifiedPoints = sampleTargets(gunesRaster, gunesIndex, MAIN_COUNT, mulberry32(2));
  const noJitter = sampleTargetsNoJitter(gunesRaster, gunesIndex, MAIN_COUNT, mulberry32(2));
  const occupancy = {
    cell: OCCUPANCY_CELL,
    random: round(occupancyCv(randomPoints, box.width, box.height, OCCUPANCY_CELL, support), 4),
    stratified: round(occupancyCv(noJitter, box.width, box.height, OCCUPANCY_CELL, support), 4),
    stratifiedJitter: round(
      occupancyCv(stratifiedPoints, box.width, box.height, OCCUPANCY_CELL, support),
      4,
    ),
  };

  // 8) Eşleştirme: "GÜNEŞ" → "YAĞMUR", dört sıralama.
  const cloudA = sampleTargets(gunesRaster, gunesIndex, MAIN_COUNT, mulberry32(2));
  const yagmurIndex = buildCoverageIndex(withBreveRaster, MAIN_THRESHOLD);
  const cloudB = sampleTargets(withBreveRaster, yagmurIndex, MAIN_COUNT, mulberry32(3));

  const shuffleMs = timeIt(() => {
    orderShuffled(MAIN_COUNT, mulberry32(11));
  });
  const sortXMs = timeIt(() => {
    orderByX(cloudB, MAIN_COUNT);
  });
  const sortMortonMs = timeIt(() => {
    orderMorton(cloudB, MAIN_COUNT);
  });

  const pairUnits = (a: Float32Array, b: Float32Array): number =>
    round(
      meanTravel(
        toBoxWidthUnits(a, box.width, box.height),
        toBoxWidthUnits(b, box.width, box.height),
      ) * 100,
      3,
    );

  /** Eksen ayrıştırması: toplam mesafeye bakınca kimliğin dikey kazancı kayboluyor. */
  const axisUnits = (a: Float32Array, b: Float32Array): { x: number; y: number } => {
    const ua = toBoxWidthUnits(a, box.width, box.height);
    const ub = toBoxWidthUnits(b, box.width, box.height);
    const n = ua.length / 2;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < n; i++) {
      sx += Math.abs(ub[i * 2] - ua[i * 2]);
      sy += Math.abs(ub[i * 2 + 1] - ua[i * 2 + 1]);
    }
    return { x: round((sx / n) * 100, 3), y: round((sy / n) * 100, 3) };
  };

  const paired = {
    shuffled: [
      reorder(cloudA, orderShuffled(MAIN_COUNT, mulberry32(11))),
      reorder(cloudB, orderShuffled(MAIN_COUNT, mulberry32(29))),
    ],
    identity: [
      reorder(cloudA, orderIdentity(MAIN_COUNT)),
      reorder(cloudB, orderIdentity(MAIN_COUNT)),
    ],
    byX: [
      reorder(cloudA, orderByX(cloudA, MAIN_COUNT)),
      reorder(cloudB, orderByX(cloudB, MAIN_COUNT)),
    ],
    morton: [
      reorder(cloudA, orderMorton(cloudA, MAIN_COUNT)),
      reorder(cloudB, orderMorton(cloudB, MAIN_COUNT)),
    ],
  } as const;

  const pairing = {
    unit: "kutu genişliği %",
    shuffled: pairUnits(paired.shuffled[0], paired.shuffled[1]),
    identity: pairUnits(paired.identity[0], paired.identity[1]),
    byX: pairUnits(paired.byX[0], paired.byX[1]),
    morton: pairUnits(paired.morton[0], paired.morton[1]),
    axis: {
      shuffled: axisUnits(paired.shuffled[0], paired.shuffled[1]),
      identity: axisUnits(paired.identity[0], paired.identity[1]),
      byX: axisUnits(paired.byX[0], paired.byX[1]),
      morton: axisUnits(paired.morton[0], paired.morton[1]),
    },
    shuffleMs: round(shuffleMs, 3),
    sortXMs: round(sortXMs, 3),
    sortMortonMs: round(sortMortonMs, 3),
  };

  // 9) Çizim: iki yol × üç parçacık sayısı, uT = 0,5 sabit.
  app.setThreshold(MAIN_THRESHOLD);
  app.setPairing("morton");
  app.setSpread(0.6);

  const draw: MeasureReport["draw"] = [];
  const memory: MeasureReport["memory"] = [];

  for (const count of COUNTS) {
    app.setCount(count);
    app.setWord("GÜNEŞ");
    app.setWord("YAĞMUR");
    app.setT(0.5);

    for (const mode of ["points", "quads"] as const) {
      app.setDrawMode(mode);
      await runFrames(app, warmupFrames, null, null);

      const wall: number[] = [];
      const gpu: number[] = [];
      const before = app.stats().uploadedBytes;
      await runFrames(app, measuredFrames, wall, gpu);
      const after = app.stats().uploadedBytes;

      draw.push({
        mode,
        count,
        gpuMs: gpu.length > 0 ? summarize(gpu) : null,
        frameMs: summarize(wall),
      });

      if (mode === "quads") {
        memory.push({
          count,
          vramBytes: count * 16,
          perWordBytes: count * 8,
          perFrameBytes: (after - before) / measuredFrames,
        });
      }
    }
  }

  // 10) Morph maliyeti: 100k, dörtgen, uT sabit üç aşama.
  app.setCount(MAIN_COUNT);
  app.setDrawMode("quads");
  app.setWord("GÜNEŞ");
  app.setWord("YAĞMUR");

  const morphOut: Record<string, number | null> = { t0: null, t05: null, t1: null };
  for (const [key, value] of [
    ["t0", 0],
    ["t05", 0.5],
    ["t1", 1],
  ] as const) {
    app.setT(value);
    await runFrames(app, warmupFrames, null, null);
    const gpu: number[] = [];
    await runFrames(app, measuredFrames, null, gpu);
    morphOut[key] = gpu.length > 0 ? round(median(gpu), 4) : null;
  }

  // 11) Kelime değişim donması: her sayı için ilk ve ikinci koşu.
  const rebuild: MeasureReport["rebuild"] = [];
  for (const count of COUNTS) {
    app.setCount(count);
    app.setWord("IŞIK");
    const first = app.stats().rebuildMs;
    app.setWord("GÜNEŞ");
    const second = app.stats().rebuildMs;
    rebuild.push({ count, totalMs: round(first, 3), secondRunMs: round(second, 3) });
  }

  // 12) Shader / CPU easing paritesi.
  const parityReport = measureShaderParity(app.gl, 0.5, 0.6, 256);
  const parity = {
    maxAbsDiff: parityReport.maxAbsDiff === null ? null : round(parityReport.maxAbsDiff, 7),
    skipped: parityReport.skipped,
  };

  // 13) Okunabilirlik: t = 0,5 anında ekranın üçte birleri.
  const oldRaster = gunesRaster;
  const newRaster = withBreveRaster;
  const oldMask = maskFromRaster(oldRaster, MAIN_THRESHOLD, READABILITY_CELL);
  const newMask = maskFromRaster(newRaster, MAIN_THRESHOLD, READABILITY_CELL);

  const sourceCloud = reorder(cloudA, orderMorton(cloudA, MAIN_COUNT));
  const targetCloud = reorder(cloudB, orderMorton(cloudB, MAIN_COUNT));

  function bands(spread: number) {
    const pos = positionsAt(sourceCloud, targetCloud, MAIN_COUNT, 0.5, spread);
    const stamped = splat(pos, box.width, box.height, READABILITY_CELL);
    return {
      leftNew: round(iou(stamped, newMask, 0, 1 / 3), 4),
      midNew: round(iou(stamped, newMask, 1 / 3, 2 / 3), 4),
      rightNew: round(iou(stamped, newMask, 2 / 3, 1), 4),
      leftOld: round(iou(stamped, oldMask, 0, 1 / 3), 4),
      rightOld: round(iou(stamped, oldMask, 2 / 3, 1), 4),
    };
  }

  const b06 = bands(0.6);
  const b0 = bands(0);

  const readability = {
    cell: READABILITY_CELL,
    spread06: {
      leftNew: b06.leftNew,
      midNew: b06.midNew,
      rightOld: b06.rightOld,
      rightNew: b06.rightNew,
    },
    spread0: {
      leftNew: b0.leftNew,
      rightOld: b0.rightOld,
      mean: round((b0.leftNew + b0.rightOld) / 2, 4),
    },
  };

  return {
    font: `${FONT_SIZE}px ${rasterOptions.fontFamily}`,
    fontFallback: font.fallback,
    fontSize: FONT_SIZE,
    gpu: context.rendererName,
    backing: { width: MEASURE_WIDTH, height: MEASURE_HEIGHT },
    warmup: warmupFrames,
    frames: measuredFrames,
    load,
    gpuTimer: app.timer !== null,
    pointSizeRange: [context.pointSizeRange[0], context.pointSizeRange[1]],
    colorBufferFloat: context.colorBufferFloat,
    box: {
      width: box.width,
      height: box.height,
      baseline: box.baseline,
      fontAscent: round(metrics.fontAscent, 3),
      words: metrics.words.map((w) => ({
        word: w.word,
        ascent: round(w.ascent, 3),
        descent: round(w.descent, 3),
        inkWidth: round(w.inkWidth, 3),
      })),
    },
    rgb,
    readFrequently: { onMs: round(median(onSamples), 3), offMs: round(median(offSamples), 3) },
    threshold: thresholdRows,
    extract: extractRows,
    sampling,
    occupancy,
    pairing,
    draw,
    morph: { t0: morphOut["t0"], t05: morphOut["t05"], t1: morphOut["t1"] },
    memory,
    rebuild,
    parity,
    readability,
  };
}
