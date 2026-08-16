import * as THREE from "three";

export type ToyKind =
  | "bear"
  | "duck"
  | "car"
  | "gift"
  | "goldgift"
  | "goldbear"
  | "cup"
  | "bunny"
  | "robot"
  | "ball"
  | "dino"
  | "pig"
  | "unicorn"
  | "penguin"
  | "panda"
  | "soccer"
  | "clown"
  | "plane"
  | "train"
  | "top"
  | "milk"
  | "bomb"
  | "warning"
  | "clock"
  | "star"
  | "spread"
  | "ammo"
  | "boss";

export interface ToySpec {
  kind: ToyKind;
  points: number;
  label: string;
}

export const TOY_SPECS: Record<ToyKind, ToySpec> = {
  bear: { kind: "bear", points: 100, label: "Teddy Bear" },
  duck: { kind: "duck", points: 120, label: "Rubber Duck" },
  car: { kind: "car", points: 150, label: "Toy Car" },
  gift: { kind: "gift", points: 250, label: "Gift Box" },
  goldgift: { kind: "goldgift", points: 1000, label: "MYSTERY GIFT" },
  goldbear: { kind: "goldbear", points: 800, label: "GOLDEN TEDDY" },
  cup: { kind: "cup", points: 90, label: "Soda Cup" },
  bunny: { kind: "bunny", points: 110, label: "Pink Bunny" },
  robot: { kind: "robot", points: 200, label: "Robot" },
  ball: { kind: "ball", points: 80, label: "Beach Ball" },
  dino: { kind: "dino", points: 180, label: "Dinosaur" },
  pig: { kind: "pig", points: 130, label: "Piggy" },
  unicorn: { kind: "unicorn", points: 600, label: "UNICORN PLUSH" },
  penguin: { kind: "penguin", points: 140, label: "Penguin" },
  panda: { kind: "panda", points: 150, label: "Panda" },
  soccer: { kind: "soccer", points: 85, label: "Soccer Ball" },
  clown: { kind: "clown", points: 170, label: "Clown Figure" },
  plane: { kind: "plane", points: 160, label: "Toy Airplane" },
  train: { kind: "train", points: 175, label: "Toy Train" },
  top: { kind: "top", points: 95, label: "Spinning Top" },
  milk: { kind: "milk", points: 75, label: "Milk Bottle" },
  bomb: { kind: "bomb", points: -200, label: "BOMB!" },
  warning: { kind: "warning", points: -150, label: "WARNING BOX!" },
  clock: { kind: "clock", points: 60, label: "SLOW-MO" },
  star: { kind: "star", points: 60, label: "DOUBLE SCORE" },
  spread: { kind: "spread", points: 60, label: "SPREAD SHOT" },
  ammo: { kind: "ammo", points: 60, label: "+10 AMMO" },
  boss: { kind: "boss", points: 1500, label: "BOSS PRIZE" },
};

/** soft matte plush */
const toon = (color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...opts });
/** glossy vinyl / moulded plastic */
const gloss = (color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.18, metalness: 0.04, ...opts });

function mesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const SPH = new THREE.SphereGeometry(1, 22, 18);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 22);
const CONE = new THREE.ConeGeometry(1, 1, 20);
const TORUS = new THREE.TorusGeometry(1, 0.28, 12, 26);
const CAP = new THREE.CapsuleGeometry(1, 1, 6, 18);

/** rounded plush body: slightly squashed sphere, the workhorse of every soft toy here */
const blob = (mat: THREE.Material, p: [number, number, number], s: [number, number, number]) => mesh(SPH, mat, p, s);

function eyes(
  g: THREE.Group,
  y: number,
  z: number,
  dx = 0.13,
  r = 0.055,
  irisColor = 0x14141c,
) {
  const white = gloss(0xffffff);
  const iris = gloss(irisColor, { roughness: 0.12 });
  for (const s of [-1, 1]) {
    g.add(mesh(SPH, white, [s * dx, y, z], [r, r * 1.1, r * 0.6]));
    g.add(mesh(SPH, iris, [s * dx, y, z + r * 0.35], [r * 0.55, r * 0.6, r * 0.4]));
    g.add(mesh(SPH, gloss(0x08080c), [s * dx, y, z + r * 0.5], [r * 0.28, r * 0.3, r * 0.25]));
    // specular catchlight sells the glossy toy render
    g.add(mesh(SPH, new THREE.MeshBasicMaterial({ color: 0xffffff }), [s * dx - r * 0.22, y + r * 0.36, z + r * 0.55], [r * 0.16, r * 0.16, r * 0.12]));
  }
}

function star5Mesh(outer: number, inner: number, depth: number, mat: THREE.Material) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.center();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

// ---------------------------------------------------------------- plushies

function bear(golden = false) {
  const g = new THREE.Group();
  const fur = golden
    ? gloss(0xe8b444, { metalness: 0.85, roughness: 0.16, emissive: 0x503200, emissiveIntensity: 0.35 })
    : toon(0x8a5a34, { roughness: 0.75 });
  const light = golden ? fur : toon(0xc08a55, { roughness: 0.8 });
  const muzzleM = golden ? fur : toon(0xd7ab7e, { roughness: 0.8 });

  g.add(blob(fur, [0, 0.31, 0], [0.3, 0.29, 0.26]));
  g.add(blob(light, [0, 0.26, 0.14], [0.19, 0.2, 0.16])); // belly patch
  g.add(blob(fur, [0, 0.68, 0.01], [0.26, 0.25, 0.24])); // head
  for (const s of [-1, 1]) {
    g.add(blob(fur, [s * 0.2, 0.88, -0.01], [0.09, 0.09, 0.06])); // ear
    g.add(blob(light, [s * 0.2, 0.885, 0.03], [0.05, 0.05, 0.03]));
    const arm = blob(fur, [s * 0.3, 0.34, 0.04], [0.1, 0.14, 0.1]); // arm
    arm.rotation.z = s * 0.35;
    g.add(arm);
    g.add(blob(light, [s * 0.31, 0.24, 0.09], [0.055, 0.055, 0.04]));
    g.add(blob(fur, [s * 0.15, 0.06, 0.06], [0.13, 0.1, 0.16])); // foot
    g.add(blob(light, [s * 0.15, 0.05, 0.16], [0.075, 0.055, 0.045]));
  }
  g.add(blob(muzzleM, [0, 0.62, 0.2], [0.11, 0.085, 0.08]));
  g.add(blob(gloss(0x2b2020), [0, 0.65, 0.27], [0.04, 0.032, 0.032]));
  eyes(g, 0.74, 0.19, 0.095, 0.045, 0x1a1008);

  // red bow tie
  const bowM = golden ? fur : gloss(0xd7263d);
  for (const s of [-1, 1]) {
    const wing = blob(bowM, [s * 0.085, 0.48, 0.19], [0.065, 0.05, 0.035]);
    wing.rotation.z = s * 0.3;
    g.add(wing);
  }
  g.add(blob(bowM, [0, 0.48, 0.21], [0.032, 0.032, 0.03]));
  return g;
}

