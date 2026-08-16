import * as THREE from "three";

const mat = (color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...opts });

export const GOLD = mat(0xffc93c, { metalness: 0.9, roughness: 0.22, emissive: 0x3a2400, emissiveIntensity: 0.5 });
const WOOD = mat(0x6b3f22, { roughness: 0.8 });
const WOOD_DARK = mat(0x4a2a16, { roughness: 0.85 });
const RED = mat(0xb3161f, { roughness: 0.7 });
const CREAM = mat(0xf6e4c8, { roughness: 0.75 });
const VELVET = mat(0x8c0d1a, { roughness: 0.95 });
const BULB = new THREE.MeshStandardMaterial({
  color: 0xfff2c4,
  emissive: 0xffcf6b,
  emissiveIntensity: 0.5,
  roughness: 0.3,
});

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  b.castShadow = true;
  b.receiveShadow = true;
  return b;
}

function bulbArc(count: number, fn: (t: number) => THREE.Vector3, group: THREE.Group) {
  const geo = new THREE.SphereGeometry(0.06, 10, 8);
  for (let i = 0; i < count; i++) {
    const p = fn(i / (count - 1));
    const b = new THREE.Mesh(geo, BULB);
    b.position.copy(p);
    group.add(b);
  }
}

export interface ShelfDef {
  y: number;
  z: number;
  halfWidth: number;
}

export const SHELVES: ShelfDef[] = [
  { y: 2.15, z: -4.6, halfWidth: 3.5 },
  { y: 1.35, z: -3.9, halfWidth: 3.6 },
  { y: 0.6, z: -3.2, halfWidth: 3.7 },
];

