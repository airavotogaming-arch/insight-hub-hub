import * as THREE from "three";

/**
 * The world around the booth: a gradient sky dome with a sun / moon, a field of
 * stars, neighbouring fair stalls, a turning ferris wheel, a swing carousel,
 * string lights and distant treeline. Everything reacts to time of day.
 */

const mat = (color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.04, ...opts });

const SKY_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vWorld = normalize((modelMatrix * vec4(position, 1.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uBottom;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunSize;
  uniform float uGlow;
  varying vec3 vWorld;

  void main() {
    vec3 d = normalize(vWorld);
    float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uBottom, uMid, smoothstep(0.35, 0.52, h));
    col = mix(col, uTop, smoothstep(0.52, 0.95, h));

    // sun / moon disc plus a soft halo
    float c = max(dot(d, normalize(uSunDir)), 0.0);
    float disc = smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.45, c);
    float halo = pow(c, 24.0) * uGlow;
    col += uSunColor * (disc * 1.4 + halo);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    vAlpha = uOpacity * (0.55 + 0.45 * sin(uTime * 1.8 + aPhase));
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const STAR_FRAG = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vAlpha;
    if (a <= 0.01) discard;
    gl_FragColor = vec4(1.0, 0.97, 0.9, a);
  }
`;

export interface CarnivalEnv {
  root: THREE.Group;
  setTimeOfDay(day: boolean): void;
  update(t: number, dt: number): void;
}

function tentStall(
  colorA: number,
  colorB: number,
  neonColor: number,
  width: number,
  height: number,
): { group: THREE.Group; neon: THREE.PointLight; emissive: THREE.MeshStandardMaterial[] } {
  const g = new THREE.Group();
  const emissive: THREE.MeshStandardMaterial[] = [];

  // body
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, width * 0.75), mat(0xf1e3c8, { roughness: 0.85 }));
  body.position.y = height / 2;
  g.add(body);

  // striped canopy
  const stripes = Math.max(6, Math.round(width * 3));
  for (let i = 0; i < stripes; i++) {
    const t = i / (stripes - 1) - 0.5;
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(width / stripes, 0.16, width * 0.95),
      mat(i % 2 === 0 ? colorA : colorB, { roughness: 0.75 }),
    );
    p.position.set(t * width, height + 0.12 - Math.abs(t) * 0.5, 0);
    p.rotation.z = -Math.sign(t) * 0.32;
    g.add(p);
  }

  // conical peak
  const peak = new THREE.Mesh(new THREE.ConeGeometry(width * 0.62, height * 0.55, 10), mat(colorA, { roughness: 0.7 }));
  peak.position.y = height + height * 0.32;
  g.add(peak);
  const flag = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 4), mat(colorB));
  flag.position.y = height + height * 0.62;
  g.add(flag);

  // glowing sign board
  const signMat = mat(0x150a1c, { emissive: neonColor, emissiveIntensity: 1.2, roughness: 0.4 });
  emissive.push(signMat);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(width * 0.7, height * 0.22, 0.12), signMat);
  sign.position.set(0, height * 0.78, width * 0.4);
  g.add(sign);

  // counter + posts
  const post = mat(0x51301c, { roughness: 0.85 });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, height, 0.14), post);
    p.position.set(s * width * 0.48, height / 2, width * 0.4);
    g.add(p);
  }

  const neon = new THREE.PointLight(neonColor, 6, width * 4, 2);
  neon.position.set(0, height * 0.8, width * 0.7);
  g.add(neon);

  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = false;
      m.receiveShadow = false;
    }
  });

  return { group: g, neon, emissive };
}

export function buildCarnival(scene: THREE.Scene, low = false): CarnivalEnv {
  const root = new THREE.Group();
  scene.add(root);

  const neonLights: { light: THREE.PointLight; base: number }[] = [];
  const emissiveMats: { m: THREE.MeshStandardMaterial; base: number }[] = [];

  // ---------------------------------------------------------------- sky dome
  const skyUniforms = {
    uTop: { value: new THREE.Color(0x0a0620) },
    uMid: { value: new THREE.Color(0x2a1440) },
    uBottom: { value: new THREE.Color(0x120a1e) },
    uSunDir: { value: new THREE.Vector3(-0.4, 0.55, -1).normalize() },
    uSunColor: { value: new THREE.Color(0xdfe6ff) },
    uSunSize: { value: 0.006 },
    uGlow: { value: 0.25 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(90, 40, 24),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  sky.frustumCulled = false;
  root.add(sky);

  // ---------------------------------------------------------------- stars
  const STARS = low ? 260 : 900;
  const pos = new Float32Array(STARS * 3);
  const size = new Float32Array(STARS);
  const phase = new Float32Array(STARS);
  for (let i = 0; i < STARS; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.acos(1 - Math.random() * 0.85); // upper hemisphere bias
    const r = 78;
    pos[i * 3] = Math.sin(v) * Math.cos(u) * r;
    pos[i * 3 + 1] = Math.cos(v) * r * 0.9 + 6;
    pos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * r;
    size[i] = 0.7 + Math.random() * 1.9;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  starGeo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  const starUniforms = { uTime: { value: 0 }, uOpacity: { value: 1 } };
  const stars = new THREE.Points(
    starGeo,
    new THREE.ShaderMaterial({
      uniforms: starUniforms,
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  stars.frustumCulled = false;
  root.add(stars);

  // ------------------------------------------------------ fairground ground
  const fairGround = new THREE.Mesh(
    new THREE.CircleGeometry(80, 48),
    mat(0x3a2a22, { roughness: 1 }),
  );
  fairGround.rotation.x = -Math.PI / 2;
  fairGround.position.y = -1.62;
  root.add(fairGround);

  // --------------------------------------------------------- neighbour stalls
  const palettes: [number, number, number][] = [
    [0xff4d6d, 0xf6e4c8, 0xff2f92],
    [0x2ad4ff, 0xf6e4c8, 0x2ad4ff],
    [0xffd93d, 0xb3161f, 0xffb547],
    [0x8ef07a, 0xf6e4c8, 0x54ff9f],
    [0xb794ff, 0x2a1533, 0xb05cff],
    [0xff8a1e, 0xf6e4c8, 0xff6a00],
  ];
  const layout: { x: number; z: number; ry: number; w: number; h: number }[] = [
    { x: -11, z: -3, ry: 0.55, w: 4.4, h: 3.2 },
    { x: -15.5, z: -12, ry: 0.35, w: 5.2, h: 3.6 },
    { x: 11.5, z: -3.5, ry: -0.55, w: 4.6, h: 3.3 },
    { x: 16, z: -12.5, ry: -0.32, w: 5.4, h: 3.8 },
    { x: -7, z: -20, ry: 0.1, w: 6, h: 4 },
    { x: 7.5, z: -21, ry: -0.1, w: 6.2, h: 4.2 },
    { x: -22, z: -24, ry: 0.28, w: 7, h: 4.6 },
    { x: 23, z: -25, ry: -0.28, w: 7, h: 4.6 },
  ];
  (low ? layout.slice(0, 4) : layout).forEach((s, i) => {
    const p = palettes[i % palettes.length]!;
    const stall = tentStall(p[0], p[1], p[2], s.w, s.h);
    stall.group.position.set(s.x, -1.6, s.z);
    stall.group.rotation.y = s.ry;
    root.add(stall.group);
    if (low) stall.group.remove(stall.neon);
    else neonLights.push({ light: stall.neon, base: stall.neon.intensity });
    for (const m of stall.emissive) emissiveMats.push({ m, base: m.emissiveIntensity });
  });

  // ------------------------------------------------------------ ferris wheel
  const wheelPivot = new THREE.Group();
  wheelPivot.position.set(-24, 9.5, -40);
  root.add(wheelPivot);
  const spokeMat = mat(0xd8d8e2, { metalness: 0.6, roughness: 0.35 });
  const wheel = new THREE.Group();
  const rimGeo = new THREE.TorusGeometry(9, 0.22, 8, 48);
  for (const z of [-0.9, 0.9]) {
    const rim = new THREE.Mesh(rimGeo, spokeMat);
    rim.position.z = z;
    wheel.add(rim);
  }
  const cabinColors = [0xff4d6d, 0xffd93d, 0x2ad4ff, 0x8ef07a, 0xb794ff];
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff3cf,
    emissive: 0xffcf6b,
    emissiveIntensity: 1.4,
    roughness: 0.3,
    fog: false,
  });
  emissiveMats.push({ m: bulbMat, base: bulbMat.emissiveIntensity });
  const bulbGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const cabins: THREE.Mesh[] = [];
  const CABINS = low ? 8 : 16;
  for (let i = 0; i < CABINS; i++) {
    const a = (i / CABINS) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.1, 9, 0.1), spokeMat);
    spoke.position.set(Math.cos(a) * 4.5, Math.sin(a) * 4.5, 0);
    spoke.rotation.z = a - Math.PI / 2;
    wheel.add(spoke);

    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.3, 1.5),
      mat(cabinColors[i % cabinColors.length]!, { roughness: 0.5 }),
    );
    cab.position.set(Math.cos(a) * 9.6, Math.sin(a) * 9.6, 0);
    wheel.add(cab);
    cabins.push(cab);

    const b = new THREE.Mesh(bulbGeo, bulbMat);
    b.position.set(Math.cos(a) * 9, Math.sin(a) * 9, 1.15);
    wheel.add(b);
  }

  wheelPivot.add(wheel);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 14, 0.5), spokeMat);
    leg.position.set(s * 4.4, -6.4, 0);
    leg.rotation.z = -s * 0.32;
    wheelPivot.add(leg);
  }
  const wheelGlow = new THREE.PointLight(0xffb547, 18, 60, 2);
  wheelGlow.position.set(-24, 10, -36);
  root.add(wheelGlow);
  neonLights.push({ light: wheelGlow, base: wheelGlow.intensity });

  // ---------------------------------------------------------- swing carousel
  const carousel = new THREE.Group();
  carousel.position.set(22, -1.6, -34);
  root.add(carousel);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 12, 12), spokeMat);
  mast.position.y = 6;
  carousel.add(mast);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(6, 3, 16), mat(0xff4d6d, { roughness: 0.7 }));
  canopy.position.y = 12.4;
  carousel.add(canopy);
  const swingRing = new THREE.Group();
  swingRing.position.y = 10.4;
  carousel.add(swingRing);
  const SEATS = low ? 5 : 10;
  for (let i = 0; i < SEATS; i++) {
    const a = (i / SEATS) * Math.PI * 2;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), mat(cabinColors[i % 5]!));
    seat.position.set(Math.cos(a) * 5.6, -3.2, Math.sin(a) * 5.6);
    swingRing.add(seat);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 5), spokeMat);
    rope.position.set(Math.cos(a) * 5.2, -1.6, Math.sin(a) * 5.2);
    rope.rotation.z = -Math.cos(a) * 0.16;
    rope.rotation.x = Math.sin(a) * 0.16;
    swingRing.add(rope);
  }
  if (!low) {
    const carouselGlow = new THREE.PointLight(0xff7ac4, 12, 44, 2);
    carouselGlow.position.set(22, 10, -30);
    root.add(carouselGlow);
    neonLights.push({ light: carouselGlow, base: carouselGlow.intensity });
  }

  // ----------------------------------------------------------- string lights
  const stringBulbs: THREE.Mesh[] = [];
  const poleMat = mat(0x4a2a16, { roughness: 0.9 });
  const poles = low ? [-30, -8, 8, 30] : [-30, -18, -8, 8, 18, 30];
  poles.forEach((x, i) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 9, 8), poleMat);
    pole.position.set(x, 2.9, -16 - (i % 2) * 3);
    root.add(pole);
  });
  for (let seg = 0; seg < poles.length - 1; seg++) {
    const x0 = poles[seg]!;
    const x1 = poles[seg + 1]!;
    const z0 = -16 - (seg % 2) * 3;
    const z1 = -16 - ((seg + 1) % 2) * 3;
    const BULBS = low ? 6 : 14;
    for (let i = 0; i < BULBS; i++) {
      const t = i / (BULBS - 1);
      const b = new THREE.Mesh(bulbGeo, bulbMat);
      b.position.set(
        THREE.MathUtils.lerp(x0, x1, t),
        7.2 - Math.sin(t * Math.PI) * 1.6,
        THREE.MathUtils.lerp(z0, z1, t),
      );
      b.scale.setScalar(0.8);
      root.add(b);
      stringBulbs.push(b);
    }
  }

  // --------------------------------------------------------------- treeline
  const trunkMat = mat(0x33231a, { roughness: 1 });
  const leafMat = mat(0x1f3d24, { roughness: 0.95 });
  for (let i = 0; i < (low ? 14 : 40); i++) {
    const a = Math.PI * (0.08 + Math.random() * 0.84);
    const r = 52 + Math.random() * 20;
    const x = Math.cos(a) * r * (Math.random() > 0.5 ? 1 : -1);
    const z = -Math.abs(Math.sin(a) * r) - 10;
    const h = 6 + Math.random() * 6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, h, 6), trunkMat);
    trunk.position.set(x, -1.6 + h / 2, z);
    root.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.6 + Math.random(), h * 0.9, 7), leafMat);
    crown.position.set(x, -1.6 + h * 0.95, z);
    root.add(crown);
  }

  // ----------------------------------------------------------------- clouds
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    transparent: true,
    opacity: 0,
    fog: false,
  });
  const clouds = new THREE.Group();
  root.add(clouds);
  for (let i = 0; i < (low ? 5 : 12); i++) {
    const puff = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 2.4, 10, 8), cloudMat);
      s.position.set((j - 1.5) * 3.4, Math.random() * 1.4, Math.random() * 2);
      s.scale.y = 0.6;
      puff.add(s);
    }
    puff.position.set(
      THREE.MathUtils.randFloatSpread(120),
      26 + Math.random() * 14,
      -30 - Math.random() * 40,
    );
    clouds.add(puff);
  }

  // ------------------------------------------------------------- day / night
  let isDay = false;
  const setTimeOfDay = (day: boolean) => {
    isDay = day;
    if (day) {
      skyUniforms.uTop.value.setHex(0x2f7fd6);
      skyUniforms.uMid.value.setHex(0x8ec8f2);
      skyUniforms.uBottom.value.setHex(0xe6efe1);
      skyUniforms.uSunDir.value.set(-0.45, 0.62, -1).normalize();
      skyUniforms.uSunColor.value.setHex(0xfff3c4);
      skyUniforms.uSunSize.value = 0.004;
      skyUniforms.uGlow.value = 0.55;
      starUniforms.uOpacity.value = 0;
      cloudMat.opacity = 0.9;
    } else {
      skyUniforms.uTop.value.setHex(0x070418);
      skyUniforms.uMid.value.setHex(0x241041);
      skyUniforms.uBottom.value.setHex(0x2b1030);
      skyUniforms.uSunDir.value.set(0.5, 0.5, -1).normalize();
      skyUniforms.uSunColor.value.setHex(0xdfe6ff);
      skyUniforms.uSunSize.value = 0.007;
      skyUniforms.uGlow.value = 0.18;
      starUniforms.uOpacity.value = 1;
      cloudMat.opacity = 0.12;
    }
    for (const n of neonLights) n.light.intensity = n.base * (day ? 0.2 : 1);
    for (const e of emissiveMats) e.m.emissiveIntensity = e.base * (day ? 0.25 : 1);
    (fairGround.material as THREE.MeshStandardMaterial).color.setHex(day ? 0x8a7357 : 0x3a2a22);
  };
  setTimeOfDay(false);

  const update = (t: number, dt: number) => {
    starUniforms.uTime.value = t;
    wheel.rotation.z = t * 0.12;
    for (const c of cabins) c.rotation.z = -wheel.rotation.z;

    swingRing.rotation.y = t * 0.55;
    clouds.position.x = ((t * 0.35) % 140) - 70;
    // gentle twinkle on the fair's bulbs
    bulbMat.emissiveIntensity =
      (isDay ? 0.35 : 1.4) * (0.85 + 0.15 * Math.sin(t * 3.1));
    void dt;
  };

  return { root, setTimeOfDay, update };
}
