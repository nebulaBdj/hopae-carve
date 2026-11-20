import { brushFamily } from "./glyph";

const W = 1080;
const H = 1920;

const loadUiFont = () => document.fonts.load('700 40px "Gowun Batang"').catch(() => []);

// 스토리용 1080×1920: 제목 → 호패 → 이름·일치율 → 안내
export async function composeShareImage(hopae: HTMLCanvasElement, name: string, roman: string | null, score: number, rank: string): Promise<Blob> {
  await loadUiFont();
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#f4ead7");
  bg.addColorStop(1, "#e2d1b3");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#2a170c";
  ctx.font = '700 46px "Gowun Batang", serif';
  ctx.fillText("MY HOPAE · 나의 호패", W / 2, 170);

  // 호패: 가로 세로 한도 안에서 최대로
  const maxW = 760;
  const maxH = 1300;
  const scale = Math.min(maxW / hopae.width, maxH / hopae.height);
  const hw = hopae.width * scale;
  const hh = hopae.height * scale;
  ctx.drawImage(hopae, (W - hw) / 2, 210 + (maxH - hh) / 2, hw, hh);

  ctx.font = `120px "${brushFamily()}", serif`;
  ctx.fillText(name, W / 2, 1600);
  if (roman) {
    ctx.font = '700 40px "Gowun Batang", serif';
    ctx.fillText(roman, W / 2, 1660);
  }
  ctx.fillStyle = "#b3261e";
  ctx.font = '700 44px "Gowun Batang", serif';
  ctx.fillText(`Match ${score}% · ${rank}`, W / 2, 1745);
  ctx.fillStyle = "#5a4430";
  ctx.font = '400 32px "Gowun Batang", serif';
  ctx.fillText("Carved at Seoul Yolk photo booth · @seoul.yolk", W / 2, 1830);

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG 생성 실패"))), "image/png"));
}

// 인스타·페북·카톡 등 앱 안 브라우저
export const isInAppBrowser = () => /Instagram|FBAN|FBAV|KAKAOTALK|Line\//i.test(navigator.userAgent);

// 공유 시트(사진 저장 포함)를 열고, 안 되면 false
export async function shareImage(blob: Blob): Promise<boolean> {
  const file = new File([blob], "my-hopae.png", { type: "image/png" });
  if (isInAppBrowser() || !navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file] });
  } catch {
    // 사용자가 닫음
  }
  return true;
}
