import * as THREE from "three";
import { CarveSurface } from "./carve";
import { Chips } from "./chips";
import { TEX_H, TEX_W } from "./glyph";
import { HOPAE, createHopae, type HopaeMesh } from "./hopae";
import { createKnife } from "./knife";
import type { CarveSound } from "./sound";
import type { WoodSet } from "./wood";

export type Mode = "showcase" | "carve" | "result";

const KNIFE_RADIUS = 17; // 칼 폭 (텍스처 px)
const FOV = 32;

// 모드별 화면 배치: 호패가 화면 높이의 fill만큼, 중심은 화면 아래에서 at 지점
const LAYOUT: Record<Mode, { fill: number; fillW: number; at: number }> = {
  showcase: { fill: 0.36, fillW: 0.5, at: 0.73 },
  carve: { fill: 0.7, fillW: 0.84, at: 0.47 },
  result: { fill: 0.54, fillW: 0.7, at: 0.5 },
};

const KNIFE_DIR = new THREE.Vector3(0.42, -0.5, 0.76).normalize();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const REVEAL_DELAY = 1150; // 먹 채우기(1100ms)가 끝난 뒤
const REVEAL_SPIN = 1700;

export class Stage {
  readonly surface: CarveSurface;
  onProgress?: () => void;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  private camTarget = new THREE.Vector3(0, 0, 8);
  private hopae: HopaeMesh;
  private colorTex: THREE.CanvasTexture;
  private bumpTex: THREE.CanvasTexture;
  private knife = createKnife();
  private knifeTip = new THREE.Vector3(0.75, -1.05, 0.25);
  private knifeQuat = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, KNIFE_DIR);
  private chips = new Chips();
  private raycaster = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private mode: Mode = "showcase";
  private dirty = true;
  private scoreDirty = false;
  private lastScoreAt = 0;
  private pointerId: number | null = null;
  private last: { x: number; y: number; t: number; world: THREE.Vector3 } | null = null;
  private lastBuzz = 0;
  private finishing: { start: number } | null = null;
  private reveal: { start: number } | null = null; // 완성 후 한 바퀴 돌고 정면에 멈춤

  constructor(private container: HTMLElement, wood: WoodSet, private sound: CarveSound) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.surface = new CarveSurface(wood);
    this.surface.reset("");
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.colorTex = new THREE.CanvasTexture(this.surface.color);
    this.colorTex.colorSpace = THREE.SRGBColorSpace;
    this.colorTex.anisotropy = maxAniso;
    this.bumpTex = new THREE.CanvasTexture(this.surface.bump);
    this.bumpTex.anisotropy = maxAniso;

    const sideTex = new THREE.CanvasTexture(wood.surface);
    sideTex.colorSpace = THREE.SRGBColorSpace;
    sideTex.wrapS = sideTex.wrapT = THREE.RepeatWrapping;
    sideTex.repeat.set(1, 0.4);

    const front = new THREE.MeshStandardMaterial({ map: this.colorTex, bumpMap: this.bumpTex, bumpScale: 5, roughness: 0.74 });
    const body = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.8, color: 0xd9c2a0 });
    this.hopae = createHopae(front, body);
    this.scene.add(this.hopae.group, this.knife, this.chips.mesh);

    this.scene.add(new THREE.HemisphereLight(0xfff3dd, 0x6b4a2e, 1.4));
    const key = new THREE.DirectionalLight(0xfff1dc, 2.6);
    key.position.set(-2.2, 3, 3.2); // 비스듬한 빛이라야 홈의 그림자가 산다
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.5);
    fill.position.set(2.5, -1, 2);
    this.scene.add(key, fill);

    this.knife.visible = false;
    this.bindPointer();
    new ResizeObserver(() => this.fit()).observe(container);
    this.fit();
    this.camera.position.copy(this.camTarget);
    this.renderer.setAnimationLoop(() => this.tick());
  }

  setMode(mode: Mode) {
    this.mode = mode;
    this.hopae.tassel.visible = mode !== "carve";
    this.knife.visible = mode === "carve";
    if (mode === "carve") this.hopae.group.rotation.set(0, 0, 0);
    if (mode !== "result") this.reveal = null;
    this.fit();
  }

  setName(name: string) {
    this.finishing = null;
    this.surface.reset(name);
    this.dirty = true;
  }

  // 완성 연출 시작: 밑그림이 지워지고 홈에 먹이 찬다
  finish() {
    this.sound.tock();
    this.finishing = { start: performance.now() };
    this.setMode("result");
    this.reveal = { start: performance.now() + REVEAL_DELAY };
  }

  private fit() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const { fill, fillW, at } = LAYOUT[this.mode];
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const dist = Math.max(HOPAE.h / fill / 2 / tan, HOPAE.w / fillW / 2 / (tan * this.camera.aspect));
    const visible = 2 * dist * tan;
    this.camTarget.set(0, -(at - 0.5) * visible, dist);
  }

  private bindPointer() {
    const el = this.renderer.domElement;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", (e) => {
      if (this.mode !== "carve" || this.pointerId !== null) return;
      this.sound.unlock();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // 캡처를 못 해도 새기기는 된다
      }
      this.pointerId = e.pointerId;
      this.last = null;
      this.carveAt(e.clientX, e.clientY, e.timeStamp);
    });
    el.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.pointerId) return;
      const events = e.getCoalescedEvents?.() ?? [e];
      for (const ev of events.length ? events : [e]) this.carveAt(ev.clientX, ev.clientY, ev.timeStamp);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.last = null;
      this.sound.stop();
      this.scoreDirty = true;
      this.lastScoreAt = 0;
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  private carveAt(clientX: number, clientY: number, t: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.hopae.front, false)[0];
    if (!hit?.uv) {
      this.last = null;
      this.sound.stop();
      return;
    }
    const x = hit.uv.x * TEX_W;
    const y = (1 - hit.uv.y) * TEX_H;
    const world = hit.point.clone();
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(this.hopae.group.quaternion);

    if (this.last) {
      const dist = Math.hypot(x - this.last.x, y - this.last.y);
      if (dist < 0.5) return;
      this.surface.carve(this.last.x, this.last.y, x, y, KNIFE_RADIUS);
      this.sound.scrape(dist / Math.max(1, t - this.last.t));
      const back = this.last.world.clone().sub(world).normalize();
      this.chips.spawn(world, normal, back, Math.min(5, Math.ceil(dist / 7)));
      // 칼이 움직인 반대쪽으로 손잡이가 살짝 눕는다
      this.knifeQuat.setFromUnitVectors(Y_AXIS, KNIFE_DIR.clone().addScaledVector(back, 0.35).normalize());
      if (t - this.lastBuzz > 70) {
        navigator.vibrate?.(6);
        this.lastBuzz = t;
      }
    } else {
      this.surface.carve(x, y, x, y, KNIFE_RADIUS);
      this.sound.bite();
    }
    this.knifeTip.copy(world).addScaledVector(normal, 0.003);
    this.last = { x, y, t, world };
    this.dirty = true;
    this.scoreDirty = true;
  }

  private tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = this.clock.elapsedTime;

    this.camera.position.lerp(this.camTarget, 1 - Math.pow(0.002, dt));
    this.camera.lookAt(0, this.camera.position.y, 0);

    const g = this.hopae.group;
    if (this.reveal) {
      // 먹이 다 찬 뒤 한 바퀴 돌고, 살짝 지나쳤다가 정면에서 멈춘다
      const t = (performance.now() - this.reveal.start) / REVEAL_SPIN;
      if (t >= 1) {
        g.rotation.set(0, 0, 0);
        this.reveal = null;
      } else {
        const p = Math.max(0, t);
        const c = 0.9;
        const q = p - 1;
        g.rotation.y = Math.PI * 2 * (1 + (c + 1) * q * q * q + c * q * q);
        g.rotation.z = Math.sin(p * Math.PI * 3) * 0.04 * (1 - p);
      }
    } else if (this.mode !== "showcase") {
      // 새길 때와 완성 화면은 정면 고정 (완성 화면은 폰을 들고 사진 찍기 좋게)
      g.rotation.y += (0 - g.rotation.y) * Math.min(1, dt * 6);
      g.rotation.z += (0 - g.rotation.z) * Math.min(1, dt * 6);
    } else {
      // 끈에 매달린 듯 천천히 흔들린다
      g.rotation.y = Math.sin(time * 0.8) * 0.55;
      g.rotation.z = Math.sin(time * 1.3) * 0.03;
    }

    if (this.knife.visible) {
      if (this.pointerId === null) {
        this.knifeTip.lerp(new THREE.Vector3(0.7, -0.98, 0.3), Math.min(1, dt * 5));
        this.knifeQuat.slerp(new THREE.Quaternion().setFromUnitVectors(Y_AXIS, KNIFE_DIR), Math.min(1, dt * 5));
      }
      this.knife.position.lerp(this.knifeTip, this.pointerId === null ? 1 : 0.6);
      this.knife.quaternion.slerp(this.knifeQuat, 0.25);
    }
    this.chips.update(dt);

    if (this.finishing) {
      const p = Math.min(1, (performance.now() - this.finishing.start) / 1100);
      this.surface.finish(p * p * (3 - 2 * p));
      this.dirty = true;
      if (p >= 1) this.finishing = null;
    }
    if (this.dirty) {
      this.colorTex.needsUpdate = true;
      this.bumpTex.needsUpdate = true;
      this.dirty = false;
    }
    if (this.scoreDirty && performance.now() - this.lastScoreAt > 250) {
      this.scoreDirty = false;
      this.lastScoreAt = performance.now();
      this.onProgress?.();
    }
    this.renderer.render(this.scene, this.camera);
  }

  // 저장용: 지금 장면을 그려 호패 부분만 잘라 낸다 (그린 직후라야 캔버스를 읽을 수 있다)
  snapshot(): HTMLCanvasElement {
    const g = this.hopae.group;
    const saved = g.rotation.clone();
    g.rotation.set(0, 0, 0);
    this.camera.position.copy(this.camTarget);
    this.camera.lookAt(0, this.camera.position.y, 0);
    this.chips.mesh.visible = false;
    g.updateMatrixWorld(true);
    this.renderer.render(this.scene, this.camera);

    const box = new THREE.Box3().setFromObject(g);
    const canvas = this.renderer.domElement;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const p = new THREE.Vector3(x, y, z).project(this.camera);
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
    const pad = 0.02;
    const sx = Math.max(0, ((minX - pad + 1) / 2) * canvas.width);
    const ex = Math.min(canvas.width, ((maxX + pad + 1) / 2) * canvas.width);
    const sy = Math.max(0, ((1 - (maxY + pad)) / 2) * canvas.height);
    const ey = Math.min(canvas.height, ((1 - (minY - pad)) / 2) * canvas.height);
    const out = document.createElement("canvas");
    out.width = Math.round(ex - sx);
    out.height = Math.round(ey - sy);
    out.getContext("2d")!.drawImage(canvas, sx, sy, ex - sx, ey - sy, 0, 0, out.width, out.height);

    g.rotation.copy(saved);
    this.chips.mesh.visible = true;
    return out;
  }
}
