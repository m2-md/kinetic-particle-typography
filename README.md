# The Ğ that lost its breve — kinetic typography from a Canvas text raster to 250,000 particles

<!-- LINKS:BEGIN — üretildi: scripts/sync-repo-links.py · elle düzenleme -->
**▶ [Live demo](https://m2-md.github.io/kinetic-particle-typography/)** · [Source](https://github.com/m2-md/kinetic-particle-typography)
<!-- LINKS:END -->

> Interactive particle typography: rasterizing canvas text, sampling alpha contours, Morton order pairing, and morphing 250,000 particles via single-uniform WebGL2 instancing.

Working code for the article "The Ğ That Lost Its Breve: Kinetic Typography from a
Canvas Text Raster to 250,000 Particles".

The text is rasterized in Canvas 2D, the particle targets come **out of the alpha
channel**, **Morton order** decides who goes where when the word changes, and the
morph is driven by **a single uniform**. Zero bytes go to the GPU per frame.

Stack: raw **WebGL2 (GLSL ES 3.00)** + **Canvas 2D** + TypeScript + Vite + vitest.
No Three.js, no R3F, no particle/tween/typography library, **no runtime
dependency**. The one "off the shelf" component is the browser's own font
rasterizer (`fillText`) — deliberately: text here is a *data source*, not a render target.

## The whole pipeline

| Step | File | What it does |
| --- | --- | --- |
| Box | `src/raster/rasterizeText.ts` | One box from the max `actualBoundingBoxAscent` of **all** the words |
| Raster | `src/raster/rasterizeText.ts` | `fillText` → `getImageData` → alpha only (one read every 4 bytes) |
| Threshold | `src/raster/extractTargets.ts` | Coverage index; alpha carries **weight**, not a binary flag |
| Sampling | `src/raster/extractTargets.ts` | Stratified walk, `u_k = (k + ξ)·total/N`, `O(N + M)` |
| Pairing | `src/assign/{morton,rank,pairing}.ts` | Morton code (32 bit) + index (20 bit) → one `Float64Array` key |
| Drawing | `src/gl/{cloud,shaders}.ts` | Two static attributes + the `uT` uniform; instanced quad or `POINTS` |

## Setup

```bash
npm install
```

No runtime dependency; `devDependencies` is only vite / vite-node / vitest /
typescript / prettier.

## Running

```bash
npm run dev
```

`http://localhost:5173/` — **the port is fixed** (`vite.config.ts` →
`strictPort: true`), because the measurement URLs below point at this exact address.
**Do not open it over `file://`**, you get a blank screen.

### Demo controls

| Control | Values | Default |
| --- | --- | --- |
| Word | IŞIK / GÜNEŞ / YAĞMUR / ÇİÇEK | auto cycle |
| **Switch to the same word** (`Again`) | — | — |
| Particle count | 25k / 100k / 250k | **25k** |
| Alpha threshold | 1–250 | **32** |
| Stagger (spread) | 0–0.9 | **0.6** |
| Radius | 1–30 px | 3 px |
| Zoom | 1.0–4.0× | 1.0× |
| Draw path | Quad (instanced) / Point (`gl_PointSize`) | Quad |
| Pairing | Morton / Identity / By X / Shuffled | Morton |
| Resolution scale | 0.35 / 0.5 / 0.75 / 1.0 | **0.5** |
| Auto cycle | on/off | on |
| Pause/Resume | — | Running |

`devicePixelRatio` is clamped to 2 (`src/viewport.ts` → `MAX_DPR`), the loop stops
when the tab is hidden (`visibilitychange`), and the HUD is split in two:
**MEASURED / STRUCTURAL**. The morph advances by a fixed step per frame (`1/72`,
**no** delta-time) and holds for `60` frames when it lands — that is the condition
for the measurement being deterministic.

### The `Again` button is proof of a NaN clamp

Switching to the same word makes every particle's **source equal to its target**.
The bow normal in the vertex shader is `vec2(-d.y, d.x) / max(length(d), 1e-6)`;
without the `max`, dividing by the zero vector produces NaN, a NaN position gets
silently culled and **the cloud disappears as it stands**. No error, no warning, a
clean console. The button triggers exactly that state: if the clamp works, the
cloud has to stay put.

The regression is also nailed down through the `VERTEX_SRC` text in
`test/shaderSource.test.ts`.

### A word change freezes the main thread

Raster + alpha scan + sampling + Morton sort run once per word, on the main
thread. The freeze is not hidden: its duration sits in the HUD's "last word stall"
row and inside `MEASURE.rebuild[]`.

## Tests

```bash
npm test
```

**79 tests green** (15 files). None of them touch `document`, `window`, `navigator`
or `WebGL2RenderingContext`: headless vitest has no DOM, no canvas and no GPU. The
raster logic is therefore split into **pure functions** (functions taking an
`AlphaRaster`) and the tests are fed by the analytically antialiased
rectangle/disk rasters of `src/raster/syntheticRaster.ts`.

| File | Tests | What it nails down |
| --- | --- | --- |
| `morton.test.ts` | 9 | `part1By1` bit spreading; monotonicity along a single axis; nearby points → shared top bits; the corners `(0,0)→0`, `(1,1)→0xffffffff`; out-of-range clamping; the 52-bit packing being a **permutation**; the order being non-decreasing by code; `count > 2^20` throwing |
| `extractTargets.test.ts` | 8 | The **exact boundary** of the threshold is included (`>=`); the prefix strictly increases and ends on the total; an alpha-128 pixel casting **half** the vote of a 255 one (a ratio test over 20k samples); always exactly `count` targets; every point sitting inside a pixel that passes the threshold; `count*2` zeros on an empty raster |
| `pairing.test.ts` | 8 | All four orderings are valid permutations; the same seed gives the same permutation; `orderByX` output is non-decreasing in x; Morton and x-sorted stay below half of shuffled; Morton beats identity too; **identity is under a tenth of shuffled vertically and no better than it horizontally**; Morton tightens both axes at once |
| `easing.test.ts` | 7 | `smoothstep` bounds and `0.5` at the exact middle; `localTime(t, phase, 0)` is the same for every `phase`; at `spread = 0.6`, `phase = 0` is ≥ `phase = 1` at every `t`; **`bowedPosition` produces no NaN on a zero-length displacement** |
| `shaderSource.test.ts` | 7 | `withDefines` does not break the `#version` line (the first line is still `#version 300 es`); the defines start from the second line; an empty list leaves the source untouched; `max(length(d), 1e-6)` **is** present in `VERTEX_SRC`; a `sin(`-based hash **is not** |
| `syntheticRaster.test.ts` | 6 | The covered pixel count of `solidBox` can be counted by hand; the `syntheticWord` alpha ramp is continuous; the same seed gives the same raster |
| `stats.test.ts` | 6 | Median/percentile; `NaN` on an empty array (**not** 0); p0 = min, p100 = max; **the input is not mutated** |
| `readability.test.ts` | 4 | `iou === 1` on an identical mask, 0 on a disjoint one; the band boundaries cut in the right place; `splat` clamps anything outside the grid |
| `occupancy.test.ts` | 4 | CV ≈ 0 on an even grid; high when everything piles into one cell; a defined value on empty input |
| `viewport.test.ts` | 4 | `dpr = 3 → 2`; the scale into `[0.25, 1]`; the result is never 0 |
| `sampleTargetsEquivalence.test.ts` | 4 | The walk and the binary search give a **bit-identical** `Float32Array` (3 rasters × 3 counts) |
| `rgbProbe.test.ts` | 3 | Only `0 < a < 255` pixels are counted; the deviation is `max(\|R−255\|, \|G−255\|, \|B−255\|)` |
| `travel.test.ts` | 3 | `meanTravel === 0` on identical clouds; the exact offset on a constant shift; a single-point cloud |
| `hash.test.ts` | 3 | `hash01` output in `[0,1)`; deterministic; the first 8 indices nailed to fixed values (the reference for the shader twin) |
| `rng.test.ts` | 3 | `mulberry32` range, reproducibility, a different seed giving a different sequence |

## Type checking and building

```bash
npx tsc --noEmit   # 0 errors
npm run build      # tsc && vite build → dist/
```

`vite build` passing does not prove the shader **runs**: GLSL is compiled at run
time. Browser verification is mandatory.

## `npm run bench` — algorithm measurements without a browser

```bash
npm run bench
```

**One line** on the console: `BENCH {json}`. No real font; two synthetic rasters
produced by `syntheticWord(1024, 256, seed)` are used. What is compared is the
**algorithm**, not the absolute number. Every timing is 3 runs with the median
reported, and the raw runs sit in the `runs` field.

On this machine (Node v22.22.2), a 1024×256 raster, threshold 32, 58,901 / 60,285
pixels covered:

| Measurement | Value |
| --- | --- |
| Sampling 25k — walk / binary search | 2.53 / 3.23 ms |
| Sampling 100k — walk / binary search | 2.92 / 6.26 ms |
| Sampling 250k — walk / binary search | 7.14 / 13.84 ms |
| `equivalence.walkEqualsBinary` | **`true`** (bit-identical) |
| Occupancy CV — random / stratified / stratified+jitter | 0.4414 / 0.4308 / 0.4314 |
| Mean distance — shuffled / identity / X / Morton | 34.17% / 35.12% / 5.37% / 6.17% |
| Sorting cost — shuffle / X / Morton (100k) | 1.51 / 10.02 / 10.89 ms |
| Morton 250k — key / `sort()` / `reorder` | 6.06 / 9.32 / 12.89 ms |

### `pairing.axis` — where identity's gain actually is

The distinction that disappears when you look at total distance shows up in the
axis breakdown (unit: percent of box width):

| Pairing | Horizontal | Vertical |
| --- | --- | --- |
| Shuffled | 32.96 | 5.33 |
| Identity | **35.11** | **0.19** |
| By X | **0.55** | 5.20 |
| Morton | 5.87 | 1.15 |

What the identity pairing wins for free is **vertical agreement only** — the
stratified walk scans the coverage index row by row. Horizontally it guarantees
nothing; on this synthetic pair its horizontal distance comes out **worse** than
random, which is why it cannot beat random on total distance. `orderByX` is the
mirror image: flawless horizontally, as bad as random vertically. Morton is the
only path that tightens both axes at once.

> **Note:** the `BENCH` output fills in no table in the article; it is there for a
> **cross-check**. The article's tables come from the `MEASURE` run taken with the
> real font. On synthetic rasters the identity/shuffled ranking is sensitive to the
> box ratio (at 1024×256 it flips); what comes out with a real font is decided by
> `MEASURE.pairing` and `MEASURE.pairing.axis`.

## Deterministic measurement mode — MEASUREMENT URLS

```bash
npm run dev
```

| URL | What it measures |
| --- | --- |
| `http://localhost:5173/?measure=1` | The main run, one `MEASURE {json}` line on the console |
| `http://localhost:5173/?measure=1&load=8` | The same run, the cloud drawn **8 times** per frame (to get past the vsync ceiling) |
| `http://localhost:5173/?measure=1&warmup=1&frames=2` | **Smoke test only.** It checks whether all the pipeline's fields get filled; the timing numbers are junk |

The `warmup` / `frames` override is **not used** for a number that goes into the
article. Since the values used are written into the report's `warmup` and `frames`
fields, a shortened run gives itself away: the table in the article has to come
from a row with `"warmup": 60, "frames": 180`.

When `?measure=1` is on: the control panel and the rAF loop shut down, frames are
driven by hand, the backing store is locked to **960×540** (`devicePixelRatio` and
the scale are ignored), the seed is fixed per word (`seed = wordIndex + 1`), the
word cycle stops and `uT` is set by hand. Every timing block is **60 warmup + 180
measured** frames. At the end **one line** of `MEASURE {json}` drops into the
console; there is no other `console.log` (warnings go to `console.warn`).

The run program, in order: (1) font + box metrics · (2) RGB deviation on the edge
pixels · (3) `getImageData` with `willReadFrequently` on and off · (4) the
threshold sweep `t ∈ {8, 32, 64, 128, 200}`, "YAĞMUR" vs "YAGMUR" · (5) the
extraction bill per word (100k, threshold 32) · (6) the sampling path 25k/100k/250k
· (7) occupancy CV · (8) pairing (four paths plus the axis breakdown) · (9)
drawing: `{point, quad} × {25k, 100k, 250k}`, `uT = 0.5` · (10) morph cost
`uT ∈ {0, 0.5, 1}` · (11) the word-change stall · (12) shader/CPU easing parity ·
(13) the readability IoU (`spread ∈ {0.6, 0}`) · (14) `ALIASED_POINT_SIZE_RANGE`.

### The `MEASURE` schema

```json
{
  "font": "180px KptRoboto",
  "fontFallback": false,
  "fontSize": 180,
  "gpu": "…",
  "backing": { "width": 960, "height": 540 },
  "warmup": 60,
  "frames": 180,
  "load": 1,
  "gpuTimer": true,
  "pointSizeRange": [1, 511],
  "colorBufferFloat": true,

  "box": {
    "width": 0, "height": 0, "baseline": 0, "fontAscent": 0,
    "words": [{ "word": "IŞIK", "ascent": 0, "descent": 0, "inkWidth": 0 }]
  },

  "rgb": { "maxDeviation": 0, "edgePixels": 0 },
  "readFrequently": { "onMs": 0, "offMs": 0 },
  "threshold": [{ "t": 8, "withBreve": 0, "withoutBreve": 0, "delta": 0 }],
  "extract": [{ "word": "IŞIK", "getImageDataMs": 0, "scanMs": 0, "sampleMs": 0,
                "sortMs": 0, "totalMs": 0, "covered": 0 }],
  "sampling": [{ "count": 25000, "walkMs": 0, "binaryMs": 0 }],
  "occupancy": { "cell": 8, "random": 0, "stratified": 0, "stratifiedJitter": 0 },

  "pairing": {
    "unit": "% of box width",
    "shuffled": 0, "identity": 0, "byX": 0, "morton": 0,
    "axis": { "shuffled": { "x": 0, "y": 0 }, "identity": { "x": 0, "y": 0 },
              "byX": { "x": 0, "y": 0 }, "morton": { "x": 0, "y": 0 } },
    "shuffleMs": 0, "sortXMs": 0, "sortMortonMs": 0
  },

  "draw": [{ "mode": "points", "count": 25000,
             "gpuMs": { "median": 0, "p95": 0 },
             "frameMs": { "median": 0, "p95": 0 } }],
  "morph": { "t0": 0, "t05": 0, "t1": 0 },
  "memory": [{ "count": 25000, "vramBytes": 0, "perWordBytes": 0, "perFrameBytes": 0 }],
  "rebuild": [{ "count": 25000, "totalMs": 0, "secondRunMs": 0 }],
  "parity": { "maxAbsDiff": 0, "skipped": false },

  "readability": {
    "cell": 4,
    "spread06": { "leftNew": 0, "midNew": 0, "rightOld": 0, "rightNew": 0 },
    "spread0": { "leftNew": 0, "rightOld": 0, "mean": 0 }
  }
}
```

Rules:

- **GPU time is never invented.** Without `EXT_disjoint_timer_query_webgl2` you get
  `gpuTimer: false`, the `draw[].gpuMs` and `morph.*` fields stay `null`, and only
  the frame time is read.
- GPU timestamps **may be quantized**: the same median repeating shows the
  counter's resolution, not stability. The raw median is reported.
- The `GPU_DISJOINT_EXT` flag is read; frames the driver switched context on are
  thrown out of the measurement (`src/measure/gpuTimer.ts`).
- Without `EXT_color_buffer_float`, `parity.skipped: true` and the parity check is
  skipped — no number is invented.
- **`memory[].perFrameBytes` MUST be 0.** If it comes out non-zero the code is
  wrong: a `bufferSubData` has leaked into the frame loop. The counter sums the
  real uploaded byte count through `Cloud.uploadedBytes`, not a computed constant.
- `frameMs.median` locks to the display refresh rate. Read the saturation off
  `gpuMs` or off a `?load=8` run, not off the frame time.
- The measurement is **not taken in a hidden tab**: `requestAnimationFrame` gets
  throttled and the numbers go bad.
- Over two consecutive runs the `extract[].covered`, `threshold[]`, `pairing[]` and
  `occupancy` values have to come out **exactly the same**; the only thing that is
  not deterministic is the timings.

### The raw measurement log

Series convention: the `MEASURE {json}` lines that drop into the console are
written to `measurements-YYYY-MM-DD.jsonl`, one run per line (the `id` field
carries the URL label, cold runs are marked with `note`). The tables in the article
rest on that file.

## Font

`public/fonts/Roboto-Regular.ttf` (Apache-2.0, license text in
`public/fonts/LICENSE-Roboto.txt`) is loaded through the `FontFace` API under the
name `KptRoboto`, and `await document.fonts.ready` is awaited before rasterizing.
Without that line the `ctx.font` assignment **silently** falls back: the raster
runs, the particles form, the word is drawn in the wrong font, and nothing warns
anywhere.

If loading fails it carries on with `system-ui, sans-serif` and
`MEASURE.fontFallback` comes out **`true`**. In that case the measurements are
machine-specific; the box/ascent numbers in the article, taken with the bundled
font, cannot be compared against them.

The demo words are fixed: `IŞIK`, `GÜNEŞ`, `YAĞMUR`, `ÇİÇEK`. The control word
`YAGMUR`, never shown on screen, exists only to measure the breve's share below the
threshold, and **it is taken into account when the box is built** too — so that the
opening mistake of the article does not happen in this project.

## Known scope limits

- The targets are computed **once** per word; there is no resampling within a frame.
- The particle position is not kept on the GPU; the morph is a `mix` between two
  static attributes. No compute shader, no transform feedback, no FBO ping-pong.
- Optimal assignment (Hungarian algorithm / optimal transport) is not implemented: `O(n³)`.
- The text is a single line and a single word; no line wrapping, no kerning
  intervention, no RTL.
- There is **no** 1,000,000-particle option (the series' demo weight rule). The
  limit is not memory — even at 250k the two buffers total 4 MB — it is the CPU
  stall on the word change and the fill cost.
- No physics: no inter-particle force, no collision, no flow field. The path is
  `mix` + the bow.

## License

MIT — see `LICENSE`. The bundled font comes under a separate license:
`public/fonts/LICENSE-Roboto.txt` (Apache-2.0).
