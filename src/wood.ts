// 절차적 나무결: 같은 결 무늬로 겉면(오래된 색)과 속살(새로 깎인 밝은 색) 두 장을 만든다

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Noise2 = (x: number, y: number) => number;

// 값 노이즈 (0~1)
function valueNoise(seed: number): Noise2 {
  const rand = mulberry32(seed);
  const size = 256;
  const values = new Float32Array(size * size);
  for (let i = 0; i < values.length; i++) values[i] = rand();
  const at = (x: number, y: number) => values[(x & 255) + (y & 255) * size];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * u;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * u;
    return a + (b - a) * v;
  };
}

function fbm(noise: Noise2, x: number, y: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
}

type Palette = { light: [number, number, number]; dark: [number, number, number] };

const SURFACE: Palette = { light: [196, 150, 98], dark: [128, 84, 46] };
const INNER: Palette = { light: [236, 205, 152], dark: [206, 162, 106] };

export type WoodSet = { surface: HTMLCanvasElement; inner: HTMLCanvasElement };

// 세로로 길게 켠 판재 결. aspect = 세로/가로 (호패 2.5)
export function makeWood(width: number, height: number, aspect: number, seed = 7): WoodSet {
  const noise = valueNoise(seed);
  const fine = valueNoise(seed + 11);
  const surface = document.createElement("canvas");
  const inner = document.createElement("canvas");
  for (const c of [surface, inner]) {
    c.width = width;
    c.height = height;
  }
  const sImg = surface.getContext("2d")!.createImageData(width, height);
  const iImg = inner.getContext("2d")!.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    const v = (y / height) * aspect;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      // 나이테가 세로로 흐르며 살짝 휘는 결. 한 테 안에서 밝은 이른재 → 진한 늦재로 서서히, 경계는 또렷하게
      const warp = fbm(noise, u * 1.3, v * 0.28, 4) * 3 + Math.sin(v * 1.3 + u * 2.2) * 0.15;
      const ring = u * (5.5 + fbm(noise, 9, v * 0.2, 2) * 2) + warp;
      const band = ring - Math.floor(ring);
      const late = Math.pow(band, 3.2);
      const fiber = fine(u * 260, v * 6) - 0.5; // 가는 섬유
      const pore = fine(u * 600, v * 70) > 0.88 ? 0.22 : 0; // 작은 물관 점
      const shade = 0.93 + 0.14 * (fbm(noise, u * 2.5 + 40, v * 0.9, 3) - 0.5);
      const t = Math.min(1, late * 0.55 + pore * 0.4 + fiber * 0.14 + 0.1);

      const i = (y * width + x) * 4;
      for (let k = 0; k < 3; k++) {
        sImg.data[i + k] = (SURFACE.light[k] + (SURFACE.dark[k] - SURFACE.light[k]) * t) * shade;
        iImg.data[i + k] = (INNER.light[k] + (INNER.dark[k] - INNER.light[k]) * t * 0.8) * (0.96 + (shade - 0.9) * 0.4);
      }
      sImg.data[i + 3] = 255;
      iImg.data[i + 3] = 255;
    }
  }
  surface.getContext("2d")!.putImageData(sImg, 0, 0);
  inner.getContext("2d")!.putImageData(iImg, 0, 0);
  return { surface, inner };
}
