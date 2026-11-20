import * as THREE from "three";

const MAX = 220;
const GRAVITY = -3.2;

type Chip = { pos: THREE.Vector3; vel: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3; life: number; scale: number };

// 깎을 때 튀는 동그랗게 말린 나무 부스러기
export class Chips {
  readonly mesh: THREE.InstancedMesh;
  private chips: Chip[] = [];
  private dummy = new THREE.Object3D();
  private next = 0;

  constructor() {
    const curl = new THREE.TorusGeometry(0.014, 0.0045, 4, 10, Math.PI * 1.4);
    const mat = new THREE.MeshStandardMaterial({ color: 0xecc995, roughness: 0.8 });
    this.mesh = new THREE.InstancedMesh(curl, mat, MAX);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < MAX; i++) {
      this.chips.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), life: 0, scale: 0 });
      this.hide(i);
    }
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  private hide(i: number) {
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  // at: 칼끝(월드), normal: 면 바깥 방향, back: 칼이 움직인 반대 방향
  spawn(at: THREE.Vector3, normal: THREE.Vector3, back: THREE.Vector3, count: number) {
    for (let n = 0; n < count; n++) {
      const c = this.chips[this.next];
      this.next = (this.next + 1) % MAX;
      c.pos.copy(at);
      c.vel
        .copy(normal)
        .multiplyScalar(0.5 + Math.random() * 0.8)
        .addScaledVector(back, 0.4 + Math.random() * 0.6)
        .add(new THREE.Vector3((Math.random() - 0.5) * 0.9, Math.random() * 0.6, 0));
      c.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      c.spin.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
      c.life = 0.9 + Math.random() * 0.5;
      c.scale = 0.6 + Math.random() * 0.9;
    }
  }

  update(dt: number) {
    for (let i = 0; i < MAX; i++) {
      const c = this.chips[i];
      if (c.life <= 0) continue;
      c.life -= dt;
      if (c.life <= 0) {
        this.hide(i);
        continue;
      }
      c.vel.y += GRAVITY * dt;
      c.vel.multiplyScalar(1 - 1.2 * dt);
      c.pos.addScaledVector(c.vel, dt);
      c.rot.x += c.spin.x * dt;
      c.rot.y += c.spin.y * dt;
      c.rot.z += c.spin.z * dt;
      this.dummy.position.copy(c.pos);
      this.dummy.rotation.copy(c.rot);
      this.dummy.scale.setScalar(c.scale * Math.min(1, c.life * 3));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
