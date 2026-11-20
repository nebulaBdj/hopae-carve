import "./style.css";
import { TEX_H, loadBrushFont, normalizeName, previewName } from "./glyph";
import names from "./names.json";
import { Scorer, rankFor } from "./score";
import { composeShareImage, shareImage } from "./share";
import { CarveSound } from "./sound";
import { Stage } from "./stage";
import { makeWood } from "./wood";

// GA 이벤트 (이름 자체는 보내지 않는다)
const track = (event: string, params: Record<string, string | number> = {}) =>
  (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.("event", event, params);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const screens = { intro: $("intro"), carve: $("carve-hud"), result: $("result"), fallback: $("fallback") };
const show = (key: keyof typeof screens) => {
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== key;
};

const input = $<HTMLInputElement>("name-input");
const startBtn = $<HTMLButtonElement>("start");
const doneBtn = $<HTMLButtonElement>("done");
const progressBar = $("progress-bar");
const fontStatus = $("font-status");

const sound = new CarveSound();
const stage = new Stage($("stage"), makeWood(512, TEX_H, 2.5), sound);

let fontReady = false;
let current = { name: "", roman: null as string | null };
let scorer: Scorer | null = null;
let shareBlob: Promise<Blob> | null = null;

// 이름 고르기
const romanOf = (hangul: string) => names.find((n) => n.hangul === hangul)?.roman ?? null;
const validName = () => normalizeName(input.value) !== null;
const syncStart = () => {
  startBtn.disabled = !fontReady || !validName();
};

// 입력하는 대로 호패에 밑그림을 그린다 (글꼴이 준비된 뒤부터)
let shown: string | null = null;
const updatePreview = () => {
  if (!fontReady) return;
  const name = previewName(input.value);
  if (name === shown) return;
  shown = name;
  stage.setName(name);
};

// 이름 목록 시트
const finder = $("finder");
const openFinder = () => {
  finder.hidden = false;
  finder.classList.remove("closing");
};
const closeFinder = () => {
  finder.classList.add("closing");
  setTimeout(() => {
    if (finder.classList.contains("closing")) finder.hidden = true;
  }, 200);
};
$("open-finder").addEventListener("click", () => {
  track("name_list_open");
  openFinder();
});
for (const el of finder.querySelectorAll("[data-close]")) el.addEventListener("click", closeFinder);

const chips = $("name-chips");
for (const n of names) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  b.innerHTML = `<span class="chip-ko">${n.hangul}</span><span class="chip-en">${n.roman}</span>`;
  b.addEventListener("click", () => {
    input.value = n.hangul;
    $("name-error").hidden = true;
    syncStart();
    updatePreview();
    for (const other of chips.children) other.classList.toggle("on", other === b);
    closeFinder();
  });
  chips.appendChild(b);
}
// 옆으로 넘기는 이름 목록: 끝 표시, PC 마우스 휠도 옆으로
const syncChipsEnd = () => chips.classList.toggle("at-end", chips.scrollLeft + chips.clientWidth >= chips.scrollWidth - 4);
chips.addEventListener("scroll", syncChipsEnd, { passive: true });
chips.addEventListener(
  "wheel",
  (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    chips.scrollLeft += e.deltaY;
  },
  { passive: false },
);
input.addEventListener("input", () => {
  $("name-error").hidden = true;
  syncStart();
  updatePreview();
});

// 이름 사이트에서 ?name=다솜 으로 넘어오면 미리 채운다
const fromUrl = new URLSearchParams(location.search).get("name");
if (fromUrl && normalizeName(fromUrl)) input.value = fromUrl;

void loadBrushFont().then((ok) => {
  fontReady = true;
  fontStatus.textContent = ok ? "" : "Brush font didn't load — using a basic font.";
  fontStatus.hidden = ok;
  syncStart();
  updatePreview();
});

$("name-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = normalizeName(input.value);
  if (!name) {
    $("name-error").hidden = false;
    return;
  }
  input.blur();
  track("carve_start", { name_type: /^[A-Z]+$/.test(name) ? "initials" : "hangul" });
  startCarving(name);
});

function startCarving(name: string) {
  current = { name, roman: romanOf(name) };
  scorer = new Scorer(name);
  shareBlob = null;
  stage.setName(name);
  stage.setMode("carve");
  $("hud-name").textContent = current.roman ? `${name} · ${current.roman}` : name;
  progressBar.style.width = "0%";
  doneBtn.disabled = true;
  show("carve");
}

stage.canCarve = (x, y) => scorer?.near(x, y) ?? true;
stage.grabHint = $("grab-hint");

// 새기는 동안 진행도
stage.onProgress = () => {
  if (!scorer) return;
  const { coverage } = scorer.measure(stage.surface.mask);
  progressBar.style.width = `${Math.min(100, (coverage / 0.9) * 100)}%`;
  doneBtn.disabled = coverage < 0.15;
};

$("reset").addEventListener("click", () => startCarving(current.name));

const muteBtn = $<HTMLButtonElement>("mute");
muteBtn.addEventListener("click", () => {
  sound.muted = !sound.muted;
  muteBtn.textContent = sound.muted ? "🔇" : "🔊";
  muteBtn.setAttribute("aria-label", sound.muted ? "Sound on" : "Sound off");
});

doneBtn.addEventListener("click", () => {
  if (!scorer) return;
  const { score } = scorer.measure(stage.surface.mask);
  const rank = rankFor(score);
  track("carve_done", { score });
  stage.finish();
  show("result");
  countUp($("score"), score);
  $("rank").textContent = rank;
  // 공유 시트는 누른 순간 열어야 해서 이미지를 미리 만든다 (먹 채우기 연출이 끝난 뒤)
  shareBlob = new Promise((resolve, reject) =>
    setTimeout(() => {
      composeShareImage(stage.snapshot(), current.name, current.roman, score, rank).then(resolve, reject);
    }, 1300),
  );
});

function countUp(el: HTMLElement, to: number) {
  const start = performance.now();
  const step = () => {
    const p = Math.min(1, (performance.now() - start) / 900);
    el.textContent = `${Math.round(to * (1 - Math.pow(1 - p, 3)))}%`;
    if (p < 1) requestAnimationFrame(step);
  };
  step();
}

$("save").addEventListener("click", async () => {
  if (!shareBlob) return;
  const blob = await shareBlob;
  if (await shareImage(blob)) {
    track("hopae_save", { method: "share" });
    return;
  }
  track("hopae_save", { method: "long_press" });
  const img = $<HTMLImageElement>("fallback-img");
  if (img.src) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(blob);
  show("fallback");
});
$("fallback-back").addEventListener("click", () => show("result"));
$("again").addEventListener("click", () => startCarving(current.name));
$("new-name").addEventListener("click", () => {
  shown = null;
  updatePreview();
  stage.setMode("showcase");
  show("intro");
});

stage.setMode("showcase");
show("intro");
