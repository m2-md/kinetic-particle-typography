import { mulberry32 } from "./rng";
import { backingSize } from "./viewport";
import type { AlphaRaster } from "./raster/alphaRaster";
import {
  alphaFromRgba,
  drawTextToCanvas,
  measureBox,
  type RasterOptions,
  type TextBox,
} from "./raster/rasterizeText";
import { buildCoverageIndex, sampleTargets } from "./raster/extractTargets";
import { orderFor, type PairingMode } from "./assign/pairing";
import { reorder } from "./assign/rank";
import { createContext, type GlContext } from "./gl/context";
import { createProgram, uniformLocations, type Uniforms } from "./gl/program";
import { FRAGMENT_SRC, VERTEX_SRC } from "./gl/shaders";
import { createCloud, type Cloud, type DrawMode } from "./gl/cloud";
import { createGpuTimer, type GpuTimer } from "./measure/gpuTimer";

export const WORDS: readonly string[] = ["IŞIK", "GÜNEŞ", "YAĞMUR", "ÇİÇEK"];
/** Never shown on screen; only there to measure the breve's share. */
export const CONTROL_WORD = "YAGMUR";

export const FONT_SIZE = 180;
export const PADDING = 24;
export const DEFAULT_COUNT = 25_000;
export const DEFAULT_THRESHOLD = 32;
export const DEFAULT_SPREAD = 0.6;
export const DEFAULT_RADIUS_PX = 3;
export const DEFAULT_SCALE = 0.5;
export const BOW = 0.05;
/** Fixed step per frame. NO delta-time: the measurement has to stay deterministic. */
export const MORPH_STEP = 1 / 72;
export const HOLD_FRAMES = 60;

export interface ExtractResult {
  readonly raster: AlphaRaster;
  readonly targets: Float32Array;
  readonly covered: number;
  readonly getImageDataMs: number;
  readonly scanMs: number;
  readonly sampleMs: number;
  readonly sortMs: number;
  readonly totalMs: number;
}

export interface AppStats {
  readonly width: number;
  readonly height: number;
  readonly word: string;
  readonly count: number;
  readonly threshold: number;
  readonly covered: number;
  readonly spread: number;
  readonly drawMode: DrawMode;
  readonly pairing: PairingMode;
  readonly t: number;
  readonly frameMs: number;
  readonly gpuMs: number | null;
  readonly rebuildMs: number;
  readonly vramBytes: number;
  readonly uploadedBytes: number;
  readonly box: TextBox;
}

export interface AppOptions {
  readonly fontFamily: string;
  readonly count?: number;
  readonly threshold?: number;
  readonly spread?: number;
  readonly drawMode?: DrawMode;
  readonly pairing?: PairingMode;
}

export interface App {
  readonly context: GlContext;
  readonly gl: WebGL2RenderingContext;
  readonly timer: GpuTimer | null;
  readonly box: TextBox;
  readonly rasterOptions: RasterOptions;

  setWord(word: string): void;
  setCount(count: number): void;
  setThreshold(threshold: number): void;
  setSpread(spread: number): void;
  setDrawMode(mode: DrawMode): void;
  setPairing(mode: PairingMode): void;
  setRadius(px: number): void;
  setZoom(zoom: number): void;
  setScale(scale: number): void;
  setLoad(load: number): void;
  setT(t: number): void;

  resize(): void;
  setFixedSize(width: number, height: number): void;
  /** Advance one frame: the uT step, the hold, the automatic word cycle. */
  advance(): void;
  render(): void;
  extract(word: string, count?: number, threshold?: number, pairing?: PairingMode): ExtractResult;
  rasterOf(word: string): AlphaRaster;
  stats(): AppStats;
  /** Takes the accumulated GPU query results and empties the pool. */
  takeGpuSamples(): number[];
  readonly autoCycle: boolean;
  setAutoCycle(on: boolean): void;
}

const UNIFORMS = [
  "uAspect",
  "uViewportPx",
  "uRadiusPx",
  "uT",
  "uSpread",
  "uBow",
  "uColor",
] as const;

/** Fixed seed per word: the same word always yields the same cloud. */
function seedForWord(word: string): number {
  const i = WORDS.indexOf(word);
  return (i >= 0 ? i : WORDS.length) + 1;
}

/** The shuffle seed has to DIFFER per word: apply the same permutation to both
 *  clouds and the "shuffled" pairing comes out equal to identity. */
function shuffleSeedForWord(word: string): number {
  return seedForWord(word) * 7919 + 13;
}

