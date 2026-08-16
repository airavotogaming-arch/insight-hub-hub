import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildBooth, SHELVES } from "./booth";
import { buildCarnival, type CarnivalEnv } from "./carnival";
import { buildBlaster } from "./blaster";
import { getGunSkin } from "./guns";
import { buildToy, PICKABLE, TOY_SPECS, type ToyKind } from "./toys";
import { secureSet, safeInt, secureGetOrMigrate, legacyNumber } from "./secureStore";

const BEST_KEY = "carnival-best";
const BANK_KEY = "carnival-bank";
const MAX_SCORE = 99_999_999;
const MAX_BANK = 9_999_999;
/**
 * Anti-cheat ceilings. Best legit shot is a golden gift (1000) at combo x10
 * with Double Score (x2), and Spread Shot can clear a few targets per trigger
 * pull — so allow generous headroom and still reject fabricated scores.
 */
const MAX_POINTS_PER_SHOT = 60_000;
const SCORE_SLACK = 50_000;

export interface GameState {
  score: number;
  best: number;
  tickets: number;
  combo: number;
  timeLeft: number;
  phase: "idle" | "playing" | "paused" | "over";
  hits: number;
  shots: number;
  prizes: string[];
  toast: { text: string; points: number; id: number; time?: number | undefined } | null;
  /** current level (1..7, then endless) */
  wave: number;
  waveBanner: { text: string; id: number } | null;
  power: { kind: PowerKind; timeLeft: number } | null;
  muted: boolean;
  musicVolume: number;
  sfxVolume: number;
  bossHp: number;
  /** toy the player must NOT shoot this round */
  forbidden: ToyKind | null;
  /** cinematic slow-motion outro is running — input is locked */
  ending: boolean;
  /** lighting environment for the round */
  timeOfDay: TimeOfDay;
  /** length of the current level in seconds */
  roundTime: number;
  /** bullets left in the magazine */
  ammo: number;
  /** magazine empty: blaster locked while the reload animation plays */
  reloading: boolean;
  /** seconds left of the reload animation */
  reloadLeft: number;
  /** TARGET BOARD: the one object the player is allowed to shoot right now */
  board: TargetBoard | null;
  /** consecutive correct board hits */
  orderStreak: number;
  /** correct hits banked in the current level */
  levelHits: number;
  /** correct hits needed to clear the current level */
  levelGoal: number;
  /** fever mode (level 5+ with a hot combo): score x2 */
  fever: boolean;
  /** ricochet kills, for the results panel */
  bankShots: number;
}

/** the board above the booth: "SHOOT: ROBOT" */
export interface TargetBoard {
  kind: ToyKind;
  timeLeft: number;
  /** full cycle length, for the HUD bar */
  every: number;
}

export type PowerKind = "slowmo" | "double" | "spread";
export type TimeOfDay = "day" | "night";

export const POWER_LABEL: Record<PowerKind, string> = {
  slowmo: "Slow-Mo",
  double: "Double Score",
  spread: "Spread Shot",
};

/* ------------------------------------------------------------------ *
 * LEVEL LADDER — one rule everywhere: the board names a single toy,
 * only that toy scores, everything else costs you clock time.
 *
 *   1 Warm-Up      45s   board every 8s    mostly calm shelves
 *   2 Moving       45s   every 7s          slow drift
 *   3 Trick        40s   every 6s          golden bonus + bombs
 *   4 Chaos        40s   every 5s          decoys and bombs together
 *   5 Fever        35s   every 4.5s        fast targets, fever meter
 *   6 Blackout     30s   every 3.5s        the booth lights flicker
 *   7 Grand        45s   every 4s          everything at once
 *   8+ Endless     45s   tightening board, rising speed
 * ------------------------------------------------------------------ */
export interface LevelDef {
  time: number;
  boardEvery: number;
  stock: number;
  speed: number;
  /** seconds lost for shooting the wrong object */
  wrongSec: number;
  /** seconds lost for a bomb / forbidden prize */
  bombSec: number;
  /** correct board hits needed to clear */
  goal: number;
  name: string;
}

const LEVELS: LevelDef[] = [
  { time: 45, boardEvery: 8, stock: 4, speed: 0.85, wrongSec: 3, bombSec: 5, goal: 8, name: "Warm-Up" },
  { time: 45, boardEvery: 7, stock: 4, speed: 1, wrongSec: 3, bombSec: 5, goal: 10, name: "Moving Targets" },
  { time: 40, boardEvery: 6, stock: 5, speed: 1.15, wrongSec: 3, bombSec: 5, goal: 12, name: "Trick Targets" },
  { time: 40, boardEvery: 5, stock: 6, speed: 1.3, wrongSec: 4, bombSec: 6, goal: 14, name: "Chaos" },
  { time: 35, boardEvery: 4.5, stock: 6, speed: 1.45, wrongSec: 4, bombSec: 6, goal: 15, name: "Fever Frenzy" },
  { time: 30, boardEvery: 3.5, stock: 6, speed: 1.6, wrongSec: 4, bombSec: 7, goal: 15, name: "Blackout Rush" },
  { time: 45, boardEvery: 4, stock: 7, speed: 1.75, wrongSec: 5, bombSec: 7, goal: 20, name: "Grand Carnival" },
];

export function levelDef(level: number): LevelDef {
  const base = LEVELS[Math.min(level, LEVELS.length) - 1]!;
  if (level <= LEVELS.length) return base;
  const over = level - LEVELS.length;
  return {
    ...base,
    name: `Endless ${over}`,
    boardEvery: Math.max(2.5, base.boardEvery - over * 0.2),
    speed: base.speed + over * 0.1,
    goal: base.goal + over * 2,
    stock: Math.min(8, base.stock + Math.floor(over / 2)),
  };
}

/** target speed / spawn pressure for the level */
export const waveIntensity = (level: number) => levelDef(level).speed;
/** how many toys each shelf keeps stocked */
const shelfStock = (level: number) => levelDef(level).stock;
const POWER_TIME = 6;
/** magazine size and how long an empty-mag reload takes */
export const MAX_AMMO = 20;
export const RELOAD_TIME = 2;
const AMMO_PICKUP = 10;

/** fever mode kicks in from level 5 once the combo is hot */
const FEVER_LEVEL = 5;
const FEVER_COMBO = 6;

/** toys the board can ask for (no hazards, no pickups, no jackpot-only props) */
const BOARD_POOL = PICKABLE.filter(
  (k) => TOY_SPECS[k].points > 0 && TOY_SPECS[k].points <= 260,
);
/** utility pickups: never board targets, and never punished */
const PICKUPS: ToyKind[] = ["clock", "star", "spread", "ammo"];

/* ------------------------------------------------------------------ *
 * BANK SHOT — a shot that sails past every toy bounces off the booth's
 * timber and comes back through the shelves. Board rules still apply to
 * whatever the ricochet hits, so it is a second chance, not a free pass.
 * ------------------------------------------------------------------ */
const BANK_WALL_Z = -5.25;
/** inner face of the booth's timber side panels (booth.ts puts them at x = ±4.6) */
const BANK_SIDE_X = 4.42;
const BANK_MULT = 1.5;



interface Target {
  group: THREE.Group;
  kind: ToyKind;
  lane: number;
  dir: number;
  speed: number;
  bob: number;
  alive: boolean;
  hitAt: number;
  hp: number;
}

