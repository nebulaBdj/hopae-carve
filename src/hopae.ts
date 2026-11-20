import * as THREE from "three";

// 호패 크기 (월드 단위). 앞면 텍스처 512×1280과 같은 1:2.5
export const HOPAE = { w: 1, h: 2.5, depth: 0.1, bevel: 0.016, holeY: 1.07, holeR: 0.055 };
export const FRONT_Z = HOPAE.depth / 2 + HOPAE.bevel + 0.0008;

// 위가 둥근 긴 판 + 끈 구멍
function hopaeShape(): THREE.Shape {
  const { w, h } = HOPAE;
  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -h / 2;
  const y1 = h / 2;
  const rb = 0.05;
  const rt = 0.3;
  const s = new THREE.Shape();
  s.moveTo(x0 + rb, y0);
  s.lineTo(x1 - rb, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + rb);
  s.lineTo(x1, y1 - rt);
  s.quadraticCurveTo(x1, y1, x1 - rt, y1);
  s.lineTo(x0 + rt, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - rt);
  s.lineTo(x0, y0 + rb);
  s.quadraticCurveTo(x0, y0, x0 + rb, y0);
  const hole = new THREE.Path();
  hole.absarc(0, HOPAE.holeY, HOPAE.holeR, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

export type HopaeMesh = { group: THREE.Group; front: THREE.Mesh; tassel: THREE.Group };

export function createHopae(front: THREE.Material, body: THREE.Material): HopaeMesh {
  const shape = hopaeShape();
  const group = new THREE.Group();

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: HOPAE.depth,
    bevelEnabled: true,
    bevelThickness: HOPAE.bevel,
    bevelSize: HOPAE.bevel,
    bevelSegments: 3,
    curveSegments: 32,
  });
  bodyGeo.translate(0, 0, -HOPAE.depth / 2);
  group.add(new THREE.Mesh(bodyGeo, body));

  // 앞면은 따로: UV를 0~1로 맞춰 텍스처 한 장을 그대로 덮는다
  const frontGeo = new THREE.ShapeGeometry(shape, 32);
  const pos = frontGeo.attributes.position;
  const uv = frontGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + HOPAE.w / 2) / HOPAE.w, (pos.getY(i) + HOPAE.h / 2) / HOPAE.h);
  }
  uv.needsUpdate = true;
  const frontMesh = new THREE.Mesh(frontGeo, front);
  frontMesh.position.z = FRONT_Z;
  group.add(frontMesh);

  const tassel = createTassel();
  tassel.visible = false;
  group.add(tassel);
  return { group, front: frontMesh, tassel };
}

// 완성 화면: 구멍에 꿴 붉은 끈과 술
function createTassel(): THREE.Group {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.6 });
  const top = HOPAE.holeY;
  const loop = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, top, 0.09),
    new THREE.Vector3(0.02, top + 0.25, 0.06),
    new THREE.Vector3(0, top + 0.55, 0),
    new THREE.Vector3(-0.02, top + 0.25, -0.06),
    new THREE.Vector3(0, top, -0.09),
    new THREE.Vector3(0, top - 0.02, 0),
  ], true);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(loop, 64, 0.012, 8, true), red));

  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), red);
  knot.position.set(-0.68, top - 0.12, 0.02);
  const cord = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, top + 0.02, 0.07),
    new THREE.Vector3(-0.4, top + 0.06, 0.08),
    knot.position.clone(),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(cord, 32, 0.01, 8, false), red));
  g.add(knot);
  const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.5, 18, 1, true), red);
  brush.position.set(-0.68, top - 0.4, 0.02);
  g.add(brush);
  return g;
}