function duck() {
  const g = new THREE.Group();
  const y = gloss(0xffc617);
  const o = gloss(0xf98010);
  g.add(blob(y, [0, 0.3, 0], [0.33, 0.27, 0.31]));
  g.add(blob(y, [0, 0.6, 0.11], [0.21, 0.21, 0.2]));
  const neck = mesh(CAP, y, [0, 0.46, 0.07], [0.12, 0.09, 0.12]);
  g.add(neck);
  const tail = blob(y, [0, 0.4, -0.28], [0.14, 0.12, 0.12]);
  tail.rotation.x = 0.5;
  g.add(tail);
  // beak: two stacked wedges read better than one squashed sphere
  g.add(blob(o, [0, 0.585, 0.3], [0.13, 0.05, 0.12]));
  g.add(blob(o, [0, 0.555, 0.27], [0.1, 0.03, 0.09]));
  for (const s of [-1, 1]) {
    const wing = blob(y, [s * 0.3, 0.32, 0.02], [0.06, 0.14, 0.17]);
    wing.rotation.z = s * 0.12;
    g.add(wing);
  }
  g.add(mesh(CYL, o, [0, 0.045, 0.02], [0.19, 0.04, 0.19]));
  eyes(g, 0.67, 0.25, 0.095, 0.042);

  return g;
}

function dino() {
  const g = new THREE.Group();
  const green = gloss(0x54c832);
  const greenDark = gloss(0x3fa524);
  const yellow = gloss(0xf5cf2a);
  const purple = gloss(0x9b30d9);
  const white = gloss(0xf6f3e6);
  const mouthM = gloss(0x9e1b2f, { roughness: 0.32 });

  g.add(blob(green, [0, 0.34, 0], [0.27, 0.3, 0.25]));
  g.add(blob(yellow, [0, 0.31, 0.14], [0.17, 0.23, 0.16]));

  for (const s of [-1, 1]) {
    g.add(blob(green, [s * 0.17, 0.14, 0], [0.12, 0.15, 0.13]));
    g.add(blob(green, [s * 0.17, 0.035, 0.05], [0.12, 0.05, 0.16]));
    for (let t = -1; t <= 1; t++) g.add(blob(white, [s * 0.17 + t * 0.055, 0.03, 0.19], [0.028, 0.028, 0.035]));
    const arm = blob(green, [s * 0.24, 0.42, 0.13], [0.06, 0.05, 0.09]);
    arm.rotation.z = s * 0.5;
    g.add(arm);
    g.add(blob(white, [s * 0.27, 0.4, 0.2], [0.022, 0.022, 0.03]));
  }

  const tail = mesh(CONE, green, [0, 0.28, -0.3], [0.13, 0.36, 0.13]);
  tail.rotation.x = -Math.PI / 2.3;
  g.add(tail);
  const tailTip = mesh(CONE, yellow, [0, 0.34, -0.44], [0.07, 0.14, 0.07]);
  tailTip.rotation.x = -Math.PI / 2.1;
  g.add(tailTip);

  g.add(blob(green, [0, 0.7, 0.05], [0.24, 0.22, 0.24]));
  g.add(blob(green, [0, 0.7, 0.22], [0.15, 0.13, 0.14]));
  g.add(blob(mouthM, [0, 0.64, 0.27], [0.11, 0.05, 0.08]));
  for (let i = -2; i <= 2; i++) {
    g.add(blob(white, [i * 0.042, 0.665, 0.31], [0.018, 0.022, 0.018]));
    g.add(blob(white, [i * 0.042, 0.615, 0.3], [0.015, 0.018, 0.015]));
  }
  for (const s of [-1, 1]) g.add(blob(greenDark, [s * 0.05, 0.78, 0.33], [0.017, 0.014, 0.014]));

  const spikeCount = 9;
  for (let i = 0; i < spikeCount; i++) {
    const t = i / (spikeCount - 1);
    const size = 0.09 - t * 0.045;
    const sp = mesh(CONE, purple, [0, 0.84 - t * 0.5, -0.06 - t * 0.36], [size, size * 1.9, size]);
    sp.rotation.x = -0.3 - t * 0.75;
    g.add(sp);
    g.add(blob(purple, [0, 0.84 - t * 0.5 + size * 0.9, -0.06 - t * 0.36], [size * 0.45, size * 0.45, size * 0.45]));
  }

  const brown = gloss(0x5a3210, { roughness: 0.15 });
  for (const s of [-1, 1]) {
    g.add(blob(gloss(0xffffff), [s * 0.11, 0.8, 0.17], [0.062, 0.07, 0.05]));
    g.add(blob(brown, [s * 0.115, 0.8, 0.21], [0.036, 0.04, 0.03]));
    g.add(blob(gloss(0x140d08), [s * 0.117, 0.8, 0.235], [0.017, 0.019, 0.02]));
    g.add(mesh(SPH, new THREE.MeshBasicMaterial({ color: 0xffffff }), [s * 0.117 - 0.014, 0.825, 0.24], [0.011, 0.011, 0.01]));
  }
  return g;
}

