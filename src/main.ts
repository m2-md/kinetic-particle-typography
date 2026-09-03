import {
  DEFAULT_COUNT,
  DEFAULT_RADIUS_PX,
  DEFAULT_SCALE,
  DEFAULT_SPREAD,
  DEFAULT_THRESHOLD,
  WORDS,
  createApp,
  type App,
} from "./app";
import type { DrawMode } from "./gl/cloud";
import type { PairingMode } from "./assign/pairing";
import { createHud } from "./hud";
import { loadFont } from "./raster/loadFont";
import { runMeasurement } from "./measure/run";

function need<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`DOM düğümü yok: ${selector}`);
  return el;
}

const canvas = need<HTMLCanvasElement>("#stage");
const hudRoot = need<HTMLElement>("#hud");
const banner = need<HTMLElement>("#banner");
const toggleButton = need<HTMLButtonElement>("#toggle");
const wordRow = need<HTMLElement>("#word");
const countRow = need<HTMLElement>("#count");
const againButton = need<HTMLButtonElement>("#again");
const thresholdInput = need<HTMLInputElement>("#threshold");
const thresholdOut = need<HTMLElement>("#threshold-out");
const spreadInput = need<HTMLInputElement>("#spread");
const spreadOut = need<HTMLElement>("#spread-out");
const radiusInput = need<HTMLInputElement>("#radius");
const radiusOut = need<HTMLElement>("#radius-out");
const zoomInput = need<HTMLInputElement>("#zoom");
const zoomOut = need<HTMLElement>("#zoom-out");
const drawSelect = need<HTMLSelectElement>("#draw");
const pairingSelect = need<HTMLSelectElement>("#pairing");
const scaleSelect = need<HTMLSelectElement>("#scale");
const autoInput = need<HTMLInputElement>("#auto");

function fail(message: string): void {
  canvas.remove();
  banner.hidden = false;
  banner.textContent = message;
}

const hud = createHud(hudRoot);
let app: App;

let running = true;
let frameId = 0;

function loop(): void {
  frameId = requestAnimationFrame(loop);
  app.advance();
  app.render();
  hud.update(app.stats());
}

function setRunning(next: boolean): void {
  if (next === running) return;
  running = next;
  toggleButton.textContent = running ? "Dur" : "Devam";
  if (running) frameId = requestAnimationFrame(loop);
  else cancelAnimationFrame(frameId);
}

toggleButton.addEventListener("click", () => setRunning(!running));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) setRunning(false);
});

const COUNTS: readonly number[] = [25_000, 100_000, 250_000];

function markActive(row: HTMLElement, value: string): void {
  for (const child of Array.from(row.children)) {
    child.classList.toggle("on", (child as HTMLElement).dataset["value"] === value);
  }
}

function wireControls(): void {
  let currentWord = WORDS[0];
  for (const word of WORDS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = word;
    button.dataset["value"] = word;
    button.addEventListener("click", () => {
      currentWord = word;
      autoInput.checked = false;
      app.setAutoCycle(false);
      app.setWord(word);
      markActive(wordRow, word);
    });
    wordRow.appendChild(button);
  }

  for (const count of COUNTS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${count / 1000}k`;
    button.dataset["value"] = String(count);
    button.addEventListener("click", () => {
      app.setCount(count);
      markActive(countRow, String(count));
    });
    countRow.appendChild(button);
  }
  markActive(countRow, String(DEFAULT_COUNT));

  // Aynı kelimeye geçmek her parçacığın kaynağını hedefine EŞİTLİYOR.
  // Shader'daki max(length(d), 1e-6) kelepçesi olmasa bulut NaN'a gidip kaybolurdu.
  againButton.addEventListener("click", () => {
    app.setWord(currentWord);
  });

  thresholdInput.value = String(DEFAULT_THRESHOLD);
  thresholdOut.textContent = String(DEFAULT_THRESHOLD);
  thresholdInput.addEventListener("input", () => {
    const value = Number(thresholdInput.value);
    thresholdOut.textContent = String(value);
    app.setThreshold(value);
  });

  spreadInput.value = String(DEFAULT_SPREAD);
  spreadOut.textContent = DEFAULT_SPREAD.toFixed(2);
  spreadInput.addEventListener("input", () => {
    const value = Number(spreadInput.value);
    spreadOut.textContent = value.toFixed(2);
    app.setSpread(value);
  });

  radiusInput.value = String(DEFAULT_RADIUS_PX);
  radiusOut.textContent = `${DEFAULT_RADIUS_PX} px`;
  radiusInput.addEventListener("input", () => {
    const value = Number(radiusInput.value);
    radiusOut.textContent = `${value} px`;
    app.setRadius(value);
  });

  zoomInput.value = "1";
  zoomOut.textContent = "1.0×";
  zoomInput.addEventListener("input", () => {
    const value = Number(zoomInput.value);
    zoomOut.textContent = `${value.toFixed(1)}×`;
    app.setZoom(value);
  });

  drawSelect.addEventListener("change", () => {
    app.setDrawMode(drawSelect.value as DrawMode);
  });

  pairingSelect.addEventListener("change", () => {
    app.setPairing(pairingSelect.value as PairingMode);
  });

  scaleSelect.value = String(DEFAULT_SCALE);
  scaleSelect.addEventListener("change", () => {
    app.setScale(Number(scaleSelect.value));
    app.resize();
  });

  autoInput.addEventListener("change", () => {
    app.setAutoCycle(autoInput.checked);
  });

  markActive(wordRow, currentWord);
}

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const measureMode = params.get("measure") === "1";
  const load = Math.max(1, Number(params.get("load") ?? "1") || 1);
  // Kare bütçesi override'ı yalnız duman testi için; kullanılan değer raporun
  // warmup/frames alanlarına yazıldığı için kısaltılmış koşu kendini ele veriyor.
  const positive = (name: string): number | undefined => {
    const raw = params.get(name);
    if (raw === null) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const font = await loadFont(`${import.meta.env.BASE_URL}fonts/Roboto-Regular.ttf`, "KptRoboto");
  if (font.fallback) {
    console.warn("Paketli font yüklenemedi; sistem fontuyla devam ediliyor.");
  }

  try {
    app = createApp(canvas, { fontFamily: font.family });
  } catch (error) {
    fail(`Bu tarayıcıda WebGL2 yok, demo çalışamaz. (${String(error)})`);
    throw error;
  }

  hud.setTimerSource(app.timer ? "gpu" : "raf");

  canvas.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      setRunning(false);
      banner.hidden = false;
      banner.textContent = "WebGL bağlamı kayboldu. Sayfayı yenileyin.";
      console.warn("webglcontextlost");
    },
    false,
  );

  if (measureMode) {
    document.body.classList.add("measuring");
    toggleButton.disabled = true;
    hud.setNote("Deterministik ölçüm koşuyor… (sekmeyi ön planda tutun)");
    running = false;
    const report = await runMeasurement(app, font, {
      load,
      warmup: positive("warmup"),
      frames: positive("frames"),
    });
    console.log(`MEASURE ${JSON.stringify(report)}`);
    hud.showMeasureReport(report);
    return;
  }

  wireControls();
  window.addEventListener("resize", () => app.resize());
  app.resize();
  frameId = requestAnimationFrame(loop);
}

boot().catch((error) => {
  if (!banner.hidden) return;
  fail(`Demo başlatılamadı: ${String(error)}`);
  console.warn(error);
});