export function createApp(canvas: HTMLCanvasElement, options: AppOptions): App {
  const rasterOptions: RasterOptions = {
    fontFamily: options.fontFamily,
    fontSize: FONT_SIZE,
    padding: PADDING,
  };

  // The box is built from ALL the words, the control word included.
  const box = measureBox([...WORDS, CONTROL_WORD], rasterOptions);

  const context = createContext(canvas);
  const { gl } = context;
  const timer = createGpuTimer(gl);

  const quadProgram = createProgram(gl, VERTEX_SRC, FRAGMENT_SRC);
  const pointProgram = createProgram(gl, VERTEX_SRC, FRAGMENT_SRC, ["POINTS"]);
  const quadUniforms = uniformLocations(gl, quadProgram, UNIFORMS as unknown as string[]);
  const pointUniforms = uniformLocations(gl, pointProgram, UNIFORMS as unknown as string[]);

  let count = options.count ?? DEFAULT_COUNT;
  let threshold = options.threshold ?? DEFAULT_THRESHOLD;
  let spread = options.spread ?? DEFAULT_SPREAD;
  let drawMode: DrawMode = options.drawMode ?? "quads";
  let pairing: PairingMode = options.pairing ?? "morton";
  let radiusPx = DEFAULT_RADIUS_PX;
  let zoom = 1;
  let scale = DEFAULT_SCALE;
  let load = 1;

  let cloud: Cloud = createCloud(gl, count);
  let uploadedBase = 0;

  let word = WORDS[0];
  let covered = 0;
  let rebuildMs = 0;
  let t = 0;
  let hold = 0;
  let autoCycle = true;
  let frameMs = 0;
  let lastFrameStamp = 0;
  const gpuSamples: number[] = [];
  let gpuMs: number | null = null;

  let fixedSize: { width: number; height: number } | null = null;
  let width = 1;
  let height = 1;

  function extract(
    targetWord: string,
    n: number = count,
    th: number = threshold,
    mode: PairingMode = pairing,
  ): ExtractResult {
    const t0 = performance.now();
    const ctx = drawTextToCanvas(targetWord, box, rasterOptions, true);
    const t1 = performance.now();
    const rgba = ctx.getImageData(0, 0, box.width, box.height).data;
    const t2 = performance.now();
    const raster = alphaFromRgba(rgba, box.width, box.height);
    const index = buildCoverageIndex(raster, th);
    const t3 = performance.now();
    const points = sampleTargets(raster, index, n, mulberry32(seedForWord(targetWord)));
    const t4 = performance.now();
    const order = orderFor(mode, points, n, mulberry32(shuffleSeedForWord(targetWord)));
    const targets = reorder(points, order);
    const t5 = performance.now();

    return {
      raster,
      targets,
      covered: index.pixels.length,
      getImageDataMs: t2 - t1,
      scanMs: t3 - t2,
      sampleMs: t4 - t3,
      sortMs: t5 - t4,
      totalMs: t5 - t0,
    };
  }

  function rasterOf(targetWord: string): AlphaRaster {
    const ctx = drawTextToCanvas(targetWord, box, rasterOptions, true);
    const rgba = ctx.getImageData(0, 0, box.width, box.height).data;
    return alphaFromRgba(rgba, box.width, box.height);
  }

  function pushWord(targetWord: string): void {
    const start = performance.now();
    const result = extract(targetWord);
    cloud.push(result.targets, count);
    rebuildMs = performance.now() - start;
    covered = result.covered;
    word = targetWord;
    t = 0;
    hold = 0;
  }

  function rebuildCloud(): void {
    uploadedBase += cloud.uploadedBytes;
    cloud.dispose();
    cloud = createCloud(gl, count);
    // Fill both buffers so the first frame does not read garbage as its source.
    const result = extract(word);
    cloud.push(result.targets, count);
    cloud.push(result.targets, count);
    covered = result.covered;
    t = 1;
    hold = 0;
  }

  function aspect(): [number, number] {
    const boxAspect = box.width / box.height;
    const viewAspect = width / height;
    const margin = 0.92;
    if (boxAspect > viewAspect) {
      return [margin * zoom, (margin * viewAspect * zoom) / boxAspect];
    }
    return [(margin * boxAspect * zoom) / viewAspect, margin * zoom];
  }

  function applySize(w: number, h: number): void {
    width = w;
    height = h;
    canvas.width = w;
    canvas.height = h;
  }

  function resize(): void {
    if (fixedSize) {
      applySize(fixedSize.width, fixedSize.height);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || canvas.clientWidth || 960;
    const cssH = rect.height || canvas.clientHeight || 540;
    const size = backingSize(cssW, cssH, window.devicePixelRatio || 1, scale);
    applySize(size.width, size.height);
  }

  function render(): void {
    const now = performance.now();
    if (lastFrameStamp > 0) frameMs = now - lastFrameStamp;
    lastFrameStamp = now;

    const program = drawMode === "points" ? pointProgram : quadProgram;
    const u: Uniforms = drawMode === "points" ? pointUniforms : quadUniforms;
    const [ax, ay] = aspect();

    if (timer) timer.begin();

    gl.viewport(0, 0, width, height);
    gl.clearColor(0.035, 0.043, 0.062, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    gl.useProgram(program);
    gl.uniform2f(u["uAspect"], ax, ay);
    gl.uniform2f(u["uViewportPx"], width, height);
    gl.uniform1f(u["uRadiusPx"], radiusPx);
    gl.uniform1f(u["uT"], t);
    gl.uniform1f(u["uSpread"], spread);
    gl.uniform1f(u["uBow"], BOW);
    gl.uniform3f(u["uColor"], 0.36, 0.72, 1.0);

    // ?load=N: artificial load, to separate configurations that stay under the
    // vsync ceiling. The cloud is drawn N times per frame.
    for (let i = 0; i < load; i++) cloud.draw(drawMode, count);

    // Queries are collected every frame: the pool holds 8, it jams if not drained.
    if (timer) {
      timer.end();
      timer.collect(gpuSamples);
      if (gpuSamples.length > 0) gpuMs = gpuSamples[gpuSamples.length - 1];
      if (gpuSamples.length > 1024) gpuSamples.splice(0, gpuSamples.length - 1024);
    }
  }

  function advance(): void {
    if (t < 1) {
      t = Math.min(1, t + MORPH_STEP);
      if (t >= 1) hold = HOLD_FRAMES;
      return;
    }
    if (hold > 0) {
      hold--;
      return;
    }
    if (autoCycle) {
      const next = WORDS[(WORDS.indexOf(word) + 1) % WORDS.length];
      pushWord(next);
    }
  }

  // Startup: fill both buffers with the first word so the scene starts at rest.
  {
    const first = extract(WORDS[0]);
    cloud.push(first.targets, count);
    cloud.push(first.targets, count);
    covered = first.covered;
    t = 1;
  }
  resize();

  return {
    context,
    gl,
    timer,
    box,
    rasterOptions,

    setWord(next) {
      pushWord(next);
    },
    setCount(next) {
      if (next === count) return;
      count = next;
      rebuildCloud();
    },
    setThreshold(next) {
      if (next === threshold) return;
      threshold = next;
      const result = extract(word);
      cloud.push(result.targets, count);
      cloud.push(result.targets, count);
      covered = result.covered;
      t = 1;
    },
    setSpread(next) {
      spread = next;
    },
    setDrawMode(mode) {
      drawMode = mode;
    },
    setPairing(mode) {
      if (mode === pairing) return;
      pairing = mode;
      const result = extract(word);
      cloud.push(result.targets, count);
      cloud.push(result.targets, count);
      covered = result.covered;
      t = 1;
    },
    setRadius(px) {
      radiusPx = px;
    },
    setZoom(next) {
      zoom = next;
    },
    setScale(next) {
      scale = next;
    },
    setLoad(next) {
      load = Math.max(1, Math.round(next));
    },
    setT(next) {
      t = Math.min(1, Math.max(0, next));
      hold = 0;
    },

    resize,
    setFixedSize(w, h) {
      fixedSize = { width: w, height: h };
      applySize(w, h);
    },
    advance,
    render,
    extract,
    rasterOf,
    takeGpuSamples() {
      const copy = gpuSamples.slice();
      gpuSamples.length = 0;
      return copy;
    },

    get autoCycle() {
      return autoCycle;
    },
    setAutoCycle(on) {
      autoCycle = on;
    },

    stats() {
      return {
        width,
        height,
        word,
        count,
        threshold,
        covered,
        spread,
        drawMode,
        pairing,
        t,
        frameMs,
        gpuMs,
        rebuildMs,
        vramBytes: count * cloud.bytesPerParticle,
        uploadedBytes: uploadedBase + cloud.uploadedBytes,
        box,
      };
    },
  };
}