function bunny() {
  const g = new THREE.Group();
  const w = toon(0xffc2d6, { roughness: 0.62 });      // pink plush body
  const p = gloss(0xff8fb0);                           // deeper pink inner-ear / pads
  const nose = gloss(0xff6f92);
  const dark = gloss(0x2a1a20);
  const teeth = gloss(0xfffdf8);

  // seated pear-shaped body
  g.add(blob(w, [0, 0.2, 0], [0.3, 0.23, 0.27]));
  g.add(blob(w, [0, 0.36, -0.01], [0.26, 0.2, 0.24]));
  // big round head
  g.add(blob(w, [0, 0.63, 0.03], [0.26, 0.25, 0.245]));
  // cheeks give the chubby muzzle of the reference
  for (const s of [-1, 1]) g.add(blob(w, [s * 0.085, 0.565, 0.185], [0.085, 0.07, 0.07]));
  // head tuft
  const tuft = blob(w, [0.015, 0.87, -0.03], [0.045, 0.055, 0.04]);
  tuft.rotation.z = -0.5;
  g.add(tuft);
  g.add(blob(w, [-0.04, 0.855, -0.05], [0.035, 0.042, 0.032]));

  for (const s of [-1, 1]) {
    // tall upright ears, slightly splayed
    const ear = blob(w, [s * 0.125, 1.0, -0.03], [0.062, 0.24, 0.045]);
    ear.rotation.z = s * 0.2;
    g.add(ear);
    const inner = blob(p, [s * 0.128, 0.99, 0.005], [0.036, 0.19, 0.022]);
    inner.rotation.z = s * 0.2;
    g.add(inner);
    // arms resting on the belly
    const arm = blob(w, [s * 0.205, 0.28, 0.13], [0.075, 0.115, 0.085]);
    arm.rotation.z = s * 0.25;
    g.add(arm);
    // big splayed hind feet with paw pads
    const foot = blob(w, [s * 0.155, 0.075, 0.16], [0.105, 0.075, 0.145]);
    foot.rotation.y = s * 0.22;
    g.add(foot);
    g.add(blob(p, [s * 0.155, 0.075, 0.29], [0.052, 0.04, 0.03]));
    for (let i = 0; i < 3; i++)
      g.add(blob(p, [s * 0.155 + (i - 1) * 0.042, 0.115, 0.275], [0.019, 0.015, 0.014]));
    // brows
    const brow = mesh(TORUS, dark, [s * 0.1, 0.755, 0.235], [0.04, 0.04, 0.012]);
    brow.rotation.set(Math.PI / 2, 0, s * 0.35);
    g.add(brow);
  }

  eyes(g, 0.675, 0.25, 0.098, 0.06, 0x1b4a7a);
  // pink nose + smiling mouth with buck teeth
  g.add(blob(nose, [0, 0.605, 0.275], [0.034, 0.026, 0.026]));
  const mouth = mesh(SPH, gloss(0xd94f6a), [0, 0.545, 0.265], [0.052, 0.036, 0.03]);
  g.add(mouth);
  for (const s of [-1, 1]) g.add(mesh(BOX, teeth, [s * 0.017, 0.568, 0.288], [0.026, 0.026, 0.012]));

  // purple bow tie
  const bow = gloss(0x8b5cf6);
  for (const s of [-1, 1]) {
    const wing = blob(bow, [s * 0.075, 0.44, 0.2], [0.055, 0.045, 0.03]);
    wing.rotation.z = s * 0.32;
    g.add(wing);
  }
  g.add(blob(bow, [0, 0.44, 0.21], [0.026, 0.026, 0.026]));
  // fluffy tail
  g.add(blob(w, [0, 0.22, -0.27], [0.075, 0.075, 0.06]));
  return g;
}


function unicorn() {
  const g = new THREE.Group();
  const w = toon(0xfffdfb, { roughness: 0.55 });            // glossy plush white
  const p = toon(0xffc2dc, { roughness: 0.45 });            // pastel pink muzzle / inner ear
  const hoof = toon(0xef7fc4, { roughness: 0.4 });          // magenta-pink hooves
  const blushM = toon(0xffb8d1, { roughness: 0.7, transparent: true, opacity: 0.5 });
  // pastel palette from the reference plush
  const PINK = 0xffb3d1, LILAC = 0xc9a7f0, SKY = 0xa9d6f5, LEMON = 0xffdc8a, MINT = 0xbfe8d0;
  const pastelMane = [PINK, LILAC, SKY, LEMON, MINT];
  const soft = (c: number) => toon(c, { roughness: 0.45 });

  // ---- squishy chibi body ----
  g.add(blob(w, [0, 0.28, -0.02], [0.32, 0.26, 0.33]));
  g.add(blob(w, [0, 0.24, 0.13], [0.22, 0.21, 0.18]));      // chest
  // ---- oversized round head ----
  g.add(blob(w, [0, 0.68, 0.09], [0.32, 0.3, 0.29]));
  // big soft pink muzzle
  g.add(blob(p, [0, 0.55, 0.31], [0.135, 0.105, 0.115]));
  for (const s of [-1, 1]) g.add(blob(soft(0xf28cba), [s * 0.045, 0.565, 0.4], [0.022, 0.02, 0.018])); // nostrils
  g.add(blob(soft(0xffa6c8), [0, 0.665, 0.37], [0.03, 0.034, 0.02]));  // little heart mark

  for (const s of [-1, 1]) {
    // long soft ears, tipped outward
    const ear = blob(w, [s * 0.28, 0.94, -0.03], [0.075, 0.16, 0.06]);
    ear.rotation.z = s * 0.55;
    g.add(ear);
    const inner = blob(p, [s * 0.29, 0.935, 0.01], [0.042, 0.11, 0.03]);
    inner.rotation.z = s * 0.55;
    g.add(inner);
    // stubby chunky legs with pink hoof cuffs
    g.add(blob(w, [s * 0.155, 0.1, 0.12], [0.1, 0.1, 0.11]));
    g.add(blob(w, [s * 0.155, 0.1, -0.14], [0.1, 0.1, 0.11]));
    g.add(blob(hoof, [s * 0.155, 0.032, 0.12], [0.098, 0.035, 0.107]));
    g.add(blob(hoof, [s * 0.155, 0.032, -0.14], [0.098, 0.035, 0.107]));
    g.add(mesh(SPH, blushM, [s * 0.21, 0.6, 0.2], [0.06, 0.045, 0.02]));
  }

  // ---- pastel spiral horn: sky-blue cone wrapped in a lemon ribbon ----
  for (let i = 0; i < 6; i++) {
    const t = i / 6;
    g.add(mesh(CONE, soft(SKY), [-0.06, 0.99 + t * 0.24, 0.04], [0.075 - t * 0.055, 0.08, 0.075 - t * 0.055]));
  }
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    const a = t * 6.0;
    const r = 0.066 - t * 0.042;
    g.add(blob(soft(LEMON), [-0.06 + Math.cos(a) * r, 1.01 + t * 0.16, 0.04 + Math.sin(a) * r], [0.032, 0.028, 0.032]));
  }

  // ---- swooping pastel bangs across the forehead (sit proud of the skull) ----
  const bang = [LEMON, LEMON, SKY, PINK];
  bang.forEach((c, i) => {
    const t = i / (bang.length - 1);
    const b = blob(soft(c), [0.16 - t * 0.36, 0.87 - t * 0.09, 0.31 - t * 0.03], [0.14 - t * 0.02, 0.11, 0.12]);
    b.rotation.z = -0.55 - t * 0.3;
    g.add(b);
  });

  // ---- big flowing mane hanging outside the right shoulder ----
  pastelMane.forEach((c, i) => {
    const t = i / (pastelMane.length - 1);
    g.add(blob(soft(c), [0.36 + t * 0.1, 0.86 - t * 0.5, 0.2 + t * 0.05], [0.145, 0.15, 0.145]));
  });
  // curled mane tip sweeping forward
  g.add(blob(soft(LILAC), [0.48, 0.3, 0.3], [0.13, 0.13, 0.13]));
  g.add(blob(soft(SKY), [0.4, 0.2, 0.38], [0.11, 0.11, 0.11]));

  // ---- big curved pastel rainbow tail sweeping out to the left ----
  const tailCols = [PINK, LILAC, SKY, LEMON, MINT, LILAC];
  tailCols.forEach((c, i) => {
    const t = i / (tailCols.length - 1);
    g.add(blob(soft(c), [-0.42 - t * 0.16, 0.52 - t * 0.34, -0.24 - t * 0.05], [0.14 - t * 0.03, 0.14 - t * 0.03, 0.13]));
  });

  // ---- huge sparkly lavender anime eyes, sitting on the face surface ----
  for (const s of [-1, 1]) {
    g.add(mesh(SPH, gloss(0xffffff), [s * 0.155, 0.75, 0.4], [0.125, 0.145, 0.085]));
    g.add(mesh(SPH, gloss(0x3d2352, { roughness: 0.1 }), [s * 0.155, 0.745, 0.44], [0.108, 0.128, 0.075]));
    g.add(mesh(SPH, gloss(0x8b62c4), [s * 0.155, 0.72, 0.48], [0.07, 0.07, 0.05]));
    g.add(mesh(SPH, new THREE.MeshBasicMaterial({ color: 0xffffff }), [s * 0.155 - 0.04, 0.79, 0.5], [0.04, 0.04, 0.026]));
    g.add(mesh(SPH, new THREE.MeshBasicMaterial({ color: 0xffffff }), [s * 0.155 + 0.036, 0.712, 0.5], [0.021, 0.021, 0.016]));
  }





  return g;
}


