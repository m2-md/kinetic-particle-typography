/**
 * Algorithm measurements that need NO browser.
 *   npm run bench   →   ONE line on stdout: BENCH {json}
 *
 * No real font: two synthetic rasters produced by `syntheticWord` are used.
 * What is being compared is the algorithm — walk or binary search, how much
 * distance each pairing makes the particles cover, how long Morton sorting takes.
 */
import { bowedPosition, localTime } from "../src/anim/easing";
import { hash01 } from "../src/anim/hash";
import { morton2D } from "../src/assign/morton";
import { orderByX, orderIdentity, orderMorton, orderShuffled } from "../src/assign/pairing";
import { reorder } from "../src/assign/rank";
import { meanTravel } from "../src/assign/travel";
import { buildCoverageIndex, sampleTargets } from "../src/raster/extractTargets";
import { sampleTargetsBinary } from "../src/raster/sampleTargetsBinary";
import { sampleTargetsNoJitter } from "../src/raster/sampleTargetsNoJitter";
import { sampleTargetsRandom } from "../src/raster/sampleTargetsRandom";
import { syntheticWord } from "../src/raster/syntheticRaster";
import { occupancyCv } from "../src/measure/occupancy";
import { iou, maskFromRaster, splat } from "../src/measure/readability";
import { mulberry32 } from "../src/rng";
import { median, round } from "../src/stats";

const WIDTH = 1024;
const HEIGHT = 256;
const THRESHOLD = 32;
const CELL = 8;
const READ_CELL = 4;
const MAIN_COUNT = 100_000;
const COUNTS = [25_000, 100_000, 250_000];
const RUNS = 3;
const BOW = 0.05;
const INDEX_SCALE = 2 ** 20;

function timed(fn: () => void, runs = RUNS): { ms: number; runs: number[] } {
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  return { ms: round(median(samples), 3), runs: samples.map((x) => round(x, 3)) };
}

function mortonPhases(points: Float32Array, count: number) {
  const t0 = performance.now();
  const keys = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    keys[i] = morton2D(points[i * 2], points[i * 2 + 1]) * INDEX_SCALE + i;
  }
  const t1 = performance.now();
  keys.sort();
  const t2 = performance.now();
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = keys[i] % INDEX_SCALE;
  reorder(points, order);
  const t3 = performance.now();
  return { buildMs: t1 - t0, sortMs: t2 - t1, reorderMs: t3 - t2 };
}

function toBoxWidthUnits(points: Float32Array): Float32Array {
  const k = HEIGHT / WIDTH;
  const out = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 2) {
    out[i] = points[i];
    out[i + 1] = points[i + 1] * k;
  }
  return out;
}

function travelPercent(a: Float32Array, b: Float32Array): number {
  return round(meanTravel(toBoxWidthUnits(a), toBoxWidthUnits(b)) * 100, 3);
}

/**
 * Axis breakdown. The identity pairing's gain is ONLY on the vertical: the
 * stratified walk scans the raster row by row. On the horizontal it guarantees
 * nothing. Total distance hides that split, so it is reported separately.
 */
function axisPercent(a: Float32Array, b: Float32Array): { x: number; y: number } {
  const ua = toBoxWidthUnits(a);
  const ub = toBoxWidthUnits(b);
  const n = ua.length / 2;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += Math.abs(ub[i * 2] - ua[i * 2]);
    sy += Math.abs(ub[i * 2 + 1] - ua[i * 2 + 1]);
  }
  return { x: round((sx / n) * 100, 3), y: round((sy / n) * 100, 3) };
}

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

