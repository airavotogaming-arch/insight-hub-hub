import * as THREE from "three";
import { GUN_ITEMS, type GunSkin } from "./guns";

export interface Blaster {
  group: THREE.Group;
  muzzle: THREE.Object3D;
  flash: THREE.Mesh;
  flashLight: THREE.PointLight;
  /** detachable magazine / power cell — animated during reloads */
  mag: THREE.Group;
  /** slide, bolt or charging assembly — racked at the end of a reload */
  slide: THREE.Group;
  /** accent light over the magazine well, pulsed during reloads */
  magLight: THREE.PointLight;
}

/** glossy injection-moulded toy plastic */
const plastic = (color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.08, ...opts });

function put<T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0) {
  o.position.set(x, y, z);
  return o;
}

/** rounded slab: a box softened by overlapping insets reads as moulded plastic */
function slab(w: number, h: number, d: number, mat: THREE.Material, r = 0.03) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h - r * 2, d - r * 2), mat));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w - r * 2, h, d - r * 2), mat));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w - r * 2, h - r * 2, d), mat));
  return g;
}

function cyl(rt: number, rb: number, h: number, mat: THREE.Material, seg = 24) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
}

function star5(outer: number, inner: number, depth: number, mat: THREE.Material) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 });
  geo.center();
  return new THREE.Mesh(geo, mat);
}

/** stylised first-person hand + forearm wrapped around the grip */
function addHand(g: THREE.Group, lean: number) {
  const skinLit = plastic(0xf2bd94, { roughness: 0.62, metalness: 0 });
  const skinDark = plastic(0xd89a72, { roughness: 0.7, metalness: 0 });
  const sleeve = plastic(0x2b2f47, { roughness: 0.6, metalness: 0.05 });
  const cuffTrim = plastic(0x3d4468, { roughness: 0.55 });

  const hand = new THREE.Group();
  hand.name = "playerHand";

  // palm pressed against the back strap of the grip
  hand.add(put(slab(0.14, 0.3, 0.11, skinLit, 0.05), 0, -0.235, 0.235));
  // heel of the hand
  hand.add(put(slab(0.135, 0.13, 0.13, skinLit, 0.055), 0, -0.36, 0.265));

  // four fingers curling around the front of the grip
  for (let i = 0; i < 4; i++) {
    const y = -0.115 - i * 0.062;
    const knuckle = slab(0.155, 0.056, 0.08, i % 2 ? skinDark : skinLit, 0.026);
    hand.add(put(knuckle, -0.005, y, 0.065 - i * 0.008));
    const tip = slab(0.13, 0.05, 0.058, skinDark, 0.022);
    hand.add(put(tip, -0.048, y - 0.004, 0.0));
  }

  // thumb laid over the top of the grip
  const thumb = slab(0.062, 0.17, 0.075, skinLit, 0.03);
  thumb.rotation.x = 0.48;
  thumb.rotation.z = -0.32;
  hand.add(put(thumb, 0.078, -0.115, 0.195));

  // wrist + sleeved forearm running back toward the player
  const wrist = cyl(0.086, 0.098, 0.17, skinLit, 20);
  wrist.rotation.x = 1.14;
  hand.add(put(wrist, 0, -0.42, 0.35));
  const cuff = cyl(0.118, 0.124, 0.13, cuffTrim, 22);
  cuff.rotation.x = 1.14;
  hand.add(put(cuff, 0, -0.5, 0.48));
  const arm = cyl(0.108, 0.1, 0.56, sleeve, 22);
  arm.rotation.x = 1.14;
  hand.add(put(arm, 0, -0.64, 0.8));

  hand.rotation.x = lean * 0.45;
  g.add(hand);
}