function penguin() {
  const g = new THREE.Group();
  const b = toon(0x24242c, { roughness: 0.42 });   // glossy dark plastic back
  const w = toon(0xf7f3ea, { roughness: 0.5 });    // cream front
  const o = gloss(0xf59211);                        // orange beak/feet
  const dark = gloss(0x201a18);
  const mouthM = gloss(0xc0392b);

  // one fused egg-shaped body-head, wider at the bottom (reference silhouette)
  g.add(blob(b, [0, 0.34, 0], [0.31, 0.3, 0.29]));
  g.add(blob(b, [0, 0.62, 0.0], [0.27, 0.25, 0.26]));
  g.add(blob(b, [0, 0.8, -0.01], [0.2, 0.15, 0.19]));
  // cream front: belly running up into the face patch, one continuous panel
  g.add(blob(w, [0, 0.31, 0.11], [0.235, 0.245, 0.2]));
  g.add(blob(w, [0, 0.56, 0.11], [0.2, 0.2, 0.18]));
  g.add(blob(w, [0, 0.732, 0.118], [0.188, 0.152, 0.152]));

  // head tuft (two little quills)
  for (const s of [-1, 1]) {
    const q = blob(b, [s * 0.028, 0.955, -0.02], [0.026, 0.05, 0.024]);
    q.rotation.z = s * 0.35;
    g.add(q);
  }
  g.add(blob(b, [0, 0.945, -0.03], [0.024, 0.045, 0.022]));

  for (const s of [-1, 1]) {
    // teardrop flippers angled outward/down
    const wing = blob(b, [s * 0.3, 0.36, -0.01], [0.055, 0.17, 0.12]);
    wing.rotation.z = s * 0.42;
    g.add(wing);
    g.add(blob(b, [s * 0.34, 0.21, -0.01], [0.04, 0.075, 0.075]));
    // webbed feet: pad + three toes
    const foot = blob(o, [s * 0.13, 0.035, 0.1], [0.085, 0.035, 0.1]);
    foot.rotation.y = s * 0.25;
    g.add(foot);
    for (let i = 0; i < 3; i++) {
      const a = (i - 1) * 0.4 + s * 0.25;
      g.add(blob(o, [s * 0.13 + Math.sin(a) * 0.075, 0.04, 0.1 + Math.cos(a) * 0.085], [0.033, 0.03, 0.042]));
    }
    // brows
    const brow = mesh(TORUS, dark, [s * 0.092, 0.822, 0.222], [0.032, 0.032, 0.012]);
    brow.rotation.set(Math.PI / 2, 0, s * 0.4);
    g.add(brow);
  }

  eyes(g, 0.762, 0.252, 0.09, 0.052, 0x123a5e);

  // open orange beak with red mouth interior
  g.add(blob(o, [0, 0.702, 0.252], [0.078, 0.052, 0.082]));    // upper bill
  g.add(blob(mouthM, [0, 0.662, 0.25], [0.054, 0.03, 0.056])); // mouth
  g.add(blob(o, [0, 0.634, 0.244], [0.068, 0.033, 0.072]));     // lower bill
  g.add(blob(dark, [0, 0.725, 0.312], [0.007, 0.007, 0.007]));  // nostril dimple


  return g;

}

function panda() {
  const g = new THREE.Group();
  const w = toon(0xf7f4ef, { roughness: 0.7 });
  const b = toon(0x22222a, { roughness: 0.65 });
  g.add(blob(w, [0, 0.3, 0], [0.3, 0.28, 0.26]));
  g.add(blob(w, [0, 0.68, 0.01], [0.27, 0.25, 0.25]));
  for (const s of [-1, 1]) {
    g.add(blob(b, [s * 0.21, 0.89, -0.01], [0.09, 0.09, 0.06])); // ear
    g.add(blob(b, [s * 0.11, 0.72, 0.19], [0.075, 0.075, 0.045])); // eye patch
    const arm = blob(b, [s * 0.3, 0.33, 0.03], [0.1, 0.14, 0.1]);
    arm.rotation.z = s * 0.32;
    g.add(arm);
    g.add(blob(b, [s * 0.15, 0.06, 0.07], [0.12, 0.09, 0.15]));
  }
  g.add(blob(gloss(0x1a1a20), [0, 0.63, 0.24], [0.04, 0.03, 0.03]));
  eyes(g, 0.72, 0.21, 0.11, 0.036);
  return g;
}