function main(): void {
  const rasterA = syntheticWord(WIDTH, HEIGHT, 1);
  const rasterB = syntheticWord(WIDTH, HEIGHT, 2);
  const indexA = buildCoverageIndex(rasterA, THRESHOLD);
  const indexB = buildCoverageIndex(rasterB, THRESHOLD);

  // 1) The sampling path: sequential walk or binary search.
  const sampling = COUNTS.map((count) => {
    const walk = timed(() => {
      sampleTargets(rasterA, indexA, count, mulberry32(7));
    });
    const binary = timed(() => {
      sampleTargetsBinary(rasterA, indexA, count, mulberry32(7));
    });
    return {
      count,
      walkMs: walk.ms,
      binaryMs: binary.ms,
      runs: { walk: walk.runs, binary: binary.runs },
    };
  });

  // 2) Equivalence: same seed, two implementations, a BIT-IDENTICAL array.
  let walkEqualsBinary = true;
  for (const count of [1000, 25_000]) {
    const w = sampleTargets(rasterA, indexA, count, mulberry32(7));
    const b = sampleTargetsBinary(rasterA, indexA, count, mulberry32(7));
    for (let i = 0; i < w.length; i++) {
      if (w[i] !== b[i]) {
        walkEqualsBinary = false;
        break;
      }
    }
  }

  // 3) Occupancy: pinning clustering to a single number.
  const support = maskFromRaster(rasterA, THRESHOLD, CELL);
  const occupancy = {
    cell: CELL,
    random: round(
      occupancyCv(
        sampleTargetsRandom(rasterA, indexA, MAIN_COUNT, mulberry32(7)),
        WIDTH,
        HEIGHT,
        CELL,
        support,
      ),
      4,
    ),
    stratified: round(
      occupancyCv(
        sampleTargetsNoJitter(rasterA, indexA, MAIN_COUNT, mulberry32(7)),
        WIDTH,
        HEIGHT,
        CELL,
        support,
      ),
      4,
    ),
    stratifiedJitter: round(
      occupancyCv(
        sampleTargets(rasterA, indexA, MAIN_COUNT, mulberry32(7)),
        WIDTH,
        HEIGHT,
        CELL,
        support,
      ),
      4,
    ),
  };

  // 4) Pairing: four paths, the same two clouds.
  const cloudA = sampleTargets(rasterA, indexA, MAIN_COUNT, mulberry32(7));
  const cloudB = sampleTargets(rasterB, indexB, MAIN_COUNT, mulberry32(8));

  const shuffle = timed(() => {
    orderShuffled(MAIN_COUNT, mulberry32(11));
  });
  const sortX = timed(() => {
    orderByX(cloudB, MAIN_COUNT);
  });
  const sortMorton = timed(() => {
    orderMorton(cloudB, MAIN_COUNT);
  });

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
    unit: "% of box width",
    shuffled: travelPercent(paired.shuffled[0], paired.shuffled[1]),
    identity: travelPercent(paired.identity[0], paired.identity[1]),
    byX: travelPercent(paired.byX[0], paired.byX[1]),
    morton: travelPercent(paired.morton[0], paired.morton[1]),
    axis: {
      shuffled: axisPercent(paired.shuffled[0], paired.shuffled[1]),
      identity: axisPercent(paired.identity[0], paired.identity[1]),
      byX: axisPercent(paired.byX[0], paired.byX[1]),
      morton: axisPercent(paired.morton[0], paired.morton[1]),
    },
    shuffleMs: shuffle.ms,
    sortXMs: sortX.ms,
    sortMortonMs: sortMorton.ms,
  };

  // 5) The phases of the Morton sort.
  const morton = COUNTS.map((count) => {
    const points = sampleTargets(rasterB, indexB, count, mulberry32(8));
    const samples = Array.from({ length: RUNS }, () => mortonPhases(points, count));
    return {
      count,
      buildMs: round(median(samples.map((s) => s.buildMs)), 3),
      sortMs: round(median(samples.map((s) => s.sortMs)), 3),
      reorderMs: round(median(samples.map((s) => s.reorderMs)), 3),
    };
  });

  // 6) Readability: the thirds of the screen at t = 0.5.
  const maskOld = maskFromRaster(rasterA, THRESHOLD, READ_CELL);
  const maskNew = maskFromRaster(rasterB, THRESHOLD, READ_CELL);
  const sourceCloud = reorder(cloudA, orderMorton(cloudA, MAIN_COUNT));
  const targetCloud = reorder(cloudB, orderMorton(cloudB, MAIN_COUNT));

  const bands = (spread: number) => {
    const stamped = splat(
      positionsAt(sourceCloud, targetCloud, MAIN_COUNT, 0.5, spread),
      WIDTH,
      HEIGHT,
      READ_CELL,
    );
    return {
      leftNew: round(iou(stamped, maskNew, 0, 1 / 3), 4),
      rightOld: round(iou(stamped, maskOld, 2 / 3, 1), 4),
    };
  };

  const spread06 = bands(0.6);
  const spread0 = bands(0);

  const report = {
    node: process.version,
    raster: {
      width: WIDTH,
      height: HEIGHT,
      threshold: THRESHOLD,
      coveredA: indexA.pixels.length,
      coveredB: indexB.pixels.length,
    },
    sampling,
    equivalence: { walkEqualsBinary },
    occupancy,
    pairing,
    morton,
    readability: {
      cell: READ_CELL,
      spread06,
      spread0: { ...spread0, mean: round((spread0.leftNew + spread0.rightOld) / 2, 4) },
    },
  };

  console.log(`BENCH ${JSON.stringify(report)}`);
}

main();