/** shared pistol grip + trigger group, tuned per shape */
function addGrip(g: THREE.Group, mats: Mats, opts: { lean?: number; pad?: boolean } = {}) {
  const lean = opts.lean ?? -0.24;
  const grip = slab(0.115, 0.36, 0.16, mats.body, 0.045);
  grip.rotation.x = lean;
  g.add(put(grip, 0, -0.22, 0.11));
  if (opts.pad !== false) {
    const gripPad = slab(0.118, 0.22, 0.05, mats.accent, 0.02);
    gripPad.rotation.x = lean;
    g.add(put(gripPad, 0, -0.23, 0.185));
  }
  const gripBase = slab(0.126, 0.045, 0.17, mats.accentDark, 0.02);
  gripBase.rotation.x = lean;
  g.add(put(gripBase, 0, -0.39, 0.15));

  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.019, 10, 24, Math.PI * 1.2), mats.accent);
  guard.rotation.y = Math.PI / 2;
  guard.rotation.z = -1.1;
  g.add(put(guard, 0, -0.12, 0));
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.08, 0.028), mats.trim);
  trigger.rotation.x = 0.28;
  g.add(put(trigger, 0, -0.11, -0.01));

  addHand(g, lean);
}


interface Mats {
  body: THREE.Material;
  bodyDark: THREE.Material;
  accent: THREE.Material;
  accentDark: THREE.Material;
  trim: THREE.Material;
  grey: THREE.Material;
  glow: THREE.Material;
}