function clown() {
  const g = new THREE.Group();
  const skin = toon(0xffe3cf, { roughness: 0.6 });
  const red = gloss(0xe0342f);
  const blue = gloss(0x2f6fd0);
  const yellow = gloss(0xffcf2b);
  const green = gloss(0x4bbd52);
  g.add(blob(blue, [0, 0.28, 0], [0.26, 0.26, 0.24])); // body
  g.add(mesh(CYL, red, [0, 0.5, 0], [0.2, 0.06, 0.2])); // ruff
  g.add(blob(skin, [0, 0.72, 0], [0.23, 0.22, 0.22])); // head
  for (const s of [-1, 1]) {
    g.add(blob(green, [s * 0.21, 0.78, -0.02], [0.1, 0.1, 0.09])); // hair puff
    const arm = blob(yellow, [s * 0.28, 0.3, 0.03], [0.09, 0.11, 0.09]);
    g.add(arm);
    g.add(blob(red, [s * 0.13, 0.05, 0.08], [0.11, 0.06, 0.15])); // shoe
  }
  g.add(blob(gloss(0xff3b30), [0, 0.7, 0.21], [0.05, 0.05, 0.05])); // nose
  g.add(mesh(CONE, red, [0, 0.94, 0], [0.11, 0.16, 0.11])); // hat
  g.add(blob(yellow, [0, 1.03, 0], [0.045, 0.045, 0.045]));
  g.add(blob(red, [0, 0.62, 0.19], [0.06, 0.025, 0.04])); // smile
  eyes(g, 0.77, 0.18, 0.085, 0.04);
  return g;
}

function pig() {
  const g = new THREE.Group();
  const skin = toon(0xffb3c6, { roughness: 0.62 });
  const skinDeep = toon(0xf59ab1, { roughness: 0.6 });
  const snoutMat = gloss(0xff93ae, { roughness: 0.3 });
  const hole = gloss(0xc9647f, { roughness: 0.35 });
  const hoof = gloss(0xe07d96, { roughness: 0.28 });

  // ---- body: chubby squashed plush barrel
  g.add(blob(skin, [0, 0.31, -0.01], [0.33, 0.29, 0.3]));
  g.add(blob(skin, [0, 0.24, 0.05], [0.29, 0.22, 0.26])); // belly swell
  // ---- legs / trotters
  for (const s of [-1, 1])
    for (const z of [-0.13, 0.13]) {
      g.add(mesh(CAP, skin, [s * 0.16, 0.09, z], [0.072, 0.05, 0.072]));
      g.add(mesh(CYL, hoof, [s * 0.16, 0.025, z], [0.075, 0.03, 0.075]));
    }

  // ---- head
  g.add(blob(skin, [0, 0.63, 0.09], [0.245, 0.225, 0.225]));
  g.add(blob(skin, [0, 0.57, 0.18], [0.18, 0.14, 0.16])); // muzzle mass

  // ---- snout disc + nostrils
  const snout = mesh(CYL, snoutMat, [0, 0.575, 0.295], [0.088, 0.035, 0.088]);
  snout.rotation.x = Math.PI / 2;
  g.add(snout);
  const rim = mesh(TORUS, snoutMat, [0, 0.575, 0.312], [0.085, 0.085, 0.085]);
  g.add(rim);
  for (const s of [-1, 1]) g.add(mesh(CYL, hole, [s * 0.033, 0.575, 0.331], [0.016, 0.012, 0.016]).rotateX(Math.PI / 2));

  // ---- ears: floppy triangular flaps, tilted outward
  for (const s of [-1, 1]) {
    const ear = mesh(CONE, skin, [s * 0.16, 0.79, 0.06], [0.075, 0.13, 0.035]);
    ear.rotation.z = s * 0.42;
    ear.rotation.x = -0.25;
    g.add(ear);
    const inner = mesh(CONE, skinDeep, [s * 0.16, 0.775, 0.078], [0.045, 0.09, 0.02]);
    inner.rotation.z = s * 0.42;
    inner.rotation.x = -0.25;
    g.add(inner);
    // blush cheeks
    g.add(mesh(SPH, toon(0xff7f9d, { roughness: 0.5 }), [s * 0.145, 0.585, 0.185], [0.05, 0.036, 0.02]));
  }

  // ---- curly tail: three torus arcs stacked into a spiral
  for (let i = 0; i < 3; i++) {
    const r = 0.055 - i * 0.012;
    const t = mesh(TORUS, skinDeep, [0, 0.42 + i * 0.045, -0.3 - i * 0.012], [r, r, r * 0.9]);
    t.rotation.y = Math.PI / 2;
    t.rotation.z = i * 0.7;
    g.add(t);
  }

  eyes(g, 0.68, 0.255, 0.093, 0.045);
  // brow arcs give the cheeky expression
  for (const s of [-1, 1]) {
    const brow = mesh(TORUS, skinDeep, [s * 0.093, 0.735, 0.24], [0.038, 0.038, 0.03]);
    brow.rotation.x = Math.PI / 2.4;
    g.add(brow);
  }
  return g;
}


function robot() {
  const g = new THREE.Group();
  const shell = gloss(0xe7ecf5, { metalness: 0.5, roughness: 0.22 });
  const dark = gloss(0x3a4152, { metalness: 0.6, roughness: 0.3 });
  const a = gloss(0xff6b35, { metalness: 0.3, roughness: 0.25 });
  const screen = gloss(0x0a1b2a, { emissive: 0x2ad4ff, emissiveIntensity: 1.4, roughness: 0.1 });

  g.add(mesh(BOX, shell, [0, 0.32, 0], [0.34, 0.34, 0.24]));
  g.add(mesh(BOX, a, [0, 0.25, 0.13], [0.24, 0.05, 0.02])); // chest stripe
  g.add(mesh(BOX, shell, [0, 0.66, 0], [0.38, 0.3, 0.28])); // head
  g.add(mesh(BOX, screen, [0, 0.68, 0.145], [0.28, 0.15, 0.02]));
  for (const s of [-1, 1]) {
    g.add(mesh(SPH, gloss(0x2ad4ff, { emissive: 0x2ad4ff, emissiveIntensity: 1.6 }), [s * 0.07, 0.68, 0.155], [0.04, 0.04, 0.012]));
    g.add(mesh(CYL, a, [s * 0.23, 0.66, 0], [0.055, 0.055, 0.055]).rotateZ(Math.PI / 2)); // ear pod
    const arm = mesh(CAP, dark, [s * 0.24, 0.34, 0], [0.045, 0.1, 0.045]);
    g.add(arm);
    g.add(mesh(SPH, a, [s * 0.24, 0.2, 0], [0.055, 0.055, 0.055])); // hand
    g.add(mesh(BOX, dark, [s * 0.11, 0.07, 0.01], [0.12, 0.14, 0.18])); // leg
    g.add(mesh(BOX, a, [s * 0.11, 0.02, 0.03], [0.13, 0.05, 0.2])); // boot
  }
  g.add(mesh(CYL, shell, [0, 0.86, 0], [0.016, 0.14, 0.016]));
  g.add(mesh(SPH, gloss(0xff2e63, { emissive: 0xff2e63, emissiveIntensity: 1.6 }), [0, 0.95, 0], [0.045, 0.045, 0.045]));
  return g;
}

