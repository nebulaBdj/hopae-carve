import { TEX_H, TEX_W, drawMask } from "./glyph";

// 1/4 크기로 줄여 픽셀을 센다
const SW = TEX_W / 4;
const SH = TEX_H / 4;
const TOLERANCE = 12; // 글자 밖으로 이만큼(px)은 벗어나도 감점하지 않는다

function small(): CanvasRenderingContext2D {
  const c = document.createElement("canvas");
  c.width = SW;
  c.height = SH;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.scale(SW / TEX_W, SH / TEX_H);
  return ctx;
}

const filled = (ctx: CanvasRenderingContext2D) => {
  const data = ctx.getImageData(0, 0, SW, SH).data;
  const out = new Uint8Array(SW * SH);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 3] > 110 ? 1 : 0;
  return out;
};

export type Match = { coverage: number; spill: number; score: number };

// 글자 일치율 = 글자를 얼마나 팠나 − 글자 밖을 얼마나 팠나
export class Scorer {
  private glyph: Uint8Array;
  private allowed: Uint8Array;
  private glyphCount: number;
  private work = small();

  constructor(name: string) {
    const g = small();
    drawMask(g, name);
    this.glyph = filled(g);
    const a = small();
    drawMask(a, name, TOLERANCE);
    this.allowed = filled(a);
    this.glyphCount = Math.max(1, this.glyph.reduce((s, v) => s + v, 0));
  }

  // 텍스처 (x, y)가 글자 자리(조금 넉넉하게)인지
  near(x: number, y: number): boolean {
    const i = Math.floor(y / 4) * SW + Math.floor(x / 4);
    return x >= 0 && y >= 0 && x < TEX_W && y < TEX_H && this.allowed[i] === 1;
  }

  measure(mask: HTMLCanvasElement): Match {
    this.work.clearRect(0, 0, TEX_W, TEX_H);
    this.work.drawImage(mask, 0, 0);
    const carved = filled(this.work);
    let hit = 0;
    let outside = 0;
    for (let i = 0; i < carved.length; i++) {
      if (!carved[i]) continue;
      if (this.glyph[i]) hit++;
      else if (!this.allowed[i]) outside++;
    }
    const coverage = hit / this.glyphCount;
    const spill = outside / this.glyphCount;
    // 가장자리 몇 픽셀까지 다 파야 100이 되진 않게 90% 덮으면 만점으로 본다
    const score = Math.round(100 * Math.max(0, Math.min(1, coverage / 0.9) - spill * 0.8));
    return { coverage, spill, score: Math.min(100, score) };
  }
}

export function rankFor(score: number): string {
  if (score >= 90) return "명장 · Master carver";
  if (score >= 75) return "숙련 · Skilled carver";
  if (score >= 50) return "견습 · Apprentice";
  return "입문 · First cut";
}
