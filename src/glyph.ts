// 호패 앞면 텍스처(512×1280) 위의 이름 글자 배치와 그리기
export const TEX_W = 512;
export const TEX_H = 1280;

const FONT_URL = "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_20-04@1.0/ChosunGs.woff";
let family = "ChosunGs";

// 조선궁서체. 불러오지 못하면 기본 명조로 그린다
export async function loadBrushFont(): Promise<boolean> {
  try {
    const face = new FontFace("ChosunGs", `url(${FONT_URL}) format("woff")`);
    await face.load();
    document.fonts.add(face);
    return true;
  } catch {
    family = "serif";
    return false;
  }
}

export const brushFamily = () => family;

// 한글 1~3자, 또는 영어 이니셜 1~3자 (d.j. · D J → DJ)
export function normalizeName(raw: string): string | null {
  const t = raw.trim();
  if (/^[가-힣]{1,3}$/.test(t)) return t;
  const initials = t.replace(/[\s.\-·]/g, "").toUpperCase();
  return /^[A-Z]{1,3}$/.test(initials) ? initials : null;
}

// 입력 중 호패 미리보기: 다 조합된 한글만(조합 중인 자모는 건너뜀), 없으면 영문 앞 3자
export function previewName(raw: string): string {
  const hangul = [...raw].filter((c) => /[가-힣]/.test(c)).join("").slice(0, 3);
  if (hangul) return hangul;
  return raw.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3);
}

type Cell = { ch: string; x: number; y: number; size: number };

// 구멍 아래부터 세로로 한 글자씩
export function layoutName(name: string): Cell[] {
  const chars = [...name];
  const top = 215;
  const bottom = 1215;
  const cell = (bottom - top) / chars.length;
  const size = Math.min(cell * 1.02, 470);
  return chars.map((ch, i) => ({ ch, x: TEX_W / 2, y: top + cell * (i + 0.5), size }));
}

// 글자의 실제 잉크 영역이 칸 가운데 오게 그린다
function eachGlyph(ctx: CanvasRenderingContext2D, name: string, draw: (ch: string, x: number, y: number) => void) {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (const { ch, x, y, size } of layoutName(name)) {
    ctx.font = `${size}px "${family}"`;
    let m = ctx.measureText(ch);
    // 가로가 판을 넘치면 줄인다
    const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    if (inkW > TEX_W * 0.8) {
      ctx.font = `${(size * TEX_W * 0.8) / inkW}px "${family}"`;
      m = ctx.measureText(ch);
    }
    draw(ch, x, y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  }
}

// 연필로 밑그림 그린 듯한 안내선
export function drawGuide(ctx: CanvasRenderingContext2D, name: string, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = "round";
  eachGlyph(ctx, name, (ch, x, y) => {
    ctx.fillStyle = "rgba(48, 30, 16, 0.2)";
    ctx.fillText(ch, x, y);
    ctx.strokeStyle = "rgba(48, 30, 16, 0.6)";
    ctx.lineWidth = 2.5;
    ctx.strokeText(ch, x, y);
  });
  ctx.restore();
}

// 채점용 글자 모양. tolerance(px)만큼 바깥으로 넓힐 수 있다
export function drawMask(ctx: CanvasRenderingContext2D, name: string, tolerance = 0) {
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.lineJoin = "round";
  ctx.lineWidth = tolerance * 2;
  eachGlyph(ctx, name, (ch, x, y) => {
    ctx.fillText(ch, x, y);
    if (tolerance > 0) ctx.strokeText(ch, x, y);
  });
  ctx.restore();
}