// ---------------------------------------------------------------- objects

function car() {
  const g = new THREE.Group();
  const body = gloss(0x2f8fe6, { metalness: 0.25 });
  const glass = gloss(0xbfe9ff, { metalness: 0.5, roughness: 0.06 });
  const trim = gloss(0xffd24a, { metalness: 0.5 });
  g.add(mesh(BOX, body, [0, 0.22, 0], [0.74, 0.18, 0.4]));
  g.add(mesh(BOX, body, [-0.06, 0.36, 0], [0.4, 0.16, 0.36])); // cab
  g.add(mesh(BOX, glass, [-0.06, 0.37, 0], [0.34, 0.11, 0.38]));
  g.add(mesh(BOX, body, [0.24, 0.3, 0], [0.26, 0.14, 0.38])); // bonnet
  g.add(mesh(BOX, trim, [0, 0.13, 0], [0.76, 0.04, 0.42])); // side trim
  for (const s of [-1, 1]) g.add(mesh(SPH, trim, [0.36, 0.31, s * 0.13], [0.02, 0.045, 0.045])); // headlights
  const tire = toon(0x1e1e26, { roughness: 0.9 });
  const rim = gloss(0xf0f3f7, { metalness: 0.7, roughness: 0.15 });
  for (const x of [-0.24, 0.24])
    for (const z of [-0.21, 0.21]) {
      const w = mesh(CYL, tire, [x, 0.12, z], [0.12, 0.07, 0.12]);
      w.rotation.x = Math.PI / 2;
      g.add(w);
      const r = mesh(CYL, rim, [x, 0.12, z * 1.16], [0.06, 0.02, 0.06]);
      r.rotation.x = Math.PI / 2;
      g.add(r);
    }
  return g;
}

function plane() {
  const g = new THREE.Group();
  const red = gloss(0xe23b3b);
  const blue = gloss(0x2f6fd0);
  const yellow = gloss(0xffcf2b);
  const fus = mesh(CAP, red, [0, 0.34, 0], [0.1, 0.2, 0.1]);
  fus.rotation.x = Math.PI / 2;
  g.add(fus);
  g.add(mesh(BOX, blue, [0, 0.34, 0], [0.72, 0.035, 0.16])); // wing
  g.add(mesh(BOX, blue, [0, 0.42, -0.24], [0.28, 0.03, 0.1])); // tailplane
  g.add(mesh(BOX, yellow, [0, 0.5, -0.26], [0.03, 0.14, 0.11])); // fin
  g.add(mesh(SPH, gloss(0xbfe9ff, { roughness: 0.05 }), [0, 0.44, 0.06], [0.08, 0.06, 0.11])); // canopy
  const nose = mesh(CONE, yellow, [0, 0.34, 0.3], [0.075, 0.12, 0.075]);
  nose.rotation.x = Math.PI / 2;
  g.add(nose);
  // three-blade propeller standing proud of the spinner
  for (let i = 0; i < 3; i++) {
    const blade = mesh(BOX, gloss(0x2a2f3a, { metalness: 0.4 }), [0, 0.34, 0.38], [0.028, 0.3, 0.012]);
    blade.rotation.z = (i / 3) * Math.PI * 2;
    g.add(blade);
  }
  g.add(mesh(SPH, yellow, [0, 0.34, 0.4], [0.035, 0.035, 0.035]));

  for (const s of [-1, 1]) {
    const decal = star5Mesh(0.05, 0.021, 0.006, yellow);
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(s * 0.22, 0.36, 0);
    g.add(decal);
  }

  const wheel = toon(0x1e1e26, { roughness: 0.9 });
  for (const s of [-1, 1]) {
    const w = mesh(CYL, wheel, [s * 0.13, 0.11, 0.08], [0.06, 0.035, 0.06]);
    w.rotation.x = Math.PI / 2;
    g.add(w);
  }
  return g;
}

function train() {
  const g = new THREE.Group();
  const red = gloss(0xd93b3b);
  const blue = gloss(0x2f6fd0);
  const yellow = gloss(0xffcf2b);
  const dark = gloss(0x2a2f3a, { metalness: 0.4 });
  const boiler = mesh(CYL, red, [0, 0.28, 0.1], [0.14, 0.42, 0.14]);
  boiler.rotation.x = Math.PI / 2;
  g.add(boiler);
  g.add(mesh(BOX, blue, [0, 0.34, -0.22], [0.3, 0.3, 0.26])); // cab
  g.add(mesh(BOX, dark, [0, 0.44, -0.22], [0.34, 0.04, 0.3])); // cab roof
  g.add(mesh(BOX, gloss(0x111820), [0, 0.36, -0.09], [0.2, 0.14, 0.02])); // window
  const stack = mesh(CYL, yellow, [0, 0.48, 0.24], [0.055, 0.16, 0.055]);
  g.add(stack);
  g.add(mesh(CYL, yellow, [0, 0.56, 0.24], [0.075, 0.04, 0.075]));
  g.add(mesh(SPH, gloss(0xfff3b0, { emissive: 0xffcc55, emissiveIntensity: 0.9 }), [0, 0.42, 0.3], [0.045, 0.045, 0.03])); // lamp
  g.add(mesh(BOX, dark, [0, 0.1, 0], [0.34, 0.06, 0.72])); // chassis
  const wheelM = dark;
  for (const s of [-1, 1])
    [-0.18, 0.06, 0.26].forEach((z, i) => {
      const r = i === 0 ? 0.09 : 0.065;
      const w = mesh(CYL, wheelM, [s * 0.17, r, z], [r, 0.03, r]);
      w.rotation.z = Math.PI / 2;
      g.add(w);
      const hub = mesh(CYL, yellow, [s * 0.19, r, z], [r * 0.4, 0.02, r * 0.4]);
      hub.rotation.z = Math.PI / 2;
      g.add(hub);
    });
  return g;
}