export function buildBlaster(skin: GunSkin = GUN_ITEMS[0]!): Blaster {
  const g = new THREE.Group();
  const p = skin.palette;

  const mats: Mats = {
    body: plastic(p.body),
    bodyDark: plastic(p.bodyDark, { roughness: 0.35 }),
    accent: plastic(p.accent),
    accentDark: plastic(p.accentDark, { roughness: 0.35 }),
    trim: plastic(p.trim),
    grey: plastic(0x2a2f3a, { roughness: 0.5, metalness: 0.2 }),
    glow: plastic(p.glow, { emissive: p.glow, emissiveIntensity: 1.3, roughness: 0.15 }),
  };

  // moving assemblies: the magazine drops free and the slide racks on reload
  const mag = new THREE.Group();
  const slide = new THREE.Group();
  g.add(mag);
  g.add(slide);

  let muzzleZ = -0.88;

  if (skin.shape === "blaster") {
    // ---- carnival toy blaster (original) ----
    const body = slab(0.19, 0.24, 0.78, mats.body, 0.05);
    g.add(put(body, 0, 0.02, -0.06));

    for (const s of [-1, 1]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.035, 0.3), mats.trim);
      g.add(put(stripe, s * 0.096, 0.085, -0.16));
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.02, 0.22), mats.accent);
      g.add(put(lower, s * 0.096, -0.04, -0.12));
    }

    const hump = slab(0.13, 0.09, 0.34, mats.bodyDark, 0.03);
    g.add(put(hump, 0, 0.16, -0.16));
    g.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.03), mats.accent), 0, 0.22, -0.3));

    const collar = cyl(0.105, 0.108, 0.1, mats.bodyDark);
    collar.rotation.x = Math.PI / 2;
    g.add(put(collar, 0, 0.015, -0.34));
    const shroud = cyl(0.088, 0.1, 0.38, mats.accent);
    shroud.rotation.x = Math.PI / 2;
    g.add(put(shroud, 0, 0.015, -0.55));

    for (const z of [-0.45, -0.6]) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.102, 0.015, 10, 28), mats.accentDark);
      g.add(put(t, 0, 0.015, z));
    }

    const ring = cyl(0.14, 0.128, 0.12, mats.accent, 28);
    ring.rotation.x = Math.PI / 2;
    g.add(put(ring, 0, 0.015, -0.77));
    g.add(put(new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.022, 12, 30), mats.trim), 0, 0.015, -0.825));
    const bore = cyl(0.075, 0.075, 0.14, mats.grey, 26);
    bore.rotation.x = Math.PI / 2;
    g.add(put(bore, 0, 0.015, -0.79));
    const boreGlow = cyl(0.06, 0.06, 0.01, mats.glow, 22);
    boreGlow.rotation.x = Math.PI / 2;
    g.add(put(boreGlow, 0, 0.015, -0.845));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const hole = cyl(0.018, 0.018, 0.05, mats.bodyDark, 14);
      hole.rotation.x = Math.PI / 2;
      g.add(put(hole, Math.cos(a) * 0.108, 0.015 + Math.sin(a) * 0.108, -0.82));
    }

    // the side drum doubles as the swappable ammo canister
    const drum = cyl(0.11, 0.11, 0.12, mats.accent, 24);
    drum.rotation.z = Math.PI / 2;
    mag.add(put(drum, -0.15, 0.02, -0.28));
    const drumRim = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.016, 10, 26), mats.accentDark);
    drumRim.rotation.y = Math.PI / 2;
    mag.add(put(drumRim, -0.2, 0.02, -0.28));
    const drumCap = cyl(0.042, 0.042, 0.15, mats.trim, 18);
    drumCap.rotation.z = Math.PI / 2;
    mag.add(put(drumCap, -0.18, 0.02, -0.28));

    // priming slider on the top hump racks after a fresh canister goes in
    const primer = slab(0.07, 0.05, 0.16, mats.trim, 0.02);
    slide.add(put(primer, 0, 0.21, -0.05));

    const emblem = star5(0.05, 0.022, 0.014, mats.trim);
    emblem.rotation.y = Math.PI / 2;
    g.add(put(emblem, 0.108, -0.005, -0.12));

    addGrip(g, mats);

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), mats.glow);
    g.add(put(core, 0, 0.13, 0.06));
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.011, 10, 20), mats.trim);
    coreRing.rotation.x = Math.PI / 2;
    g.add(put(coreRing, 0, 0.12, 0.06));
  } else if (skin.shape === "pistol" || skin.shape === "ranger") {
    // ---- semi-auto pistol: frame + slide + short barrel ----
    const frame = slab(0.16, 0.2, 0.62, mats.bodyDark, 0.04);
    g.add(put(frame, 0, -0.02, -0.02));

    const slideBody = slab(0.17, 0.16, 0.8, mats.body, 0.035);
    slide.add(put(slideBody, 0, 0.13, -0.14));

    // ejection-port / accent panel on the slide flanks
    for (const s of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.3), mats.accent);
      slide.add(put(panel, s * 0.088, 0.14, -0.2));
    }

    // rear cocking serrations
    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.176, 0.13, 0.014), mats.bodyDark);
      slide.add(put(rib, 0, 0.13, 0.14 - i * 0.045));
    }

    // takedown / safety studs
    for (let i = 0; i < 3; i++) {
      const stud = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.018, 0.05), mats.trim);
      g.add(put(stud, 0.085, 0.03 + i * 0.032, -0.02));
    }

    // sights ride with the slide
    slide.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.03, 0.026), mats.trim), 0, 0.225, -0.48));
    slide.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.028, 0.03), mats.bodyDark), 0, 0.222, 0.16));

    // detachable magazine seated in the grip
    const magBody = slab(0.1, 0.34, 0.13, mats.bodyDark, 0.02);
    magBody.rotation.x = -0.3;
    mag.add(put(magBody, 0, -0.26, 0.13));
    const magPlate = slab(0.12, 0.035, 0.15, mats.accent, 0.015);
    magPlate.rotation.x = -0.3;
    mag.add(put(magPlate, 0, -0.42, 0.18));


    // barrel poking out of the slide
    const barrel = cyl(0.05, 0.05, 0.2, mats.grey, 22);
    barrel.rotation.x = Math.PI / 2;
    g.add(put(barrel, 0, 0.13, -0.62));
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 10, 24), mats.bodyDark);
    g.add(put(crown, 0, 0.13, -0.7));
    const bore = cyl(0.032, 0.032, 0.012, mats.glow, 18);
    bore.rotation.x = Math.PI / 2;
    g.add(put(bore, 0, 0.13, -0.715));

    // grip with textured side plate
    addGrip(g, mats, { lean: -0.3, pad: false });
    for (const s of [-1, 1]) {
      const plate = slab(0.02, 0.24, 0.1, skin.shape === "ranger" ? mats.accent : mats.trim, 0.012);
      plate.rotation.x = -0.3;
      g.add(put(plate, s * 0.062, -0.23, 0.12));
      for (let i = 0; i < 2; i++) {
        const screw = cyl(0.011, 0.011, 0.026, mats.accent, 12);
        screw.rotation.z = Math.PI / 2;
        g.add(put(screw, s * 0.072, -0.15 - i * 0.16, 0.14 - i * 0.05));
      }
    }

    if (skin.shape === "ranger") {
      // red muzzle collar + yellow vent slots, straight off the icon render
      const collar = cyl(0.062, 0.062, 0.07, mats.accent, 22);
      collar.rotation.x = Math.PI / 2;
      g.add(put(collar, 0, 0.13, -0.66));
      for (let i = 0; i < 3; i++) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.05, 0.02), mats.trim);
        g.add(put(vent, 0.085, 0.14, -0.24 - i * 0.05));
      }
      const topStripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.014, 0.34), mats.accent);
      g.add(put(topStripe, 0, 0.21, -0.2));
    }

    muzzleZ = -0.78;
  } else if (skin.shape === "raygun") {
    // ---- retro ray gun: chunky teal body, coil stack, stub barrel ----
    const rear = slab(0.2, 0.26, 0.34, mats.bodyDark, 0.05);
    g.add(put(rear, 0, 0.06, 0.12));

    // pastel light buttons on the rear block
    for (let i = 0; i < 3; i++) {
      const btn = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.035), mats.glow);
      g.add(put(btn, 0.1, 0.1, 0.2 - i * 0.06));
    }

    const body = slab(0.21, 0.22, 0.6, mats.body, 0.06);
    g.add(put(body, 0, 0.08, -0.24));

    // white light strips along the tank
    for (const s of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.016, 0.34), mats.trim);
        g.add(put(strip, s * 0.1, 0.14 - i * 0.06, -0.26));
      }
    }

    // coil stack under the tank — the front coil is the swappable power cell
    for (let i = 0; i < 3; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.028, 12, 26), i === 0 ? mats.glow : mats.trim);
      (i === 0 ? mag : g).add(put(coil, 0, -0.03, -0.34 - i * 0.11));
    }
    const cell = cyl(0.05, 0.05, 0.16, mats.accentDark, 18);
    cell.rotation.x = Math.PI / 2;
    mag.add(put(cell, 0, -0.03, -0.34));

    const spine = cyl(0.038, 0.038, 0.5, mats.grey, 18);
    spine.rotation.x = Math.PI / 2;
    g.add(put(spine, 0, -0.03, -0.4));
    const tip = cyl(0.05, 0.05, 0.1, mats.bodyDark, 18);
    tip.rotation.x = Math.PI / 2;
    g.add(put(tip, 0, -0.03, -0.66));

    // yellow emitter on the top rail
    const emitter = cyl(0.045, 0.045, 0.22, mats.accent, 20);
    emitter.rotation.x = Math.PI / 2;
    g.add(put(emitter, 0, 0.2, -0.44));
    const emitterGlow = cyl(0.034, 0.034, 0.012, mats.glow, 18);
    emitterGlow.rotation.x = Math.PI / 2;
    g.add(put(emitterGlow, 0, 0.2, -0.556));
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.05), mats.accent);
    slide.add(put(fin, 0, 0.2, 0.02));

    addGrip(g, mats, { lean: -0.2, pad: false });
    const gripGlow = slab(0.05, 0.2, 0.04, mats.glow, 0.015);
    gripGlow.rotation.x = -0.2;
    g.add(put(gripGlow, 0.055, -0.24, 0.16));

    muzzleZ = -0.72;
  } else if (skin.shape === "rail") {
    // ---- aurora railgun: slim chassis, twin accelerator rails, charged core ----
    const chassis = slab(0.17, 0.22, 0.9, mats.bodyDark, 0.045);
    g.add(put(chassis, 0, 0.04, -0.12));
    const spineDeck = slab(0.12, 0.06, 0.72, mats.body, 0.02);
    g.add(put(spineDeck, 0, 0.17, -0.2));

    // twin accelerator rails with glowing inner strips
    for (const s of [-1, 1]) {
      const railBar = slab(0.05, 0.07, 0.86, mats.body, 0.02);
      g.add(put(railBar, s * 0.12, 0.08, -0.44));
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.02, 0.74), mats.glow);
      g.add(put(strip, s * 0.096, 0.08, -0.44));
      for (let i = 0; i < 4; i++) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.03), mats.accentDark);
        g.add(put(brace, s * 0.12, 0.08, -0.16 - i * 0.2));
      }
    }

    // charged core stack between the rails (the swappable cell)
    const cellHousing = slab(0.13, 0.14, 0.24, mats.accentDark, 0.03);
    mag.add(put(cellHousing, 0, -0.06, 0.06));
    for (let i = 0; i < 3; i++) {
      const cellRing = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 10, 24), mats.glow);
      cellRing.rotation.x = Math.PI / 2;
      mag.add(put(cellRing, 0, -0.06, 0.14 - i * 0.08));
    }

    // floating focus coils around the barrel line
    for (let i = 0; i < 3; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 10, 28), i === 1 ? mats.accent : mats.trim);
      coil.rotation.x = Math.PI / 2;
      g.add(put(coil, 0, 0.08, -0.5 - i * 0.16));
    }
    const emitterCone = cyl(0.045, 0.085, 0.16, mats.accent, 24);
    emitterCone.rotation.x = -Math.PI / 2;
    g.add(put(emitterCone, 0, 0.08, -0.96));
    const emitterGlow = cyl(0.038, 0.038, 0.012, mats.glow, 20);
    emitterGlow.rotation.x = Math.PI / 2;
    g.add(put(emitterGlow, 0, 0.08, -1.04));

    // charge indicator bar + racking lever
    for (let i = 0; i < 5; i++) {
      const pip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.026, 0.05), i < 3 ? mats.glow : mats.trim);
      g.add(put(pip, 0.088, 0.16, 0.06 - i * 0.07));
    }
    slide.add(put(slab(0.06, 0.06, 0.2, mats.trim, 0.02), 0, 0.235, -0.02));

    addGrip(g, mats, { lean: -0.26, pad: false });
    muzzleZ = -1.06;
  } else if (skin.shape === "scatter") {
    // ---- cyclone scattergun: quad barrels, brass furniture, break-action ----
    const receiver = slab(0.24, 0.26, 0.5, mats.bodyDark, 0.05);
    g.add(put(receiver, 0, 0.03, 0.06));
    const plate = slab(0.25, 0.1, 0.2, mats.accent, 0.03);
    g.add(put(plate, 0, 0.16, 0.1));

    // 2x2 barrel cluster
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const barrel = cyl(0.058, 0.062, 0.78, mats.body, 22);
        barrel.rotation.x = Math.PI / 2;
        g.add(put(barrel, sx * 0.065, 0.03 + sy * 0.065, -0.5));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.014, 10, 22), mats.accent);
        g.add(put(ring, sx * 0.065, 0.03 + sy * 0.065, -0.86));
        const boreGlow = cyl(0.036, 0.036, 0.01, mats.glow, 16);
        boreGlow.rotation.x = Math.PI / 2;
        g.add(put(boreGlow, sx * 0.065, 0.03 + sy * 0.065, -0.9));
      }
    }
    // clamps binding the cluster
    for (let i = 0; i < 3; i++) {
      const clamp = slab(0.27, 0.27, 0.05, mats.accentDark, 0.03);
      g.add(put(clamp, 0, 0.03, -0.28 - i * 0.24));
    }

    // wooden-look pump / fore-end that racks on reload
    const pump = slab(0.2, 0.12, 0.3, mats.trim, 0.05);
    slide.add(put(pump, 0, -0.1, -0.42));

    // shell carrier under the receiver
    const carrier = slab(0.16, 0.16, 0.3, mats.accentDark, 0.03);
    carrier.rotation.x = -0.1;
    mag.add(put(carrier, 0, -0.15, 0.14));
    for (let i = 0; i < 3; i++) {
      const shell = cyl(0.03, 0.03, 0.12, mats.accent, 14);
      shell.rotation.x = Math.PI / 2;
      mag.add(put(shell, -0.05 + i * 0.05, -0.15, 0.06));
    }

    // bead sight + stock stub
    g.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), mats.glow), 0, 0.13, -0.84));
    const stock = slab(0.18, 0.2, 0.26, mats.trim, 0.05);
    g.add(put(stock, 0, -0.02, 0.42));

    addGrip(g, mats, { lean: -0.3 });
    muzzleZ = -0.94;
  } else if (skin.shape === "gatling") {
    // ---- vortex gatling: six spinning barrels, drum, heat shroud ----
    const housing = slab(0.26, 0.26, 0.42, mats.body, 0.06);
    g.add(put(housing, 0, 0.05, 0.12));
    const shroud = cyl(0.17, 0.17, 0.34, mats.bodyDark, 28);
    shroud.rotation.x = Math.PI / 2;
    g.add(put(shroud, 0, 0.05, -0.16));
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.014, 10, 30), mats.accent);
      g.add(put(fin, 0, 0.05, -0.04 - i * 0.09));
    }

    // the barrel cluster spins with the "slide" assembly
    const cluster = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = cyl(0.032, 0.032, 0.7, mats.trim, 16);
      b.rotation.x = Math.PI / 2;
      cluster.add(put(b, Math.cos(a) * 0.095, Math.sin(a) * 0.095, -0.62));
      const glowTip = cyl(0.026, 0.026, 0.01, mats.glow, 14);
      glowTip.rotation.x = Math.PI / 2;
      cluster.add(put(glowTip, Math.cos(a) * 0.095, Math.sin(a) * 0.095, -0.97));
    }
    const hub = cyl(0.06, 0.06, 0.12, mats.accentDark, 20);
    hub.rotation.x = Math.PI / 2;
    cluster.add(put(hub, 0, 0, -0.36));
    cluster.position.set(0, 0.05, 0);
    slide.add(cluster);

    const nose = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 12, 30), mats.accent);
    g.add(put(nose, 0, 0.05, -0.94));

    // side ammo drum (magazine) with feed chute
    const drum = cyl(0.16, 0.16, 0.16, mats.bodyDark, 26);
    drum.rotation.z = Math.PI / 2;
    mag.add(put(drum, -0.2, -0.02, 0.24));
    const drumFace = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.018, 10, 28), mats.accent);
    drumFace.rotation.y = Math.PI / 2;
    mag.add(put(drumFace, -0.28, -0.02, 0.24));
    const chute = slab(0.14, 0.09, 0.22, mats.accentDark, 0.02);
    mag.add(put(chute, -0.1, 0.02, 0.16));
    for (let i = 0; i < 4; i++) {
      const link = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.035), mats.glow);
      mag.add(put(link, -0.06, 0.02, 0.24 - i * 0.06));
    }

    // top carry handle + power core
    const handle = slab(0.07, 0.05, 0.3, mats.trim, 0.02);
    g.add(put(handle, 0, 0.26, -0.02));
    for (const s of [-1, 1]) g.add(put(slab(0.06, 0.1, 0.06, mats.trim, 0.02), 0, 0.21, s * 0.14));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), mats.glow);
    g.add(put(core, 0.13, 0.06, 0.2));

    addGrip(g, mats, { lean: -0.2, pad: true });
    muzzleZ = -1.02;
  } else {
    // ---- recon SMG: suppressor, red-dot, folding stock, magazine ----
    const receiver = slab(0.2, 0.26, 0.86, mats.body, 0.04);
    g.add(put(receiver, 0, 0.04, -0.04));

    // upper rail panels
    const rail = slab(0.14, 0.07, 0.5, mats.trim, 0.02);
    g.add(put(rail, 0, 0.19, -0.06));
    for (let i = 0; i < 5; i++) {
      const notch = new THREE.Mesh(new THREE.BoxGeometry(0.146, 0.076, 0.014), mats.bodyDark);
      g.add(put(notch, 0, 0.19, 0.1 - i * 0.06));
    }

    // red dot sight
    const mount = slab(0.1, 0.07, 0.1, mats.bodyDark, 0.02);
    g.add(put(mount, 0, 0.26, -0.18));
    const optic = slab(0.12, 0.13, 0.14, mats.body, 0.03);
    g.add(put(optic, 0, 0.35, -0.2));
    const lens = cyl(0.045, 0.045, 0.012, mats.glow, 20);
    lens.rotation.x = Math.PI / 2;
    g.add(put(lens, 0, 0.35, -0.272));
    g.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.02), mats.accent), 0.04, 0.39, -0.2));

    // charging handle (racks on reload) + fire selector in red
    slide.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.05), mats.accent), 0.1, 0.14, -0.3));
    g.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.09), mats.accent), 0.1, -0.03, 0.02));
    for (let i = 0; i < 4; i++) {
      const cut = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.02), mats.bodyDark);
      g.add(put(cut, 0.101, 0.06, -0.2 + i * 0.045));
    }

    // suppressor
    const can = slab(0.15, 0.15, 0.62, mats.body, 0.02);
    g.add(put(can, 0, 0.06, -0.78));
    g.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.152, 0.06, 0.16), mats.bodyDark), 0, 0.06, -0.72));
    const bore = cyl(0.04, 0.04, 0.012, mats.glow, 18);
    bore.rotation.x = Math.PI / 2;
    g.add(put(bore, 0, 0.06, -1.086));

    // magazine
    const magBody = slab(0.11, 0.34, 0.13, mats.bodyDark, 0.02);
    magBody.rotation.x = -0.12;
    mag.add(put(magBody, 0, -0.28, 0.2));
    const magFloor = slab(0.13, 0.035, 0.15, mats.accent, 0.015);
    magFloor.rotation.x = -0.12;
    mag.add(put(magFloor, 0, -0.45, 0.22));

    // folding stock arms
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.05, 0.34), mats.trim);
      g.add(put(arm, s * 0.075, 0.03, 0.5));
    }
    const butt = slab(0.19, 0.22, 0.07, mats.body, 0.02);
    g.add(put(butt, 0, 0.03, 0.68));

    addGrip(g, mats, { lean: -0.22, pad: false });
    muzzleZ = -1.14;
  }

  // ---- muzzle anchor + flash ----
  const muzzle = new THREE.Object3D();
  const muzzleY =
    skin.shape === "smg" ? 0.06
    : skin.shape === "rail" ? 0.08
    : skin.shape === "scatter" ? 0.03
    : skin.shape === "gatling" ? 0.05
    : 0.015;
  muzzle.position.set(0, muzzleY, muzzleZ);
  g.add(muzzle);

  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffdd66, transparent: true, opacity: 0, depthWrite: false }),
  );
  flash.position.copy(muzzle.position);
  flash.scale.set(1, 1, 1.6);
  g.add(flash);

  const flashLight = new THREE.PointLight(0xffc04d, 0, 6, 2);
  flashLight.position.copy(muzzle.position);
  g.add(flashLight);

  // accent light hovering over the magazine well / chamber, lit during reloads
  const magLight = new THREE.PointLight(0xbfe6ff, 0, 2.2, 2);
  magLight.position.set(0.14, -0.16, 0.1);
  g.add(magLight);

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });

  return { group: g, muzzle, flash, flashLight, mag, slide, magLight };
}
