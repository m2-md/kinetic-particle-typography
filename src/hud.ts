import type { AppStats } from "./app";
import type { MeasureReport } from "./measure/run";

export interface Hud {
  update(stats: AppStats): void;
  setTimerSource(source: "gpu" | "raf"): void;
  setNote(text: string): void;
  showMeasureReport(report: MeasureReport): void;
}

/** MEASURED: values read off the clock or the hardware every frame. */
const MEASURED = [
  ["frame", "frame ms"],
  ["fps", "FPS"],
  ["gpu", "GPU ms"],
  ["rebuild", "last word stall"],
  ["covered", "covered pixels"],
] as const;

/** STRUCTURAL: settings the user picked, not measured. */
const STRUCTURAL = [
  ["word", "word"],
  ["count", "particles"],
  ["threshold", "alpha threshold"],
  ["spread", "stagger"],
  ["draw", "draw path"],
  ["pairing", "pairing"],
  ["size", "backing store"],
  ["box", "raster box"],
  ["vram", "VRAM"],
] as const;

function group(title: string, kind: string): HTMLElement {
  const box = document.createElement("div");
  box.className = "hud-group";
  const head = document.createElement("div");
  head.className = "hud-group-title";
  head.textContent = title;
  const tag = document.createElement("span");
  tag.className = "hud-tag";
  tag.textContent = kind;
  head.appendChild(tag);
  box.appendChild(head);
  return box;
}

function row(parent: HTMLElement, label: string): HTMLElement {
  const line = document.createElement("div");
  line.className = "hud-row";
  const name = document.createElement("span");
  name.className = "hud-label";
  name.textContent = label;
  const value = document.createElement("span");
  value.className = "hud-value";
  value.textContent = "—";
  line.append(name, value);
  parent.appendChild(line);
  return value;
}

const PAIRING_LABEL: Record<string, string> = {
  morton: "Morton",
  identity: "Identity",
  byX: "By X",
  shuffled: "Shuffled",
};

export function createHud(root: HTMLElement): Hud {
  root.textContent = "";
  const cells = new Map<string, HTMLElement>();

  const measured = group("Measured", "MEASURED");
  for (const [key, label] of MEASURED) cells.set(key, row(measured, label));

  const structural = group("Configuration", "STRUCTURAL");
  for (const [key, label] of STRUCTURAL) cells.set(key, row(structural, label));

  const note = document.createElement("div");
  note.className = "hud-note";
  note.textContent = "GPU clock: probing…";

  root.append(measured, structural, note);

  let timerSource: "gpu" | "raf" = "raf";

  const set = (key: string, text: string) => {
    const cell = cells.get(key);
    if (cell) cell.textContent = text;
  };

  return {
    update(stats) {
      set("frame", `${stats.frameMs.toFixed(2)} ms`);
      set("fps", stats.frameMs > 0 ? (1000 / stats.frameMs).toFixed(0) : "—");
      if (timerSource === "gpu") {
        set("gpu", stats.gpuMs === null ? "…" : `${stats.gpuMs.toFixed(3)} ms`);
      } else {
        set("gpu", "no extension");
      }
      set("rebuild", `${stats.rebuildMs.toFixed(1)} ms`);
      set("covered", stats.covered.toLocaleString("en-US"));

      set("word", stats.word);
      set("count", stats.count.toLocaleString("en-US"));
      set("threshold", String(stats.threshold));
      set("spread", stats.spread.toFixed(2));
      set("draw", stats.drawMode === "points" ? "Point" : "Quad");
      set("pairing", PAIRING_LABEL[stats.pairing] ?? stats.pairing);
      set("size", `${stats.width}×${stats.height}`);
      set("box", `${stats.box.width}×${stats.box.height}`);
      set("vram", `${(stats.vramBytes / 1024 / 1024).toFixed(2)} MB`);
    },
    setTimerSource(source) {
      timerSource = source;
      note.textContent =
        source === "gpu"
          ? "GPU clock: EXT_disjoint_timer_query_webgl2"
          : "GPU clock: no extension → frame time only";
    },
    setNote(text) {
      note.textContent = text;
    },
    showMeasureReport(report) {
      const quad250 = report.draw.find((d) => d.mode === "quads" && d.count === 250_000);
      const unit = report.gpuTimer ? "GPU ms" : "frame ms";
      const value = report.gpuTimer
        ? (quad250?.gpuMs?.median.toFixed(3) ?? "—")
        : (quad250?.frameMs.median.toFixed(2) ?? "—");

      set("frame", `${quad250?.frameMs.median.toFixed(2) ?? "—"} ms`);
      set("fps", "—");
      set("gpu", `${value} ${unit} @250k`);
      set("rebuild", `${report.rebuild[report.rebuild.length - 1]?.totalMs.toFixed(1) ?? "—"} ms`);
      set("covered", String(report.extract[0]?.covered ?? "—"));
      set("word", "measurement run");
      set("count", "25k / 100k / 250k");
      set("threshold", "8 / 32 / 64 / 128 / 200");
      set("spread", "0.6 · 0");
      set("draw", "Point + Quad");
      set("pairing", "all four");
      set("size", `${report.backing.width}×${report.backing.height}`);
      set("box", `${report.box.width}×${report.box.height}`);
      set("vram", `${((250_000 * 16) / 1024 / 1024).toFixed(2)} MB`);

      note.textContent =
        `MEASURE done · ${report.gpu} · uploaded per frame: ` +
        `${report.memory[0]?.perFrameBytes ?? "?"} bytes · MEASURE {…} in the console`;
    },
  };
}