export function buildBooth(scene: THREE.Scene) {
  const root = new THREE.Group();
  scene.add(root);

  // ---- back wall with red/cream stripes
  const wall = new THREE.Group();
  for (let i = -10; i <= 10; i++) {
    const s = box(0.42, 5.4, 0.2, i % 2 === 0 ? RED : CREAM, i * 0.42, 2.2, -5.4);
    wall.add(s);
  }
  root.add(wall);
  root.add(box(9.2, 0.3, 0.35, GOLD, 0, 4.95, -5.35));

  // ---- floor of the booth + ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat(0x2a1a2e, { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.6;
  ground.receiveShadow = true;
  root.add(ground);
  root.add(box(9.5, 0.2, 3.2, WOOD_DARK, 0, -0.5, -3.9));

  // ---- side walls
  for (const s of [-1, 1]) {
    const side = box(0.3, 5.4, 3.4, WOOD, s * 4.6, 2.2, -3.8);
    root.add(side);
    const curtain = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const fold = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 4.6, 12, 1, false, 0, Math.PI), VELVET);
      fold.position.set(s * (4.2 - i * 0.02), 2.4, -2.4 - i * 0.42);
      fold.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      fold.castShadow = true;
      curtain.add(fold);
    }
    root.add(curtain);
    // gold curtain tie
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 8, 20), GOLD);
    tie.position.set(s * 4.0, 1.3, -3.4);
    tie.rotation.y = Math.PI / 2;
    root.add(tie);
  }

  // ---- striped roof
  const roof = new THREE.Group();
  for (let i = -11; i <= 11; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 3.6), i % 2 === 0 ? RED : CREAM);
    p.position.set(i * 0.42, 5.15 + Math.abs(i) * 0.045, -3.6);
    p.rotation.z = -Math.sign(i) * 0.1;
    p.castShadow = true;
    roof.add(p);
  }
  root.add(roof);

  // ---- marquee sign
  const sign = new THREE.Group();
  sign.position.set(0, 4.15, -4.9);
  const plate = box(4.2, 1.2, 0.18, mat(0x5c0f14, { roughness: 0.5 }));
  sign.add(plate);
  sign.add(box(4.5, 0.12, 0.22, GOLD, 0, 0.62, 0));
  sign.add(box(4.5, 0.12, 0.22, GOLD, 0, -0.62, 0));
  bulbArc(22, (t) => new THREE.Vector3(-2.1 + t * 4.2, 0.72, 0.12), sign);
  bulbArc(22, (t) => new THREE.Vector3(-2.1 + t * 4.2, -0.72, 0.12), sign);
  root.add(sign);
  const signLight = new THREE.PointLight(0xffb547, 7, 9, 2);
  signLight.position.set(0, 3.6, -3.6);
  root.add(signLight);

  // ---- bulb arches around booth opening
  const arch = new THREE.Group();
  bulbArc(26, (t) => {
    const a = Math.PI * t;
    return new THREE.Vector3(-Math.cos(a) * 4.35, 0.4 + Math.sin(a) * 4.6, -2.2);
  }, arch);
  root.add(arch);
  for (const s of [-1, 1]) {
    bulbArc(12, (t) => new THREE.Vector3(s * 4.3, 0.2 + t * 4.4, -4.9), root);
  }

  // ---- shelves with rails
  SHELVES.forEach((sh, i) => {
    const shelf = new THREE.Group();
    shelf.add(box(sh.halfWidth * 2 + 0.6, 0.16, 0.7, WOOD, 0, sh.y - 0.08, sh.z));
    shelf.add(box(sh.halfWidth * 2 + 0.6, 0.07, 0.12, mat(0x2f2f38, { metalness: 0.7, roughness: 0.35 }), 0, sh.y + 0.02, sh.z + 0.3));
    // glowing rail strip
    const strip = box(
      sh.halfWidth * 2 + 0.5,
      0.04,
      0.08,
      mat(0x2ad4ff, { emissive: 0x2ad4ff, emissiveIntensity: 0.22 }),
      0,
      sh.y - 0.16,
      sh.z + 0.34,
    );
    shelf.add(strip);
    bulbArc(Math.floor(sh.halfWidth * 3), (t) => new THREE.Vector3(-sh.halfWidth + t * sh.halfWidth * 2, sh.y - 0.2, sh.z + 0.36), shelf);
    root.add(shelf);
    const l = new THREE.PointLight(0xffd39b, 3.2, 7, 2);
    l.position.set(0, sh.y + 0.7, sh.z + 1.1);
    root.add(l);
    void i;
  });

  // ---- counter
  const counter = new THREE.Group();
  counter.add(box(10, 0.28, 1.5, WOOD, 0, -0.35, 0.15));
  counter.add(box(10, 0.1, 0.2, GOLD, 0, -0.2, 0.88));
  counter.add(box(10, 1.4, 0.25, WOOD_DARK, 0, -1.1, 0.85));
  for (let i = -4; i <= 4; i++) {
    counter.add(box(0.5, 1.2, 0.06, i % 2 === 0 ? RED : CREAM, i * 0.55, -1.1, 0.99));
  }
  counter.position.y = 0.95;
  root.add(counter);

  // ---- prize shelves on the sides
  for (const s of [-1, 1]) {
    for (let r = 0; r < 3; r++) {
      root.add(box(1.6, 0.1, 1.2, WOOD, s * 5.6, 0.6 + r * 1.2, -2.6));
    }
    const neon = box(1.5, 0.5, 0.1, mat(0x1a0b1f, { emissive: 0xff3fb4, emissiveIntensity: 1.1 }), s * 5.55, 3.9, -2.0);
    root.add(neon);
    const nl = new THREE.PointLight(0xff3fb4, 4, 8, 2);
    nl.position.set(s * 5.2, 3.7, -1.4);
    root.add(nl);
  }

  // ---- balloons
  const balloonColors = [0xff4d6d, 0x4dd2ff, 0xffd93d, 0x8ef07a, 0xb794ff];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 16, 14),
        mat(balloonColors[i % balloonColors.length]!, { roughness: 0.25, metalness: 0.05 }),
      );
      b.position.set(s * (4.9 + Math.random() * 0.9), 1.4 + i * 0.45 + Math.random() * 0.3, -0.6 - Math.random());
      b.scale.y = 1.2;
      b.castShadow = true;
      root.add(b);
    }
  }

  // ---- bunting banners
  const buntColors = [0xff4d6d, 0xffd93d, 0x4dd2ff, 0x8ef07a, 0xb794ff, 0xff8a1e];
  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    const flag = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.42, 4),
      mat(buntColors[i % buntColors.length]!, { roughness: 0.8, side: THREE.DoubleSide }),
    );
    flag.position.set(-5 + t * 10, 5.4 - Math.sin(t * Math.PI) * 0.5, -2.0);
    flag.rotation.x = Math.PI;
    flag.rotation.y = Math.PI / 4;
    root.add(flag);
  }

  return root;
}
