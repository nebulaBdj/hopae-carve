import { TEX_H, TEX_W, drawGuide } from "./glyph";
import type { WoodSet } from "./wood";

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = TEX_W;
  c.height = TEX_H;
  return [c, c.getContext("2d", { willReadFrequently: false })!];
}

const INK = "#2a170c";

// 새기는 면: 색(나무+밑그림+파인 속살), 높이(범프), 판 자리(채점용) 세 장을 같이 그린다
export class CarveSurface {
  readonly color: HTMLCanvasElement;
  readonly bump: HTMLCanvasElement;
  readonly mask: HTMLCanvasElement;
  private colorCtx: CanvasRenderingContext2D;
  private bumpCtx: CanvasRenderingContext2D;
  private maskCtx: CanvasRenderingContext2D;
  private innerPattern: CanvasPattern;
  private name = "";

  constructor(private wood: WoodSet) {
    [this.color, this.colorCtx] = canvas();
    [this.bump, this.bumpCtx] = canvas();
    [this.mask, this.maskCtx] = canvas();
    this.innerPattern = this.colorCtx.createPattern(wood.inner, "no-repeat")!;
  }

  // 새 이름: 나무 + 밑그림, 파인 곳 없음
  reset(name: string) {
    this.name = name;
    this.colorCtx.globalCompositeOperation = "source-over";
    this.colorCtx.globalAlpha = 1;
    this.colorCtx.drawImage(this.wood.surface, 0, 0);
    if (name) drawGuide(this.colorCtx, name);
    this.bumpCtx.globalCompositeOperation = "source-over";
    this.bumpCtx.fillStyle = "#fff";
    this.bumpCtx.fillRect(0, 0, TEX_W, TEX_H);
    this.maskCtx.clearRect(0, 0, TEX_W, TEX_H);
  }

  // 칼이 (x0,y0)→(x1,y1) 지나간 자리를 판다. 겹칠수록 V자 홈이 매끈해진다
  carve(x0: number, y0: number, x1: number, y1: number, radius: number) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / (radius * 0.3)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.stamp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius);
    }
  }

  private stamp(x: number, y: number, r: number) {
    const c = this.colorCtx;
    c.fillStyle = this.innerPattern;
    c.beginPath();
    c.arc(x, y, r * 0.92, 0, Math.PI * 2);
    c.fill();

    const b = this.bumpCtx;
    b.globalCompositeOperation = "darken";
    const g = b.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgb(30,30,30)");
    g.addColorStop(0.55, "rgb(120,120,120)");
    g.addColorStop(1, "rgb(255,255,255)");
    b.fillStyle = g;
    b.beginPath();
    b.arc(x, y, r, 0, Math.PI * 2);
    b.fill();

    const m = this.maskCtx;
    m.fillStyle = "#000";
    m.beginPath();
    m.arc(x, y, r * 0.92, 0, Math.PI * 2);
    m.fill();
  }

  // 완성 연출: 밑그림을 지우고 파인 홈에 먹을 채운다 (p: 0→1)
  finish(p: number) {
    const c = this.colorCtx;
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
    c.drawImage(this.wood.surface, 0, 0);
    if (this.name) drawGuide(c, this.name, 1 - p);

    const [tmp, t] = canvas();
    t.drawImage(this.mask, 0, 0);
    t.globalCompositeOperation = "source-in";
    t.drawImage(this.wood.inner, 0, 0);
    c.drawImage(tmp, 0, 0);

    t.globalCompositeOperation = "source-over";
    t.clearRect(0, 0, TEX_W, TEX_H);
    t.drawImage(this.mask, 0, 0);
    t.globalCompositeOperation = "source-in";
    t.fillStyle = INK;
    t.fillRect(0, 0, TEX_W, TEX_H);
    c.globalAlpha = p * 0.9;
    c.drawImage(tmp, 0, 0);
    c.globalAlpha = 1;
  }
}