export class CarnivalGame {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  /** stable camera pose (no shake/kick) — the aim reference */
  private baseCam = { x: 0, y: 1.45, z: 2.4, rx: 0, ry: 0 };
  /** invisible camera holding the base pose; all hit tests use this */
  private aimCamera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);

  private pointer = new THREE.Vector2();
  /** cached canvas bounds, invalidated on resize/scroll */
  private canvasRect: DOMRect | null = null;

  private aimYaw = 0;
  private aimPitch = 0;

  private targets: Target[] = [];
  private particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  private tracers: { line: THREE.Mesh; life: number }[] = [];
  private bullets: {
    mesh: THREE.Mesh;
    from: THREE.Vector3;
    dir: THREE.Vector3;
    dist: number;
    travelled: number;
    speed: number;
  }[] = [];
  private blaster = buildBlaster();
  private gunId = "carnival";
  private recoil = 0;
  /** which beat of the reload choreography has already played its sfx */
  private reloadStage = 0;
  /** sharp per-shot punch used for camera kick (decays faster than recoil) */
  private firePunch = 0;
  private fireRoll = 0;
  private frame = 0;
  private raf = 0;
  private audio: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private disposed = false;
  private toastId = 0;
  private laserOn = false;
  private laser: THREE.Mesh | null = null;
  private laserDot: THREE.Mesh | null = null;
  private shake = 0;
  private timeScale = 1;
  private hemi!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private fillLight!: THREE.PointLight;
  private bloom!: UnrealBloomPass;
  /** booth neon / bulb lights with their authored night intensity */
  private boothLights: { light: THREE.PointLight; base: number }[] = [];
  private carnival!: CarnivalEnv;
  /** 0 = at the counter, 1 = wide establishing shot of the whole fair */
  private showcase = 0;
  private hemiBase = 0.35;
  private keyBase = 1.7;
  private showcaseDummy = new THREE.Camera(); // Camera.lookAt aims -Z, like the real camera
  private ending = false;
  private endingT = 0;

  /** seconds of clock the current shot costs (wrong object / bomb) */
  private timeFine = 0;
  private wrongLabel = false;
  private musicTimer = 0;
  private musicStep = 0;
  private skinColor = 0xff3b5c;
  readonly isTouch =
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  /** phones / tablets: shed GPU work up-front instead of waiting for autoTune */
  private readonly isMobile =
    typeof window !== "undefined" &&
    (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 900);
  /** weak GPU/CPU signals (few cores, little RAM) -> lowest quality tier + 30fps cap */
  private readonly isLowEnd =
    typeof navigator !== "undefined" &&
    ((navigator.hardwareConcurrency ?? 8) <= 4 ||
      ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8) <= 4);
  /** frame budget in seconds; a steady cap feels smoother than a jittery high fps */
  private frameBudget = 0;
  private frameAcc = 0;
  /** frame cap used while a round is live (0 = uncapped) */
  private playBudget = 0;
  /** frame cap used while a menu / shop / pause screen covers the scene */
  private uiBudget = 0;
  /** a React overlay (shop, help, sound, briefing…) is on screen */
  private uiOverlay = false;

  /** render through the post-processing composer (desktop) or direct (mobile) */
  private postFx = true;

  state: GameState = {
    score: 0,
    best: 0,
    tickets: 0,
    combo: 1,
    timeLeft: LEVELS[0]!.time,
    roundTime: LEVELS[0]!.time,
    phase: "idle",
    hits: 0,
    shots: 0,
    prizes: [],
    toast: null,
    wave: 1,
    waveBanner: null,
    power: null,
    muted: false,
    musicVolume: 0.7,
    sfxVolume: 0.9,
    bossHp: 0,
    forbidden: null,
    ending: false,
    timeOfDay: "night",
    ammo: MAX_AMMO,
    reloading: false,
    reloadLeft: 0,
    board: null,
    orderStreak: 0,
    levelHits: 0,
    levelGoal: LEVELS[0]!.goal,
    fever: false,
    bankShots: 0,
  };

  constructor(
    private canvas: HTMLCanvasElement,
    private onState: (s: GameState) => void,
  ) {
    this.init();
  }

  private emit() {
    this.onState({ ...this.state, prizes: [...this.state.prizes] });
  }

  private init() {
    const mobile = this.isMobile;
    const low = mobile && this.isLowEnd;
    // Phones: never render above ~1.5 device pixels per CSS pixel. 2.5x DPR costs
    // ~4x the fill-rate of 1.25x for no visible gain, and MSAA keeps edges crisp.
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const targetDpr = Math.min(dpr, low ? 1.25 : mobile ? 1.5 : 2);
    const r = new THREE.WebGLRenderer({
      canvas: this.canvas,
      // MSAA where we render at/below ~1.5 device pixels: keeps geometry sharp
      // instead of relying on raw resolution.
      antialias: targetDpr <= 1.5,
      powerPreference: "high-performance",
    });
    // sharp (never upscaled) rendering; smoothness comes from cheaper lighting/effects
    r.setPixelRatio(targetDpr);
    // real-time shadows are the single biggest mobile cost -> off on weak phones
    r.shadowMap.enabled = !low;
    r.shadowMap.type = mobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.98;
    this.renderer = r;
    // Resolution is never sacrificed (objects must stay sharp) — frame rate is the
    // lever instead. Gameplay stays as fluid as the device allows (low-end phones
    // are capped to a steady 40fps), while menus/shop screens render at ~20-30fps
    // because nothing there needs a high refresh.
    this.playBudget = low ? 1 / 40 : 0;
    this.uiBudget = low ? 1 / 20 : mobile ? 1 / 30 : 1 / 45;
    this.frameBudget = this.playBudget;



    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    this.camera.position.set(0, 1.45, 2.4);
    this.camera.lookAt(0, 1.2, -4);

    buildBooth(this.scene);
    this.scene.traverse((o) => {
      if ((o as THREE.PointLight).isPointLight) {
        const l = o as THREE.PointLight;
        this.boothLights.push({ light: l, base: l.intensity });
      }
    });

    // fairground world around the booth (sky, stars, sun/moon, other stalls, rides)
    this.carnival = buildCarnival(this.scene, mobile);
    if (mobile) {
      // dynamic point lights are per-pixel work on every lit fragment: keep only
      // the two strongest booth lights on phones, the rest are emissive anyway
      const sorted = [...this.boothLights].sort((a, b) => b.base - a.base);
      for (const bl of sorted.slice(2)) bl.light.intensity = 0;
      this.boothLights = sorted.slice(0, 2);
    }

    this.hemi = new THREE.HemisphereLight(0xffd9a0, 0x2a1533, 0.35);
    this.scene.add(this.hemi);
    const key = new THREE.DirectionalLight(0xfff0d0, 1.7);
    key.position.set(3, 7, 5);
    key.castShadow = !low;
    // smaller shadow map on phones: 512 costs ~4x less than 1024
    key.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 25;
    (key.shadow.camera as THREE.OrthographicCamera).left = -8;
    (key.shadow.camera as THREE.OrthographicCamera).right = 8;
    (key.shadow.camera as THREE.OrthographicCamera).top = 8;
    (key.shadow.camera as THREE.OrthographicCamera).bottom = -8;
    this.scene.add(key);
    this.keyLight = key;
    const fill = new THREE.PointLight(0xff7ac4, 3, 14, 2);
    fill.position.set(-3, 2.4, 1);
    this.scene.add(fill);
    this.fillLight = fill;
    if (low) {
      // strip every remaining shadow caster/receiver on the weakest devices
      this.scene.traverse((o) => {
        const m = o as THREE.Mesh & THREE.Light;
        if (m.castShadow) m.castShadow = false;
        if (m.receiveShadow) m.receiveShadow = false;
      });
    }

    this.camera.add(this.blaster.group);
    this.blaster.group.scale.setScalar(0.28);
    this.blaster.group.position.set(0, -0.19, -0.52);
    this.blaster.group.rotation.set(0.03, 0.12, 0.0);

    this.scene.add(this.camera);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.4, 0.85);
    // bloom = several extra full-screen passes; skip it on phones entirely
    bloom.enabled = !mobile;
    this.composer.addPass(bloom);
    this.bloom = bloom;
    this.composer.addPass(new OutputPass());
    // when bloom is off we render straight to the screen (no post-processing chain)
    this.postFx = !mobile;

    this.applyTimeOfDay();

    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("orientationchange", this.resize);
    this.canvas.style.touchAction = "none";
    if (!this.isTouch) {
      // passive move listener: never blocks the compositor, so aim stays in sync
      this.canvas.addEventListener("pointermove", this.onPointerMove, { passive: true });
      this.canvas.addEventListener("pointerdown", this.onPointerDown);
    }
    window.addEventListener("scroll", this.invalidateRect, { passive: true });


    this.state.best = safeInt(secureGetOrMigrate<number>(BEST_KEY, 0, legacyNumber), MAX_SCORE);
    this.state.muted = localStorage.getItem("carnival-muted") === "1";
    this.state.musicVolume = readVolume("carnival-music-vol", 0.7);
    this.state.sfxVolume = readVolume("carnival-sfx-vol", 0.9);
    this.spawnInitial();
    this.emit();
    this.loop();
  }

  private invalidateRect = () => {
    this.canvasRect = null;
  };

  private resize = () => {
    this.canvasRect = null;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    // widen the field of view on narrow / portrait screens so the whole booth fits
    const aspect = w / h;
    this.camera.fov = aspect < 1 ? 78 : aspect < 1.35 ? 66 : 55;
    this.camera.position.z = aspect < 1 ? 3.1 : aspect < 1.35 ? 2.7 : 2.4;
    // remember the counter distance so the showcase camera can snap back to it
    this.baseCam.z = this.camera.position.z;
    this.camera.updateProjectionMatrix();
  };

  private setPointerFrom(e: PointerEvent) {
    // cached rect: measuring per pointer event forces a layout and adds input lag
    const rect = this.canvasRect ?? (this.canvasRect = this.canvas.getBoundingClientRect());
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onPointerMove = (e: PointerEvent) => {
    // only the freshest sample matters; queued coalesced points are skipped
    const last = e.getCoalescedEvents?.().at(-1) ?? e;
    this.setPointerFrom(last);
  };

  private onPointerDown = (e: PointerEvent) => {
    // touch/pen taps carry the aim position with them
    this.setPointerFrom(e);
    if (this.state.phase !== "playing" || this.ending) return;
    e.preventDefault();
    this.shoot();
  };


  /** Aim from the on-screen joystick (normalised -1..1, y up). */
  setAim(nx: number, ny: number) {
    this.pointer.x = THREE.MathUtils.clamp(nx, -1, 1);
    this.pointer.y = THREE.MathUtils.clamp(ny, -1, 1);
  }

  setLaser(on: boolean) {
    this.laserOn = on;
    if (!on) this.hideLaser();
  }

  fire() {
    if (this.state.phase !== "playing" || this.ending) return;
    this.shoot();
  }

  private hideLaser() {
    if (this.laser) {
      this.scene.remove(this.laser);
      disposeObject(this.laser);
      this.laser = null;
    }
    if (this.laserDot) {
      this.scene.remove(this.laserDot);
      disposeObject(this.laserDot);
      this.laserDot = null;
    }
  }

  /**
   * Casts the aim ray from the shake-free base camera pose so a shot always
   * lands exactly under the crosshair, even mid-recoil.
   */
  private aimFromCrosshair() {
    const a = this.aimCamera;
    a.position.set(this.baseCam.x, this.baseCam.y, this.baseCam.z);
    a.rotation.set(this.baseCam.rx, this.baseCam.ry, 0);
    a.fov = this.camera.fov;
    a.aspect = this.camera.aspect;
    a.updateProjectionMatrix();
    a.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointer, a);
  }

  private updateLaser() {
    if (!this.laserOn || this.state.phase !== "playing" || this.ending) {
      this.hideLaser();
      return;
    }
    this.aimFromCrosshair();

    const meshes: THREE.Object3D[] = this.targets.filter((t) => t.alive).map((t) => t.group);
    const hits = this.raycaster.intersectObjects(meshes, true);
    const end = hits[0] ? hits[0].point.clone() : this.raycaster.ray.at(14, new THREE.Vector3());
    const start = new THREE.Vector3();
    this.blaster.muzzle.getWorldPosition(start);
    const dir = end.clone().sub(start);
    const len = Math.max(0.001, dir.length());

    if (!this.laser) {
      this.laser = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, 1, 6),
        new THREE.MeshBasicMaterial({ color: 0x49ff7a, transparent: true, opacity: 0.55 }),
      );
      this.scene.add(this.laser);
    }
    this.laser.scale.set(1, len, 1);
    this.laser.position.copy(start).add(dir.clone().multiplyScalar(0.5));
    this.laser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

    if (!this.laserDot) {
      this.laserDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0x9dffbc }),
      );
      this.scene.add(this.laserDot);
    }
    this.laserDot.position.copy(end);
    const s = hits[0] ? 1.25 : 0.8;
    this.laserDot.scale.setScalar(s);
  }


  // ---------------- targets ----------------
  private randomKind(): ToyKind {
    const roll = Math.random();
    if (this.state.phase === "playing") {
      if (this.state.wave >= 2 && roll < 0.035 && !this.targets.some((t) => t.alive && t.kind === "boss")) return "boss";
      if (roll < 0.09) {
        const powers: ToyKind[] = ["clock", "star", "spread", "ammo", "ammo"];
        return powers[Math.floor(Math.random() * powers.length)]!;
      }
    }
    if (roll < 0.035) return "goldgift";
    if (roll < 0.055) return "goldbear";
    if (roll < 0.075) return "unicorn";
    if (roll < 0.145) return "bomb";
    if (roll < 0.19) return "warning";

    return PICKABLE[Math.floor(Math.random() * PICKABLE.length)]!;
  }

  /** min gap between two toys on the same shelf so they never visually overlap */
  private static readonly TOY_GAP = 0.95;

  /** picks a lane position that is clear of every toy already on that shelf */
  private freeSpot(lane: number, shelf: { halfWidth: number }, dir: number, atEdge: boolean) {
    const gap = CarnivalGame.TOY_GAP;
    const occupied = this.targets
      .filter((t) => t.lane === lane && t.alive)
      .map((t) => t.group.position.x);
    const clear = (x: number) => occupied.every((o) => Math.abs(o - x) >= gap);

    if (atEdge) {
      // walk inwards from the shelf edge until there is room, so a refilled toy
      // queues up behind the ones already sliding along instead of spawning inside one
      const edge = -dir * shelf.halfWidth;
      for (let i = 0; i < 8; i++) {
        const x = edge + dir * i * gap;
        if (Math.abs(x) > shelf.halfWidth) break;
        if (clear(x)) return x;
      }
      return edge - dir * gap; // just off-shelf: it walks into view on the next frames
    }

    for (let i = 0; i < 24; i++) {
      const x = THREE.MathUtils.randFloatSpread(shelf.halfWidth * 1.7);
      if (clear(x)) return x;
    }
    return THREE.MathUtils.randFloatSpread(shelf.halfWidth * 1.7);
  }

  private spawnTarget(lane: number, atEdge = false) {
    const shelf = SHELVES[lane]!;
    const kind = this.randomKind();
    const group = buildToy(kind);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const x = this.freeSpot(lane, shelf, dir, atEdge);
    group.position.set(x, shelf.y, shelf.z);
    group.scale.setScalar(0.001);
    this.scene.add(group);

    const t: Target = {
      group,
      kind,
      lane,
      dir,
      speed:
        (0.5 + Math.random() * 0.9 + lane * 0.12) *
        (1 + (this.state.wave - 1) * 0.22) *
        waveIntensity(this.state.wave),
      bob: Math.random() * Math.PI * 2,
      alive: true,
      hitAt: 0,
      hp: kind === "boss" ? 3 : 1,
    };
    this.targets.push(t);
    if (kind === "boss") this.state.bossHp = 3;
  }

  private spawnInitial() {
    for (let lane = 0; lane < SHELVES.length; lane++) {
      for (let i = 0; i < 4; i++) this.spawnTarget(lane);
    }
  }

  // ---------------- audio ----------------
  private ac() {
    if (!this.audio) {
      this.audio = new AudioContext();
      this.musicBus = this.audio.createGain();
      this.sfxBus = this.audio.createGain();
      this.musicBus.connect(this.audio.destination);
      this.sfxBus.connect(this.audio.destination);
      this.applyVolumes();
    }
    if (this.audio.state === "suspended") void this.audio.resume();
    return this.audio;
  }

  /** push the current mute / volume state onto the two gain buses */
  private applyVolumes() {
    const m = this.state.muted ? 0 : this.state.musicVolume;
    const s = this.state.muted ? 0 : this.state.sfxVolume;
    if (this.musicBus) this.musicBus.gain.value = m;
    if (this.sfxBus) this.sfxBus.gain.value = s;
  }

  private bus(kind: "music" | "sfx") {
    this.ac();
    return (kind === "music" ? this.musicBus : this.sfxBus) ?? this.ac().destination;
  }

  private blip(
    freq: number,
    dur: number,
    type: OscillatorType = "square",
    gain = 0.09,
    slideTo?: number,
    kind: "music" | "sfx" = "sfx",
  ) {
    try {
      if (this.state.muted) return;
      if (kind === "music" ? this.state.musicVolume <= 0 : this.state.sfxVolume <= 0) return;
      const ac = this.ac();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, ac.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
      g.gain.setValueAtTime(gain, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      o.connect(g).connect(this.bus(kind));
      o.start();
      o.stop(ac.currentTime + dur);
    } catch {
      /* audio unavailable */
    }
  }

  /** realistic firearm crack: noise burst + body thump + mechanical click */
  private gunshot() {
    try {
      if (this.state.muted || this.state.sfxVolume <= 0) return;
      const ac = this.ac();
      const out = this.bus("sfx");
      const t0 = ac.currentTime;

      // noise burst (the crack)
      const len = Math.floor(ac.sampleRate * 0.28);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const k = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, 3);
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      const bp = ac.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(1800, t0);
      bp.frequency.exponentialRampToValueAtTime(400, t0 + 0.25);
      bp.Q.value = 0.8;
      const ng = ac.createGain();
      ng.gain.setValueAtTime(0.28, t0);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
      src.connect(bp).connect(ng).connect(out);
      src.start(t0);
      src.stop(t0 + 0.28);

      // low body thump
      const o = ac.createOscillator();
      const og = ac.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(150, t0);
      o.frequency.exponentialRampToValueAtTime(45, t0 + 0.14);
      og.gain.setValueAtTime(0.22, t0);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(og).connect(out);
      o.start(t0);
      o.stop(t0 + 0.2);

      // slide/mech click
      const c = ac.createOscillator();
      const cg = ac.createGain();
      c.type = "square";
      c.frequency.setValueAtTime(2400, t0 + 0.05);
      cg.gain.setValueAtTime(0.035, t0 + 0.05);
      cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
      c.connect(cg).connect(out);
      c.start(t0 + 0.05);
      c.stop(t0 + 0.12);
    } catch {
      /* audio unavailable */
    }
  }

  // ---------------- shooting ----------------
  private shoot() {
    if (this.state.reloading) return;
    if (this.state.ammo <= 0) {
      this.beginReload();
      return;
    }
    this.state.ammo--;
    this.state.shots++;
    this.recoil = 1;
    this.firePunch = 1;
    this.fireRoll = (Math.random() - 0.5) * 2;
    this.shake = Math.max(this.shake, 0.35);
    this.gunshot();
    this.buzz(12);

    (this.blaster.flash.material as THREE.MeshBasicMaterial).opacity = 1;
    this.blaster.flashLight.intensity = 8;

    if (this.state.ammo <= 0) this.beginReload();

    this.aimFromCrosshair();
    const meshes: THREE.Object3D[] = this.targets.filter((t) => t.alive).map((t) => t.group);
    const hits = this.raycaster.intersectObjects(meshes, true);

    const end = hits[0]
      ? hits[0].point.clone()
      : this.raycaster.ray.at(14, new THREE.Vector3());
    this.addBullet(end);

    if (!hits[0]) {
      if (this.tryBankShot()) return;
      this.state.combo = 1;
      this.shake = Math.max(this.shake, 0.5);
      this.emit();
      return;
    }
    let obj: THREE.Object3D | null = hits[0].object;
    let target: Target | undefined;
    while (obj && !target) {
      target = this.targets.find((t) => t.group === obj);
      obj = obj.parent;
    }
    if (!target || !target.alive) {
      // ray landed on scenery attached to a dead toy — still a miss, so the UI
      // must see the incremented shot count and the broken combo.
      this.state.combo = 1;
      this.emit();
      return;
    }
    this.registerHit(target, hits[0].point);

    // spread shot also clips nearby targets
    if (this.state.power?.kind === "spread") {
      const origin = hits[0].point;
      const extra = this.targets
        .filter((t) => t.alive && t !== target && t.group.position.distanceTo(origin) < 1.6 && t.kind !== "bomb")
        .slice(0, 2);
      for (const e of extra) this.registerHit(e, e.group.position.clone());
    }
  }

  /**
   * BANK SHOT. The aim ray missed every plush, so bounce the slug off one of the
   * booth's timber side panels and sweep the shelves along the reflected path.
   * Side panels are the interesting bank: the bounce cuts sideways across a whole
   * row, so a shot fired into the gap beside a shelf can still reach a plush that
   * is tucked behind another one. Hazards and the round's forbidden prize are
   * never eligible — a ricochet must not punish the player for aiming wide.
   */
  private tryBankShot(): boolean {
    const ray = this.raycaster.ray;
    const candidates = this.targets.filter(
      (t) =>
        t.alive &&
        TOY_SPECS[t.kind].points > 0 &&
        t.kind !== "bomb" &&
        t.kind !== "warning" &&
        t.kind !== this.state.forbidden,
    );
    if (!candidates.length) return false;
    const meshes = candidates.map((t) => t.group);

    // candidate mirrors: the two side panels first, the back wall last
    const walls: { normal: THREE.Vector3; dist: number; impact: THREE.Vector3 }[] = [];
    for (const s of [-1, 1]) {
      if (Math.sign(ray.direction.x) !== s || Math.abs(ray.direction.x) < 0.02) continue;
      const d = (s * BANK_SIDE_X - ray.origin.x) / ray.direction.x;
      if (d <= 0.4) continue;
      const p = ray.at(d, new THREE.Vector3());
      if (p.z > -1.4 || p.z < BANK_WALL_Z || p.y < -0.45 || p.y > 4.8) continue;
      walls.push({ normal: new THREE.Vector3(-s, 0, 0), dist: d, impact: p });
    }
    if (ray.direction.z < -0.05) {
      const d = (BANK_WALL_Z - ray.origin.z) / ray.direction.z;
      const p = ray.at(d, new THREE.Vector3());
      if (d > 0.4 && Math.abs(p.x) <= BANK_SIDE_X && p.y >= -0.45 && p.y <= 4.8) {
        walls.push({ normal: new THREE.Vector3(0, 0, 1), dist: d, impact: p });
      }
    }
    walls.sort((a, b) => a.dist - b.dist);

    for (const w of walls) {
      const dir = ray.direction.clone().reflect(w.normal).normalize();
      const bounce = new THREE.Raycaster(w.impact.clone().addScaledVector(dir, 0.03), dir, 0.03, 14);
      const hit = bounce.intersectObjects(meshes, true)[0];
      if (!hit) continue;

      let obj: THREE.Object3D | null = hit.object;
      let target: Target | undefined;
      while (obj && !target) {
        target = candidates.find((t) => t.group === obj);
        obj = obj.parent;
      }
      if (!target) continue;

      // visible evidence of the bounce: sparks on the panel + a second slug
      this.burst(w.impact, [0xffd39b, 0xfff3cf, 0xc98b3a], 12);
      this.spawnRicochetTracer(w.impact, hit.point);
      this.ricochetPing();
      this.state.bankShots++;
      this.registerHit(target, hit.point, BANK_MULT, "BANK SHOT");
      return true;
    }
    return false;
  }


  private spawnRicochetTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const delta = to.clone().sub(from);
    const len = Math.max(0.01, delta.length());
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.02, len, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.9 }),
    );
    mesh.position.copy(from).addScaledVector(delta, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
    this.scene.add(mesh);
    this.tracers.push({ line: mesh, life: 0.12 });
  }

  /** metallic wall-strike ping: two detuned partials over a short noise tick */
  private ricochetPing() {
    this.blip(2100, 0.09, "square", 0.045, 900);
    this.blip(1480, 0.16, "triangle", 0.05, 620);
  }

  /** chime that climbs with the correct-hit streak */
  private boardChime(streak: number) {
    const scale = [523, 587, 659, 784, 880, 988, 1175, 1397];
    const n = scale[Math.min(scale.length - 1, streak)]!;
    this.blip(n, 0.15, "triangle", 0.075, n * 1.5);
  }

  /** the sting for shooting anything the board didn't ask for */
  private wrongBuzz() {
    this.blip(220, 0.26, "sawtooth", 0.08, 100);
    this.buzz([30, 40]);
  }

  /**
   * Posts the next instruction on the board. The toy is drawn from what is
   * actually stocked on the shelves right now, so the player can always find
   * it, and never repeats the toy already on the board.
   */
  private newBoard() {
    const lvl = levelDef(this.state.wave);
    const prev = this.state.board?.kind;
    const stocked = [...new Set(this.targets.filter((t) => t.alive).map((t) => t.kind))].filter(
      (k) => BOARD_POOL.includes(k) && k !== this.state.forbidden,
    );
    const pool = (stocked.length >= 2 ? stocked : BOARD_POOL.filter((k) => k !== this.state.forbidden))
      .filter((k) => k !== prev);
    const fallback = BOARD_POOL.filter((k) => k !== this.state.forbidden);
    const from = pool.length ? pool : fallback;
    const kind = from[Math.floor(Math.random() * from.length)]!;
    this.state.board = { kind, timeLeft: lvl.boardEvery, every: lvl.boardEvery };
  }

  /** counts the board down; when it expires a new instruction is posted (no penalty) */
  private boardTick(dt: number) {
    const b = this.state.board;
    if (!b) {
      this.newBoard();
      return;
    }
    b.timeLeft -= dt;
    if (b.timeLeft > 0) return;
    this.newBoard();
    this.blip(760, 0.12, "square", 0.05, 1100);
    this.emit();
  }

  /** is this toy the one the board asked for? */
  private boardVerdict(kind: ToyKind): "correct" | "wrong" | "neutral" {
    if (PICKUPS.includes(kind)) return "neutral";
    if (!this.state.board) return "correct";
    return this.state.board.kind === kind ? "correct" : "wrong";
  }

  /** correct board hit: bank progress, refresh the board, maybe clear the level */
  private boardScored() {
    this.state.orderStreak++;
    this.boardChime(this.state.orderStreak);
    this.state.levelHits++;
    this.state.fever =
      this.state.wave >= FEVER_LEVEL && this.state.combo + 1 >= FEVER_COMBO;
    if (this.state.orderStreak >= 6) this.unlockPrize("Sharp Eye");
    if (this.state.orderStreak >= 12) this.unlockPrize("Booth Legend");
    if (this.state.levelHits >= this.state.levelGoal) this.nextLevel();
    else this.newBoard();
  }

  /** apply a clock fine and flag the toast */
  private fineTime(sec: number) {
    this.timeFine = sec;
    this.state.timeLeft = Math.max(0, this.state.timeLeft - sec);
    this.state.orderStreak = 0;
    this.state.fever = false;
  }

  /** configure the booth for a level and (re)start its clock */
  private startLevel(level: number) {
    const lvl = levelDef(level);
    this.state.wave = level;
    this.state.roundTime = lvl.time;
    this.state.timeLeft = lvl.time;
    this.state.levelHits = 0;
    this.state.levelGoal = lvl.goal;
    this.state.fever = false;
    this.newBoard();
  }

  /** level cleared: pay a bonus, then re-open the booth one notch harder */
  private nextLevel() {
    const cleared = this.state.wave;
    const bonus = 500 * cleared;
    this.state.score += bonus;
    this.state.tickets += 10 + cleared * 2;
    this.state.ammo = Math.min(MAX_AMMO * 2, this.state.ammo + 8);
    if (this.state.reloading) {
      this.state.reloading = false;
      this.state.reloadLeft = 0;
    }
    const next = levelDef(cleared + 1);
    this.state.waveBanner = {
      text: `LEVEL ${cleared} CLEAR · +${bonus} — Level ${cleared + 1}: ${next.name} (${next.time}s)`,
      id: ++this.toastId,
    };
    this.blip(1046, 0.3, "sine", 0.09, 1568);
    this.blip(1568, 0.45, "triangle", 0.05, 2093);
    this.burst(new THREE.Vector3(0, 1.6, -3.2), [0xffd700, 0xfff3b0, 0x2ad4ff, 0xff4d6d], 44);
    this.shake = Math.max(this.shake, 0.7);
    this.buzz([18, 30, 18, 30, 26]);
    if (cleared >= 3) this.unlockPrize("Trick Shot Trophy");
    if (cleared >= 7) this.unlockPrize("Grand Carnival Champion");
    this.startLevel(cleared + 1);
    // faster shelves for the new level
    const speed = levelDef(cleared + 1).speed / levelDef(cleared).speed;
    for (const t of this.targets) t.speed *= speed;
  }




  /** simple carnival bass-line loop */
  private music(dt: number) {
    if (this.state.muted || this.state.musicVolume <= 0) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.32;
    const notes = [196, 262, 330, 262, 220, 294, 349, 294];
    const n = notes[this.musicStep % notes.length]!;
    this.musicStep++;
    this.blip(n, 0.26, "triangle", 0.028, undefined, "music");
    if (this.musicStep % 4 === 0) this.blip(n / 2, 0.3, "sine", 0.035, undefined, "music");
  }

  toggleMute() {
    this.state.muted = !this.state.muted;
    localStorage.setItem("carnival-muted", this.state.muted ? "1" : "0");
    this.applyVolumes();
    this.emit();
  }

  setMusicVolume(v: number) {
    this.state.musicVolume = clamp01(v);
    localStorage.setItem("carnival-music-vol", String(this.state.musicVolume));
    this.applyVolumes();
    this.emit();
  }

  setSfxVolume(v: number) {
    this.state.sfxVolume = clamp01(v);
    localStorage.setItem("carnival-sfx-vol", String(this.state.sfxVolume));
    this.applyVolumes();
    this.emit();
  }

  /** shop-purchased blaster tracer colour */
  setSkin(color: number) {
    this.skinColor = color;
  }

  /** swap the equipped gun model */
  setGun(id: string) {
    if (id === this.gunId) return;
    this.gunId = id;
    const old = this.blaster.group;
    this.camera.remove(old);
    old.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[];
        Array.isArray(mat) ? mat.forEach((x) => x.dispose()) : mat?.dispose();
      }
    });
    this.blaster = buildBlaster(getGunSkin(id));
    this.camera.add(this.blaster.group);
    this.blaster.group.scale.copy(old.scale);
    this.blaster.group.position.copy(old.position);
    this.blaster.group.rotation.copy(old.rotation);
  }

  private buzz(ms: number | number[]) {
    if (this.state.muted) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* no haptics */
    }
  }

  /** empty magazine: lock the blaster for RELOAD_TIME, then top it back up */
  private beginReload() {
    if (this.state.reloading) return;
    this.state.reloading = true;
    this.state.reloadLeft = RELOAD_TIME;
    this.blip(240, 0.18, "square", 0.07, 120);
    this.buzz([20, 60, 20]);
    this.emit();
  }

  private activatePower(kind: PowerKind) {
    this.state.power = { kind, timeLeft: POWER_TIME };
    this.blip(1400, 0.35, "triangle", 0.1, 2200);
    this.buzz([18, 40, 18]);
  }

  /** points awarded by the most recent successful hit (drives the floating toast) */
  private lastGain = 0;

  private registerHit(t: Target, point: THREE.Vector3, extraMult = 1, viaLabel?: string) {
    if (t.hp > 1) {
      t.hp--;
      this.state.bossHp = t.hp;
      this.state.hits++;
      this.burst(point, [0xffd700, 0xfff3b0], 24);
      this.blip(300 + (3 - t.hp) * 120, 0.2, "square", 0.09, 900);
      this.shake = Math.max(this.shake, 0.6);
      this.state.toast = { text: `BOSS · ${t.hp} left`, points: 0, id: ++this.toastId };
      this.emit();
      return;
    }
    t.alive = false;
    t.hitAt = this.simTime;

    const spec = TOY_SPECS[t.kind];
    const bad = spec.points < 0;
    const lvl = levelDef(this.state.wave);
    this.timeFine = 0;
    this.wrongLabel = false;

    if (t.kind === this.state.forbidden) {
      // forbidden prize: half the score AND the bomb-sized clock penalty
      const lost = Math.ceil(this.state.score / 2);
      this.state.score = Math.max(0, this.state.score - lost);
      this.state.combo = 1;
      this.fineTime(lvl.bombSec);
      this.burst(point, [0xff3b3b, 0xffd93d, 0xffffff], 34);
      this.blip(200, 0.4, "sawtooth", 0.12, 70);
      this.shake = 1.1;
      this.buzz([40, 30, 60]);
      this.state.toast = {
        text: `FORBIDDEN ${spec.label}!`,
        points: -lost,
        time: lvl.bombSec,
        id: ++this.toastId,
      };
      if (this.state.timeLeft <= 0) this.endGame();
      this.emit();
      return;
    }

    if (bad) {
      // bomb: score hit, combo reset and the biggest clock penalty
      this.state.combo = 1;
      this.state.score = Math.max(0, this.state.score + spec.points);
      this.fineTime(lvl.bombSec);
      this.burst(point, [0xff3b3b, 0x2b2b2b, 0xff8a1e], 26);
      this.blip(160, 0.35, "sawtooth", 0.12, 55);
      this.shake = 1;
      this.buzz(60);
    } else {
      const verdict = this.boardVerdict(t.kind);

      if (verdict === "wrong") {
        // not the object on the board: no score, combo gone, clock docked
        this.wrongLabel = true;
        this.state.combo = 1;
        this.fineTime(lvl.wrongSec);
        this.lastGain = 0;
        this.wrongBuzz();
        this.burst(point, [0x9aa0b5, 0xff8a1e], 18);
      } else {
        this.state.hits++;
        const powerMult = this.state.power?.kind === "double" ? 2 : 1;
        const feverMult = this.state.fever ? 2 : 1;
        const gained = Math.round(
          spec.points * this.state.combo * powerMult * feverMult * extraMult,
        );
        this.lastGain = gained;
        this.state.score += gained;
        // doc economy: normal +1 ticket, golden +3, boss/2-hit +2, fever doubles
        const baseTickets = t.kind === "goldgift" ? 3 : t.hp > 0 && spec.points >= 200 ? 2 : 1;
        this.state.tickets += (baseTickets + Math.floor(gained / 400)) * feverMult;
        this.state.combo = Math.min(10, this.state.combo + (t.kind === "goldgift" ? 2 : 1));

        if (verdict === "correct" && !PICKUPS.includes(t.kind)) this.boardScored();

        if (t.kind === "clock") this.activatePower("slowmo");
        if (t.kind === "star") this.activatePower("double");
        if (t.kind === "spread") this.activatePower("spread");
        if (t.kind === "ammo") {
          this.state.ammo += AMMO_PICKUP;
          if (this.state.reloading) {
            this.state.reloading = false;
            this.state.reloadLeft = 0;
          }
          this.blip(1000, 0.22, "square", 0.09, 1800);
        }
        if (t.kind === "boss") {
          this.state.bossHp = 0;
          this.state.tickets += 10;
          this.unlockPrize("Boss Slayer");
          this.shake = 1.2;
        }
        this.burst(
          point,
          t.kind === "goldgift" || t.kind === "boss" ? [0xffd700, 0xfff3b0, 0xffa500] : [0xff4d6d, 0x4dd2ff, 0xffd93d, 0x8ef07a, 0xb794ff],
          t.kind === "goldgift" || t.kind === "boss" ? 70 : 30,
        );
        this.blip(t.kind === "goldgift" ? 1200 : 620 + this.state.combo * 40, 0.14, "triangle", 0.09, 1600);
        if (t.kind === "goldgift") {
          this.blip(880, 0.5, "sine", 0.1, 1760);
          this.unlockPrize("Golden Jackpot");
        }
        if (this.state.combo >= 5) this.unlockPrize("Combo Master");
        if (this.state.tickets >= 200) this.unlockPrize("Giant Teddy Bear");
        else if (this.state.tickets >= 100) this.unlockPrize("Plush Dino");
        else if (this.state.tickets >= 40) this.unlockPrize("Rubber Duck");
      }
    }

    const wrong = this.wrongLabel;
    this.wrongLabel = false;
    const fine = this.timeFine;
    this.timeFine = 0;
    const label = wrong
      ? `WRONG TARGET · ${spec.label}`
      : viaLabel
        ? `${viaLabel} · ${spec.label}`
        : spec.label;
    this.state.toast = {
      text: bad || wrong ? label : `${label} x${this.state.combo}`,
      points: bad ? spec.points : wrong ? 0 : this.lastGain,
      time: fine || undefined,
      id: ++this.toastId,
    };
    if (this.state.timeLeft <= 0 && this.state.phase === "playing") this.endGame();
    this.emit();

  }



  private unlockPrize(name: string) {
    if (!this.state.prizes.includes(name)) this.state.prizes.push(name);
  }

  private addTracer(end: THREE.Vector3) {
    const start = new THREE.Vector3();
    this.blaster.muzzle.getWorldPosition(start);
    const dir = end.clone().sub(start);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(0.012, 0.03, len, 6);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: this.skinColor, transparent: true, opacity: 0.95 }),
    );
    mesh.position.copy(start).add(dir.clone().multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    this.scene.add(mesh);
    this.tracers.push({ line: mesh, life: 0.12 });
  }

  /** physical brass slug that flies from the muzzle to the impact point */
  private addBullet(end: THREE.Vector3) {
    const start = new THREE.Vector3();
    this.blaster.muzzle.getWorldPosition(start);
    const delta = end.clone().sub(start);
    const dist = delta.length();
    if (dist < 0.001) return;
    const dir = delta.normalize();

    const geo = new THREE.CapsuleGeometry(0.022, 0.055, 4, 8);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0xd9a441,
        metalness: 1,
        roughness: 0.25,
        emissive: 0x3a2708,
      }),
    );
    mesh.position.copy(start);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.scene.add(mesh);
    this.bullets.push({ mesh, from: start.clone(), dir, dist, travelled: 0, speed: 46 });

    // brief muzzle smoke puff
    this.tracers.push({
      line: (() => {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xcfc6b5, transparent: true, opacity: 0.5 }),
        );
        puff.position.copy(start).addScaledVector(dir, 0.08);
        this.scene.add(puff);
        return puff;
      })(),
      life: 0.12,
    });
  }

  private burst(at: THREE.Vector3, colors: number[], count: number) {
    const geo = new THREE.BoxGeometry(0.07, 0.07, 0.02);
    // fewer confetti bits on phones: each one is a separate draw call
    const n = this.isMobile ? Math.max(3, Math.round(count * (this.isLowEnd ? 0.4 : 0.6))) : count;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length]! }));
      m.position.copy(at);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(3.2),
          Math.random() * 3.4 + 0.6,
          THREE.MathUtils.randFloatSpread(2.2) + 0.8,
        ),
        life: 1.1 + Math.random() * 0.6,
      });
    }
  }

  // ---------------- loop ----------------
  /** world clock that only advances while the round is not paused */
  private simTime = 0;
  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    // menus, the prize shop and the pause screen only need a slideshow-ish refresh:
    // capping them frees the GPU/CPU (and battery) without touching object clarity
    const idleUi = this.uiOverlay || this.state.phase !== "playing";
    this.frameBudget = idleUi ? Math.max(this.uiBudget, this.playBudget) : this.playBudget;

    const raw = Math.min(this.clock.getDelta(), 0.05);
    // steady frame pacing: skip work until a full frame budget has elapsed so the
    // frame rate is capped and even, instead of swinging between 45 and 20 fps
    this.frameAcc += raw;
    if (this.frameAcc < this.frameBudget - 0.002) return;
    const rdt = Math.min(this.frameAcc, 0.05);
    this.frameAcc = 0;

    // cinematic slow-motion when the round ends
    if (this.ending) {
      this.endingT += rdt;
      // eased ramp: hold near full speed for a beat, then glide into slow-mo
      const k = Math.min(1, this.endingT / 1.5);
      const eased = k * k * (3 - 2 * k); // smoothstep
      this.timeScale = 1 - eased * 0.94; // 1 -> 0.06
      if (this.endingT >= 2.1) this.finishGame();
    }

    // while paused, nothing in the world advances: simulation time stops, so
    // targets, particles, bullets and the fairground all hold perfectly still
    const frozen = this.state.phase === "paused";
    const dt = frozen ? 0 : rdt * this.timeScale;
    this.simTime += dt;
    const t = this.simTime;
    this.frame++;
    this.carnival?.update(t, frozen ? 0 : rdt);


    if (this.state.phase === "playing") {
      if (!this.ending) {
        this.state.timeLeft = Math.max(0, this.state.timeLeft - dt);
        if (this.state.timeLeft <= 0) this.endGame();
      }

      // Blackout Rush (level 6 and every 6th endless level): the booth lights
      // dip in slow pulses, so targets only read clearly for a beat at a time
      if (this.state.wave % 6 === 0) {
        const dip = 0.32 + 0.68 * Math.pow(Math.max(0, Math.sin(t * 1.1)), 0.6);
        this.hemi.intensity = this.hemiBase * dip;
        this.keyLight.intensity = this.keyBase * dip;
      }

      // reload animation countdown
      if (this.state.reloading) {
        this.state.reloadLeft = Math.max(0, this.state.reloadLeft - dt);
        if (this.state.reloadLeft <= 0) {
          this.state.reloading = false;
          this.state.ammo = MAX_AMMO;
          this.blip(760, 0.16, "triangle", 0.08, 1200);
          this.emit();
        }
      }

      // power-up countdown
      if (this.state.power) {
        this.state.power.timeLeft -= dt;
        if (this.state.power.timeLeft <= 0) {
          this.state.power = null;
          this.blip(300, 0.2, "sine", 0.06, 160);
          this.emit();
        }
      }

      // the target board runs on its own cycle
      if (!this.ending) this.boardTick(dt);

      this.music(dt);
      if (this.frame % 12 === 0) this.emit();
    }

    // camera sway follows pointer. The *base* pose is tracked separately so
    // shake / kick offsets never feed back into it (they used to accumulate
    // into position.x/y, which slowly pulled the aim off the crosshair).
    const targetX = this.pointer.x * 0.16;
    const targetY = 1.45 + this.pointer.y * 0.1;
    this.baseCam.x += (targetX - this.baseCam.x) * 0.08;
    this.baseCam.y += (targetY - this.baseCam.y) * 0.08;
    this.baseCam.ry += (-this.pointer.x * 0.12 - this.baseCam.ry) * 0.08;
    this.baseCam.rx += (this.pointer.y * 0.07 - this.baseCam.rx) * 0.08;

    // between rounds the camera drifts out for a wide establishing shot of the
    // whole fairground (neighbouring stalls, ferris wheel, sky) behind the menus
    const wantShowcase = this.state.phase === "idle" || this.state.phase === "over";
    this.blaster.group.visible = !wantShowcase;

    if (wantShowcase) {
      const a = t * 0.07;
      const target = this.showcaseDummy.position.set(
        Math.sin(a) * 13,
        5.4 + Math.sin(a * 1.7) * 0.7,
        17 + Math.cos(a) * 3,
      );
      const k = Math.min(1, rdt * 1.6);
      this.camera.position.lerp(target, k);
      this.showcaseDummy.position.copy(this.camera.position);
      this.showcaseDummy.lookAt(0, 2.4, -4);
      this.camera.quaternion.slerp(this.showcaseDummy.quaternion, k);
      // the counter lights don't reach this far out, so lift the ambient wash
      // enough for the whole fairground to read behind the menus
      this.hemi.intensity = this.hemiBase * 3.4;
      this.keyLight.intensity = this.keyBase * 1.6;
      this.showcase = 1;
    } else {
      if (this.showcase > 0) {
        // snap straight back behind the counter when a round starts
        this.camera.position.z = this.baseCam.z;
        this.camera.position.x = this.baseCam.x;
        this.camera.rotation.set(0, 0, 0);
        this.hemi.intensity = this.hemiBase;
        this.keyLight.intensity = this.keyBase;
        this.showcase = 0;
      }
      this.camera.position.x = this.baseCam.x;
      this.camera.position.y = this.baseCam.y;
      this.camera.position.z = this.baseCam.z;
      this.camera.rotation.y = this.baseCam.ry;
      this.camera.rotation.x = this.baseCam.rx;

      // screen shake (visual only — never affects where a shot lands)
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt * 3.2);
        const s = this.shake * 0.05;
        this.camera.position.x += (Math.random() - 0.5) * s;
        this.camera.position.y += (Math.random() - 0.5) * s;
        this.camera.rotation.z = (Math.random() - 0.5) * this.shake * 0.03;
      } else {
        this.camera.rotation.z *= 0.85;
      }

      // sharp muzzle-kick on the camera (subtle, never pulls back off the booth)
      this.firePunch = Math.max(0, this.firePunch - dt * 12);
      if (this.firePunch > 0) {
        const p = this.firePunch * this.firePunch;
        this.camera.rotation.x += p * 0.012;
        this.camera.rotation.z += this.fireRoll * p * 0.006;
        this.camera.position.y += p * 0.004;
      }
    }



    // blaster aim + recoil (fast kick back, springy return)
    this.recoil = Math.max(0, this.recoil - dt * 6);
    const kick = this.recoil * this.recoil;
    const settle = Math.sin(this.recoil * Math.PI * 2) * this.recoil * 0.012;
    const b = this.blaster.group;

    // point the barrel at the exact crosshair position (same NDC the raycaster uses).
    // camera-space direction of the aim ray -> yaw/pitch the gun must adopt.
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const aimYaw = Math.atan2(this.pointer.x * tanHalf * this.camera.aspect, 1);
    const aimPitch = Math.atan2(this.pointer.y * tanHalf, 1);
    // smooth follow so the gun swings instead of snapping
    this.aimYaw += (aimYaw - this.aimYaw) * Math.min(1, dt * 12);
    this.aimPitch += (aimPitch - this.aimPitch) * Math.min(1, dt * 12);

    b.position.set(
      this.fireRoll * kick * 0.012 + this.aimYaw * 0.16,
      -0.19 - Math.sin(t * 2) * 0.005 + kick * 0.03 + settle + this.aimPitch * 0.1,
      -0.52 + kick * 0.12,
    );
    b.rotation.set(
      0.03 + this.aimPitch + kick * 0.42 + settle,
      0.12 - this.aimYaw + this.fireRoll * kick * 0.05,
      0.0 + this.aimYaw * 0.12 + this.fireRoll * kick * 0.08,
    );

    // ---- reload choreography: cant the gun in, drop the mag, slam a fresh one, rack ----
    const mag = this.blaster.mag;
    const rackSlide = this.blaster.slide;
    const magLight = this.blaster.magLight;
    if (this.state.reloading) {
      const p = THREE.MathUtils.clamp(1 - this.state.reloadLeft / RELOAD_TIME, 0, 1);
      // easing helpers — pronounced curves so each mechanical beat reads clearly
      const easeOutBack = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.6 * Math.pow(x - 1, 2);
      const easeInCubic = (x: number) => x * x * x;
      const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -9 * x));
      const smooth = (x: number) => x * x * (3 - 2 * x);

      // gun tips out of the aim line at the start and comes back up at the end
      const easeIn = Math.min(1, p / 0.16);
      const easeOut = p > 0.86 ? Math.max(0, 1 - (p - 0.86) / 0.14) : 1;
      const pose = smooth(easeIn) * smooth(easeOut);
      // brought closer and toward the centre-left so the mag well is front and centre
      b.position.x += pose * 0.17;
      b.position.y -= pose * 0.1;
      b.position.z += pose * 0.2;
      b.rotation.x += pose * -0.5;
      b.rotation.y += pose * 0.62;
      b.rotation.z += pose * 0.62;
      // small breathing wobble so the hold never looks frozen
      b.rotation.z += pose * Math.sin(t * 9) * 0.02;

      // camera leans in and tilts toward the weapon for the duration of the reload
      this.camera.position.x += pose * 0.06;
      this.camera.position.y -= pose * 0.03;
      this.camera.position.z -= pose * 0.22;
      this.camera.rotation.y += pose * 0.035;
      this.camera.rotation.z += pose * 0.02;

      let lightPulse = pose * 0.35;

      if (p < 0.44) {
        // magazine releases with a snap, then falls free under gravity
        const q = THREE.MathUtils.clamp((p - 0.08) / 0.36, 0, 1);
        const fall = easeInCubic(q);
        mag.visible = q < 0.999;
        mag.position.set(-fall * 0.12, -fall * 2.6, fall * 0.24);
        mag.rotation.set(fall * 1.1, 0, fall * 0.5);
        rackSlide.position.z = 0;
        if (q < 0.12) lightPulse += (1 - q / 0.12) * 1.2; // release flick
      } else if (p < 0.52) {
        mag.visible = false;
      } else if (p < 0.8) {
        // fresh magazine sweeps up and slams home with an overshoot settle
        const q = THREE.MathUtils.clamp((p - 0.52) / 0.28, 0, 1);
        const e = THREE.MathUtils.clamp(easeOutBack(q), 0, 1.15);
        mag.visible = true;
        mag.position.set(-0.16 * (1 - e), -2.6 * (1 - e), 0.24 * (1 - e));
        mag.rotation.set(1.1 * (1 - e), 0, 0.5 * (1 - e));
        // highlight builds as the mag approaches, flares on seating
        lightPulse += 0.5 + smooth(q) * 1.4;
        if (q > 0.82) {
          const jolt = (q - 0.82) / 0.18;
          b.position.y -= Math.sin(jolt * Math.PI) * 0.035;
          b.rotation.x += Math.sin(jolt * Math.PI) * 0.05;
          lightPulse += Math.sin(jolt * Math.PI) * 2.6;
        }
      } else {
        // slide / charging handle yanks back and snaps forward
        const q = THREE.MathUtils.clamp((p - 0.8) / 0.16, 0, 1);
        mag.visible = true;
        mag.position.set(0, 0, 0);
        mag.rotation.set(0, 0, 0);
        const back = q < 0.45 ? easeOutExpo(q / 0.45) : 1 - easeInCubic((q - 0.45) / 0.55);
        rackSlide.position.z = back * 0.24;
        b.position.z += back * 0.02;
        lightPulse += 0.6 + (q > 0.9 ? (q - 0.9) / 0.1 : 0) * 2.2;
      }

      magLight.intensity += (lightPulse - magLight.intensity) * Math.min(1, dt * 18);

      const stage = p < 0.44 ? 1 : p < 0.8 ? 2 : 3;
      if (stage !== this.reloadStage) {
        this.reloadStage = stage;
        if (stage === 2) this.blip(170, 0.09, "square", 0.05, 90); // mag hits the floor
        if (stage === 3) {
          this.blip(110, 0.12, "square", 0.09, 70); // fresh mag seated
          this.buzz(22);
        }
      }
    } else if (this.reloadStage) {
      this.reloadStage = 0;
      mag.visible = true;
      mag.position.set(0, 0, 0);
      mag.rotation.set(0, 0, 0);
      rackSlide.position.z = 0;
      this.blip(320, 0.07, "square", 0.07, 900); // slide forward, ready
      this.buzz(14);
    } else if (magLight.intensity > 0) {
      magLight.intensity = Math.max(0, magLight.intensity - dt * 6);
    }



    const fm = this.blaster.flash.material as THREE.MeshBasicMaterial;
    fm.opacity = Math.max(0, fm.opacity - dt * 8);
    this.blaster.flashLight.intensity = Math.max(0, this.blaster.flashLight.intensity - dt * 90);

    // targets
    const slow = this.state.power?.kind === "slowmo" ? 0.35 : 1;
    for (const tt of this.targets) {
      const shelf = SHELVES[tt.lane]!;
      if (tt.alive) {
        tt.group.position.x += tt.dir * tt.speed * slow * dt;
        if (tt.group.position.x > shelf.halfWidth) tt.dir = -1;
        if (tt.group.position.x < -shelf.halfWidth) tt.dir = 1;
        tt.group.position.y = shelf.y + Math.abs(Math.sin(t * 1.6 + tt.bob)) * 0.12;
        tt.group.rotation.y = Math.sin(t * 0.9 + tt.bob) * 0.35;
        const s = tt.group.scale.x;
        if (s < 1) tt.group.scale.setScalar(Math.min(1, s + dt * 3.2));
      } else {
        const age = t - tt.hitAt;
        tt.group.rotation.x -= dt * 7;
        tt.group.position.y -= dt * 2.6;
        tt.group.scale.multiplyScalar(1 - dt * 1.6);
        if (age > 0.9) {
          this.scene.remove(tt.group);
          disposeObject(tt.group);
        }
      }
    }
    this.targets = this.targets.filter((x) => x.alive || t - x.hitAt <= 0.9);

    // safety net: guarantee every shelf keeps its full stock of toys even if a
    // respawn timer was lost (tab throttling, pause, wave transitions)
    if (this.state.phase === "playing" && !this.ending) {
      for (let lane = 0; lane < SHELVES.length; lane++) {
        let stock = 0;
        for (const tt of this.targets) {
          // toys knocked down less than 0.7s ago still count, so the shelf
          // refills after a short beat instead of popping in instantly
          const beat = this.state.wave <= 2 ? 0.7 : this.state.wave <= 4 ? 0.45 : 0.25;
          if (tt.lane === lane && (tt.alive || t - tt.hitAt < beat)) stock++;
        }
        for (let i = stock; i < shelfStock(this.state.wave); i++) this.spawnTarget(lane, true);
      }
    }


    // particles
    for (const p of this.particles) {
      p.life -= dt;
      p.vel.y -= 6 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 8;
      p.mesh.rotation.y += dt * 6;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        disposeObject(p.mesh);
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const tr of this.tracers) {
      tr.life -= dt;
      const mm = tr.line.material as THREE.MeshBasicMaterial;
      mm.opacity = Math.max(0, tr.life / 0.12);
      if (tr.life <= 0) {
        this.scene.remove(tr.line);
        disposeObject(tr.line);
      }
    }
    this.tracers = this.tracers.filter((x) => x.life > 0);

    for (const b of this.bullets) {
      b.travelled += b.speed * dt;
      if (b.travelled >= b.dist) {
        this.scene.remove(b.mesh);
        disposeObject(b.mesh);
      } else {
        b.mesh.position.copy(b.from).addScaledVector(b.dir, b.travelled);
      }
    }
    this.bullets = this.bullets.filter((b) => b.travelled < b.dist);


    this.updateLaser();

    this.autoTune(rdt);
    if (this.postFx) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  };

  /**
   * Adaptive quality. Desktop sheds effects only (shadow quality -> bloom ->
   * shadows off). Mobile starts already trimmed, so the last step there also
   * drops render resolution, which is the only remaining big lever. Never steps
   * back up, to avoid oscillation.
   */
  private perfAccum = 0;
  private perfFrames = 0;
  private perfTier = 0;
  private autoTune(rdt: number) {
    if (this.perfTier >= 4) return;
    this.perfAccum += rdt;
    this.perfFrames++;
    if (this.perfFrames < 45) return;
    const avg = this.perfAccum / this.perfFrames;
    this.perfAccum = 0;
    this.perfFrames = 0;
    // react only when we clearly miss a smooth ~60fps frame time
    if (avg <= 1 / 45) return;

    this.perfTier++;
    if (this.perfTier === 1) {
      // cheaper shadows, full resolution kept
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
      this.scene.traverse((o) => {
        const l = o as THREE.Light & { shadow?: THREE.LightShadow };
        if (l.isLight && l.castShadow && l.shadow) {
          l.shadow.mapSize.set(512, 512);
          if (l.shadow.map) {
            l.shadow.map.dispose();
            l.shadow.map = null as unknown as THREE.WebGLRenderTarget;
          }
        }
      });
      this.renderer.shadowMap.needsUpdate = true;
    } else if (this.perfTier === 2) {
      if (this.bloom) this.bloom.enabled = false;
      this.postFx = false;
    } else if (this.perfTier === 3) {
      this.renderer.shadowMap.enabled = false;
      this.scene.traverse((o) => {
        const m = o as THREE.Mesh & THREE.Light;
        if (m.castShadow) m.castShadow = false;
        if (m.receiveShadow) m.receiveShadow = false;
      });
    } else {
      // Render resolution stays untouched so toys/booth never look blurry. The last
      // levers are per-pixel lighting extras and, on weak phones, a steady frame cap
      // (a locked 40 -> 30fps feels smoother than a stuttering 45).
      this.hemi.intensity *= 0.9;
      this.renderer.toneMapping = THREE.LinearToneMapping;
      if (this.isMobile) this.playBudget = Math.max(this.playBudget, 1 / 30);
    }


  }




  // ---------------- public ----------------
  /**
   * Tell the engine a full-screen UI panel (prize shop, help, sound, briefing…)
   * is covering the scene, so the 3D view can coast at a low frame rate.
   */
  setUiOverlay(open: boolean) {
    this.uiOverlay = open;
  }


  start() {
    this.state = {
      ...this.state,
      score: 0,
      tickets: 0,
      combo: 1,
      timeLeft: LEVELS[0]!.time,
      roundTime: LEVELS[0]!.time,
      phase: "playing",
      hits: 0,
      shots: 0,
      prizes: [],
      toast: null,
      wave: 1,
      waveBanner: null,
      power: null,
      bossHp: 0,
      ammo: MAX_AMMO,
      reloading: false,
      reloadLeft: 0,
      forbidden: this.state.forbidden ?? pickForbidden(),
      board: null,
      orderStreak: 0,
      levelHits: 0,
      levelGoal: LEVELS[0]!.goal,
      fever: false,
      bankShots: 0,
    };
    this.shake = 0;
    this.ending = false;
    this.endingT = 0;
    this.timeScale = 1;
    this.state.ending = false;

    for (const t of this.targets) {
      this.scene.remove(t.group);
      disposeObject(t.group);
    }
    this.targets = [];
    this.spawnInitial();
    // the first instruction is posted against the freshly stocked shelves
    this.startLevel(1);
    this.blip(520, 0.12, "triangle", 0.08, 900);
    this.emit();
  }

  /** choose the round's forbidden toy before the briefing popup */
  prepareRound(): ToyKind {

    this.state.forbidden = pickForbidden();
    this.emit();
    return this.state.forbidden;
  }

  /** switch the booth between a sunny afternoon and the neon night fair */
  /** pick the round length (seconds) — only allowed outside a live round */
  setRoundTime(sec: number) {
    if (this.state.phase === "playing" || this.state.phase === "paused") return;
    if (this.state.roundTime === sec) return;
    this.state.roundTime = sec;
    this.state.timeLeft = sec;
    this.emit();
  }

  setTimeOfDay(tod: TimeOfDay) {
    if (this.state.timeOfDay === tod) return;
    this.state.timeOfDay = tod;
    this.applyTimeOfDay();
    this.emit();
  }

  private applyTimeOfDay() {
    const day = this.state.timeOfDay === "day";

    this.scene.background = null;
    this.carnival?.setTimeOfDay(day);
    this.scene.fog = new THREE.FogExp2(day ? 0xbfdcf3 : 0x140b22, day ? 0.012 : 0.006);

    this.hemi.color.set(day ? 0xdff0ff : 0xffd9a0);
    this.hemi.groundColor.set(day ? 0xa88f6d : 0x2a1533);
    this.hemi.intensity = day ? 1.15 : 0.35;
    this.hemiBase = this.hemi.intensity;

    this.keyLight.color.set(day ? 0xfffaf0 : 0xfff0d0);
    this.keyLight.intensity = day ? 2.6 : 1.7;
    this.keyBase = this.keyLight.intensity;

    this.fillLight.color.set(day ? 0xfff2d8 : 0xff7ac4);
    this.fillLight.intensity = day ? 1.2 : 3;

    // neon signage barely reads in daylight
    for (const b of this.boothLights) b.light.intensity = b.base * (day ? 0.28 : 1);

    this.bloom.strength = day ? 0.12 : 0.3;
    this.renderer.toneMappingExposure = day ? 1.1 : 0.98;
  }

  pause() {
    if (this.state.phase !== "playing") return;
    this.state.phase = "paused";
    this.hideLaser();
    // platform requirement: no audio while the game is paused / backgrounded
    if (this.audio && this.audio.state === "running") void this.audio.suspend();
    this.emit();
  }

  resume() {
    if (this.state.phase !== "paused") return;
    this.state.phase = "playing";
    if (this.audio && this.audio.state === "suspended") void this.audio.resume();
    this.emit();
  }

  mainMenu() {
    this.state.phase = "idle";
    this.state.timeLeft = this.state.roundTime;
    this.ending = false;
    this.endingT = 0;
    this.state.ending = false;
    this.timeScale = 1;
    this.hideLaser();
    this.emit();
  }


  exit() {
    this.endGame();
  }

  private endGame() {
    if (this.ending || this.state.phase === "over") return;
    // start the slow-motion outro; the results panel opens when it settles
    this.ending = true;
    this.endingT = 0;
    this.state.ending = true;
    this.state.timeLeft = 0;
    this.state.power = null;
    this.state.board = null;
    this.laserOn = false;
    this.hideLaser();
    this.shake = Math.max(this.shake, 0.8);
    this.blip(520, 0.7, "sine", 0.08, 140);
    this.emit();
  }

  /**
   * Reject impossible results before they are banked. If state was poked from
   * DevTools, score/tickets get clamped back to what the recorded shots and
   * hits could plausibly produce.
   */
  private clampResults() {
    const shots = safeInt(this.state.shots, 100_000);
    const hits = Math.min(safeInt(this.state.hits, 100_000), shots * 8 + 8);
    const scoreCap = Math.min(MAX_SCORE, shots * MAX_POINTS_PER_SHOT + SCORE_SLACK);
    this.state.score = safeInt(this.state.score, scoreCap);
    const ticketCap = Math.ceil(this.state.score / 50) + hits + 120;
    this.state.tickets = safeInt(this.state.tickets, ticketCap);
    this.state.hits = hits;
  }

  private finishGame() {
    this.ending = false;
    this.timeScale = 1;
    this.state.ending = false;
    this.state.phase = "over";
    this.state.timeLeft = 0;
    this.clampResults();
    const bank = safeInt(secureGetOrMigrate<number>(BANK_KEY, 0, legacyNumber), MAX_BANK) + this.state.tickets;
    secureSet(BANK_KEY, safeInt(bank, MAX_BANK));
    if (this.state.score > this.state.best) {
      this.state.best = this.state.score;
      secureSet(BEST_KEY, this.state.best);
    }
    this.blip(440, 0.5, "sine", 0.09, 180);
    this.emit();
  }


  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("orientationchange", this.resize);
    window.removeEventListener("scroll", this.invalidateRect);

    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.scene.traverse(disposeObject);
    this.composer.dispose();
    this.renderer.dispose();
    void this.audio?.close();
  }
}

function pickForbidden(): ToyKind {
  return PICKABLE[Math.floor(Math.random() * PICKABLE.length)]!;
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
}

function readVolume(key: string, fallback: number) {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? clamp01(n) : fallback;
}

function disposeObject(o: THREE.Object3D) {
  const mesh = o as THREE.Mesh;
  if (mesh.isMesh) {
    mesh.geometry?.dispose();
    const m = mesh.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else m?.dispose();
  }
}