function gift(gold = false) {
  const g = new THREE.Group();
  const boxM = gold
    ? gloss(0x8b3df0, { emissive: 0x4a1090, emissiveIntensity: 0.8 })
    : gloss(0xd42f3a);
  const ribbon = gold
    ? gloss(0x4de1ff, { emissive: 0x1690b8, emissiveIntensity: 1.2 })
    : gloss(0xffd166);
  g.add(mesh(BOX, boxM, [0, 0.3, 0], [0.55, 0.5, 0.55]));
  g.add(mesh(BOX, ribbon, [0, 0.3, 0], [0.58, 0.09, 0.12]));
  g.add(mesh(BOX, ribbon, [0, 0.3, 0], [0.12, 0.09, 0.58]));
  g.add(mesh(BOX, boxM, [0, 0.57, 0], [0.6, 0.08, 0.6])); // lid
  g.add(mesh(BOX, ribbon, [0, 0.575, 0], [0.62, 0.05, 0.13]));
  g.add(mesh(BOX, ribbon, [0, 0.575, 0], [0.13, 0.05, 0.62]));
  // bow: two flattened loops splayed sideways plus trailing ribbon ends
  for (const s of [-1, 1]) {
    const loop = mesh(TORUS, ribbon, [s * 0.14, 0.67, 0], [0.12, 0.12, 0.22]);
    loop.rotation.z = s * 0.5;
    loop.scale.z = 0.16;
    g.add(loop);
    const tailR = mesh(BOX, ribbon, [s * 0.2, 0.6, 0], [0.05, 0.16, 0.045]);
    tailR.rotation.z = s * 0.75;
    g.add(tailR);
  }
  g.add(mesh(SPH, ribbon, [0, 0.665, 0], [0.055, 0.05, 0.055]));

  return g;
}

function cup() {
  const g = new THREE.Group();
  const c = gloss(0x2f6fd0);
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.145, 0.52, 26), c, [0, 0.3, 0]));
  g.add(mesh(CYL, gloss(0xf5f7fa), [0, 0.58, 0], [0.215, 0.035, 0.215])); // lid
  g.add(mesh(CYL, gloss(0xe4e8ee), [0, 0.61, 0], [0.16, 0.03, 0.16]));
  const straw = mesh(CYL, gloss(0xe0403f), [0.05, 0.75, 0.02], [0.018, 0.24, 0.018]);
  straw.rotation.z = -0.18;
  g.add(straw);
  const star = star5Mesh(0.09, 0.038, 0.01, gloss(0xffd24a));
  star.position.set(0, 0.32, 0.185);
  g.add(star);
  return g;
}

function milk() {
  const g = new THREE.Group();
  const white = gloss(0xfbf9f4);
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.42, 24), white, [0, 0.24, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.15, 0.14, 24), white, [0, 0.52, 0])); // shoulder
  g.add(mesh(CYL, white, [0, 0.62, 0], [0.07, 0.09, 0.07])); // neck
  g.add(mesh(CYL, gloss(0x2f6fd0), [0, 0.69, 0], [0.082, 0.05, 0.082])); // cap
  const label = mesh(CYL, gloss(0x2f6fd0), [0, 0.24, 0], [0.163, 0.16, 0.163]);
  g.add(label);
  g.add(mesh(SPH, gloss(0xfbf9f4), [0, 0.25, 0.16], [0.06, 0.05, 0.02])); // cow spot motif
  g.add(mesh(SPH, gloss(0xfbf9f4), [0.05, 0.2, 0.155], [0.03, 0.028, 0.02]));
  return g;
}

function ball() {
  const g = new THREE.Group();
  g.add(mesh(SPH, gloss(0xffffff, { roughness: 0.12 }), [0, 0.3, 0], [0.3, 0.3, 0.3]));
  const colors = [0xe0403f, 0x2f6fd0, 0xffd24a, 0x4bbd52, 0xffffff, 0xe0403f];
  colors.forEach((c, i) => {
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(0.302, 24, 18, (i * Math.PI * 2) / colors.length, (Math.PI * 2) / colors.length),
      gloss(c, { roughness: 0.12 }),
    );
    seg.position.set(0, 0.3, 0);
    seg.castShadow = true;
    g.add(seg);
  });
  for (const s of [-1, 1]) g.add(mesh(SPH, gloss(0xf2f4f7), [0, 0.3 + s * 0.28, 0], [0.075, 0.055, 0.075])); // white caps
  return g;
}

function soccer() {
  const g = new THREE.Group();
  g.add(mesh(SPH, gloss(0xf8f8f8, { roughness: 0.3 }), [0, 0.3, 0], [0.29, 0.29, 0.29]));
  const black = gloss(0x1c1c22, { roughness: 0.3 });
  // pentagon patches placed on an icosahedral-ish distribution
  const pts: [number, number][] = [
    [0, 0], [0, Math.PI], [1.1, 0], [1.1, 1.26], [1.1, 2.51], [1.1, 3.77], [1.1, 5.03],
    [2.04, 0.63], [2.04, 1.88], [2.04, 3.14], [2.04, 4.4], [2.04, 5.65],
  ];
  for (const [phi, theta] of pts) {
    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);
    const z = Math.sin(phi) * Math.sin(theta);
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.088, 5), black);
    patch.position.set(x * 0.291, 0.3 + y * 0.291, z * 0.291);
    patch.lookAt(new THREE.Vector3(x * 2, 0.3 + y * 2, z * 2));
    patch.castShadow = true;
    g.add(patch);
  }
  return g;
}

function top() {
  const g = new THREE.Group();
  const bands = [0xe0403f, 0xffa53d, 0xffd24a, 0x4bbd52, 0x2f6fd0];
  bands.forEach((c, i) => {
    const t = i / bands.length;
    const r = 0.26 * Math.sqrt(1 - t * 0.9);
    g.add(mesh(CYL, gloss(c), [0, 0.16 + i * 0.075, 0], [r, 0.038, r]));
  });
  const cone = mesh(CONE, gloss(0x2f6fd0), [0, 0.09, 0], [0.2, 0.16, 0.2]);
  cone.rotation.x = Math.PI;
  g.add(cone);
  g.add(mesh(CYL, gloss(0xf2f4f7, { metalness: 0.6, roughness: 0.2 }), [0, 0.58, 0], [0.022, 0.14, 0.022]));
  g.add(mesh(SPH, gloss(0xe0403f), [0, 0.67, 0], [0.05, 0.045, 0.05]));
  return g;
}

// ---------------------------------------------------------------- penalties

