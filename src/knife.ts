import * as THREE from "three";

// 조각칼: 칼끝이 원점, 손잡이는 +Y 쪽으로 뻗는다
export function createKnife(): THREE.Group {
  const knife = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xd4d7dc, metalness: 0.95, roughness: 0.28 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 0.9, roughness: 0.35 });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x8a3a22, roughness: 0.45 });

  // 끝이 V자로 갈린 날
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.05, 4), steel);
  tip.rotation.y = Math.PI / 4;
  tip.position.y = 0.025;
  tip.rotation.x = Math.PI; // 뾰족한 쪽이 원점
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.2, 0.012), steel);
  blade.position.y = 0.05 + 0.1;
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.045, 20), brass);
  ferrule.position.y = 0.25 + 0.0225;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.4, 20), handleMat);
  handle.position.y = 0.295 + 0.2;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.032, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), handleMat);
  cap.position.y = 0.695;

  knife.add(tip, blade, ferrule, handle, cap);
  return knife;
}
