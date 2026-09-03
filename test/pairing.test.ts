import { describe, expect, it } from "vitest";
import {
  orderByX,
  orderIdentity,
  orderMorton,
  orderShuffled,
  PAIRING_MODES,
  orderFor,
} from "../src/assign/pairing";
import { reorder } from "../src/assign/rank";
import { meanTravel } from "../src/assign/travel";
import { buildCoverageIndex, sampleTargets } from "../src/raster/extractTargets";
import { syntheticWord } from "../src/raster/syntheticRaster";
import { mulberry32 } from "../src/rng";

function randomCloud(count: number, seed: number): Float32Array {
  const rng = mulberry32(seed);
  const out = new Float32Array(count * 2);
  for (let i = 0; i < out.length; i++) out[i] = rng();
  return out;
}

function isPermutation(order: Uint32Array, count: number): boolean {
  if (order.length !== count) return false;
  const seen = new Uint8Array(count);
  for (const i of order) {
    if (i >= count || seen[i] === 1) return false;
    seen[i] = 1;
  }
  return true;
}

describe("pairing orders", () => {
  const count = 4000;
  const points = randomCloud(count, 21);

  it("all four paths produce a valid permutation", () => {
    for (const mode of PAIRING_MODES) {
      const order = orderFor(mode, points, count, mulberry32(1));
      expect(isPermutation(order, count), mode).toBe(true);
    }
  });

  it("orderIdentity really is the identity", () => {
    const order = orderIdentity(5);
    expect(Array.from(order)).toEqual([0, 1, 2, 3, 4]);
  });

  it("the same seed gives the same permutation, a different seed a different one", () => {
    const a = orderShuffled(count, mulberry32(3));
    const b = orderShuffled(count, mulberry32(3));
    const c = orderShuffled(count, mulberry32(4));
    expect(b).toEqual(a);
    expect(c).not.toEqual(a);
  });

  it("the orderByX output is non-decreasing in x", () => {
    const order = orderByX(points, count);
    // The key is quantized to 32 bits; the tolerance is one quantization step.
    const eps = 1 / 0xffffffff;
    let previous = -1;
    for (const i of order) {
      const x = points[i * 2];
      expect(x).toBeGreaterThanOrEqual(previous - eps);
      previous = x;
    }
  });
});

/**
 * Unit of measure: BOX WIDTH. The y axis is scaled by the ratio, otherwise
 * distance turns anisotropic — in a 1024×256 box a vertical pixel would weigh
 * four times a horizontal one and the ranking would come out of the unit itself.
 */
function isotropic(points: Float32Array, width: number, height: number): Float32Array {
  const k = height / width;
  const out = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 2) {
    out[i] = points[i];
    out[i + 1] = points[i + 1] * k;
  }
  return out;
}

function axisTravel(a: Float32Array, b: Float32Array): { x: number; y: number } {
  const n = a.length / 2;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += Math.abs(b[i * 2] - a[i * 2]);
    sy += Math.abs(b[i * 2 + 1] - a[i * 2 + 1]);
  }
  return { x: sx / n, y: sy / n };
}

describe("distance covered", () => {
  const count = 20_000;
  const width = 1024;
  const height = 256;
  const a = syntheticWord(width, height, 1);
  const b = syntheticWord(width, height, 2);
  const cloudA = sampleTargets(a, buildCoverageIndex(a, 32), count, mulberry32(1));
  const cloudB = sampleTargets(b, buildCoverageIndex(b, 32), count, mulberry32(2));

  const pair = (oa: Uint32Array, ob: Uint32Array) => ({
    a: isotropic(reorder(cloudA, oa), width, height),
    b: isotropic(reorder(cloudB, ob), width, height),
  });

  const shuffled = pair(orderShuffled(count, mulberry32(11)), orderShuffled(count, mulberry32(29)));
  const identity = pair(orderIdentity(count), orderIdentity(count));
  const byX = pair(orderByX(cloudA, count), orderByX(cloudB, count));
  const morton = pair(orderMorton(cloudA, count), orderMorton(cloudB, count));

  it("morton and x-sorted cover far less distance than shuffled", () => {
    const random = meanTravel(shuffled.a, shuffled.b);
    expect(meanTravel(morton.a, morton.b)).toBeLessThan(random * 0.5);
    expect(meanTravel(byX.a, byX.b)).toBeLessThan(random * 0.5);
  });

  it("morton beats identity too", () => {
    expect(meanTravel(morton.a, morton.b)).toBeLessThan(meanTravel(identity.a, identity.b));
  });

  /**
   * This nails the article's claim: the stratified walk scans the raster row by
   * row, so the identity pairing gets VERTICAL agreement for free. On the
   * horizontal it guarantees nothing — on that axis it is no better than random.
   */
  it("identity is near perfect vertically and guarantees nothing horizontally", () => {
    const idAxis = axisTravel(identity.a, identity.b);
    const shAxis = axisTravel(shuffled.a, shuffled.b);

    expect(idAxis.y).toBeLessThan(shAxis.y * 0.1);
    expect(idAxis.x).toBeGreaterThan(shAxis.x * 0.75);
  });

  it("morton tightens both axes at once", () => {
    const moAxis = axisTravel(morton.a, morton.b);
    const shAxis = axisTravel(shuffled.a, shuffled.b);
    expect(moAxis.x).toBeLessThan(shAxis.x * 0.5);
    expect(moAxis.y).toBeLessThan(shAxis.y * 0.5);
  });
});