function bomb() {
  const g = new THREE.Group();
  g.add(mesh(SPH, gloss(0x1d1d24, { roughness: 0.25, metalness: 0.45 }), [0, 0.32, 0], [0.28, 0.28, 0.28]));
  g.add(mesh(CYL, gloss(0x3b3b46, { metalness: 0.5 }), [0, 0.6, 0], [0.085, 0.06, 0.085]));
  const fuse = mesh(CYL, toon(0x8a6a3a, { roughness: 0.85 }), [0.05, 0.7, 0], [0.02, 0.15, 0.02]);
  fuse.rotation.z = -0.45;
  g.add(fuse);
  g.add(mesh(SPH, new THREE.MeshBasicMaterial({ color: 0xffb347 }), [0.12, 0.79, 0], [0.05, 0.05, 0.05]));
  // skull mark
  const white = gloss(0xf5f5f5);
  g.add(mesh(SPH, white, [0, 0.36, 0.26], [0.075, 0.08, 0.03]));
  g.add(mesh(BOX, white, [0, 0.29, 0.26], [0.07, 0.045, 0.03]));
  for (const s of [-1, 1]) g.add(mesh(SPH, gloss(0x1d1d24), [s * 0.03, 0.375, 0.285], [0.022, 0.026, 0.02]));
  return g;
}

function warningBox() {
  const g = new THREE.Group();
  const red = gloss(0xd0342c);
  const redDark = gloss(0xa32720);
  const white = gloss(0xf6f2ea);
  g.add(mesh(BOX, red, [0, 0.3, 0], [0.52, 0.52, 0.52]));
  for (const s of [-1, 1]) {
    g.add(mesh(BOX, redDark, [0, 0.3, s * 0.265], [0.54, 0.54, 0.02]));
    g.add(mesh(BOX, redDark, [s * 0.265, 0.3, 0], [0.02, 0.54, 0.54]));
  }
  for (const r of [0.7, -0.7]) {
    const bar = mesh(BOX, white, [0, 0.3, 0.27], [0.36, 0.09, 0.03]);
    bar.rotation.z = r;
    g.add(bar);
  }
  g.add(mesh(BOX, gloss(0xf0c02c), [0, 0.57, 0], [0.54, 0.05, 0.54]));
  return g;
}

// ---------------------------------------------------------------- powerups

function clockToy() {
  const g = new THREE.Group();
  const face = mesh(CYL, gloss(0xe8f4ff, { metalness: 0.25 }), [0, 0.36, 0], [0.26, 0.06, 0.26]);
  face.rotation.x = Math.PI / 2;
  g.add(face);
  g.add(mesh(TORUS, gloss(0x2ad4ff, { emissive: 0x1188aa, emissiveIntensity: 1.1 }), [0, 0.36, 0], [0.29, 0.29, 0.12]));
  g.add(mesh(BOX, gloss(0x14141c), [0, 0.44, 0.04], [0.028, 0.15, 0.02]));
  g.add(mesh(BOX, gloss(0x14141c), [0.07, 0.36, 0.04], [0.15, 0.028, 0.02]));
  g.add(mesh(SPH, gloss(0x14141c), [0, 0.36, 0.05], [0.025, 0.025, 0.02]));
  return g;
}

/** ammo crate: olive box with brass shells + glowing "+10" plate */
function ammoToy() {
  const g = new THREE.Group();
  const crate = gloss(0x4f6a3a, { roughness: 0.4 });
  g.add(mesh(BOX, crate, [0, 0.26, 0], [0.46, 0.34, 0.34]));
  g.add(mesh(BOX, gloss(0x35492a), [0, 0.26, 0.175], [0.4, 0.28, 0.02]));
  g.add(
    mesh(BOX, gloss(0xffe14d, { emissive: 0xffb300, emissiveIntensity: 1.2 }), [0, 0.26, 0.19], [0.26, 0.1, 0.02]),
  );
  for (const s of [-1, 0, 1]) {
    const shell = mesh(CYL, gloss(0xd8a534, { metalness: 0.7, roughness: 0.25 }), [s * 0.13, 0.5, 0], [0.05, 0.14, 0.05]);
    g.add(shell);
    g.add(mesh(CONE, gloss(0xb8792a, { metalness: 0.6 }), [s * 0.13, 0.6, 0], [0.05, 0.07, 0.05]));
  }
  return g;
}

function starToy() {
  const m = gloss(0xffd93d, { emissive: 0x8a6a00, emissiveIntensity: 0.9, metalness: 0.55 });
  const g = new THREE.Group();
  const s = star5Mesh(0.3, 0.13, 0.09, m);
  s.position.set(0, 0.4, 0);
  g.add(s);
  return g;
}

function spreadToy() {
  const g = new THREE.Group();
  const m = gloss(0xff5da2, { emissive: 0x70103a, emissiveIntensity: 0.55 });
  g.add(mesh(SPH, m, [0, 0.46, 0], [0.24, 0.3, 0.24]));
  g.add(mesh(CONE, m, [0, 0.16, 0], [0.07, 0.12, 0.07]));
  g.add(mesh(CYL, gloss(0xfff3b0), [0, 0.06, 0], [0.012, 0.14, 0.012]));
  for (const s of [-1, 1]) g.add(mesh(SPH, new THREE.MeshBasicMaterial({ color: 0xffffff }), [s * 0.08, 0.56, 0.18], [0.04, 0.05, 0.02]));
  return g;
}

function bossToy() {
  const inner = gift(true);
  inner.scale.setScalar(1.6);
  const g = new THREE.Group();
  g.add(inner);
  const crown = gloss(0xfff3b0, { metalness: 0.9, roughness: 0.1, emissive: 0x7a5a00, emissiveIntensity: 0.8 });
  g.add(mesh(CYL, crown, [0, 1.42, 0], [0.3, 0.09, 0.3]));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(mesh(CONE, crown, [Math.cos(a) * 0.24, 1.56, Math.sin(a) * 0.24], [0.07, 0.16, 0.07]));
  }

  return g;
}

const BUILDERS: Record<ToyKind, () => THREE.Group> = {
  bear: () => bear(false),
  goldbear: () => bear(true),
  duck,
  car,
  gift: () => gift(false),
  goldgift: () => gift(true),
  cup,
  bunny,
  robot,
  ball,
  dino,
  pig,
  unicorn,
  penguin,
  panda,
  soccer,
  clown,
  plane,
  train,
  top,
  milk,
  bomb,
  warning: warningBox,
  clock: clockToy,
  star: starToy,
  spread: spreadToy,
  ammo: ammoToy,
  boss: bossToy,
};

export function buildToy(kind: ToyKind): THREE.Group {
  const g = BUILDERS[kind]();
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

export const PICKABLE: ToyKind[] = [
  "bear",
  "duck",
  "car",
  "gift",
  "cup",
  "bunny",
  "robot",
  "ball",
  "dino",
  "pig",
  "penguin",
  "panda",
  "soccer",
  "clown",
  "plane",
  "train",
  "top",
  "milk",
];
