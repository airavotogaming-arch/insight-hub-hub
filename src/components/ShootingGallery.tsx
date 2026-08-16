import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Volume2, VolumeX } from "lucide-react";
import JoyBlasterLogo from "@/components/JoyBlasterLogo";
import SplashScreen from "@/components/SplashScreen";
import MainMenu from "@/components/MainMenu";


import type { CarnivalGame, GameState } from "@/game/engine";

import {
  SHOP_ITEMS,
  getBank,
  setBank,
  getOwned,
  addOwned,
  getEquipped,
  setEquipped,
  getBoard,
  saveScore,
  renameBoardEntries,
  addMatch,
  renameHistoryEntries,


  getOwnedGuns,
  addOwnedGun,
  getEquippedGun,
  setEquippedGun,
  getPlayerName,
  setPlayerName,
  getMaxLevel,
  setMaxLevel,
  type ScoreEntry,
} from "@/game/shop";
import { GUN_ITEMS } from "@/game/guns";
import { GunIcon } from "@/components/GunIcon";
import { TOY_SPECS, type ToyKind } from "@/game/toys";
import { Crosshair } from "@/components/Crosshair";
import { CountUp } from "@/components/CountUp";
import { asset } from "@/lib/assetUrl";
import {
  initPlaygama,
  playgamaGameReady,
  playgamaGameplayStart,
  playgamaGameplayStop,
  showInterstitial,
  showRewarded,
  playgamaSubmitScore,
  playgamaLeaderboard,
  type LeaderboardEntry,
} from "@/lib/playgama";
import {
  shouldShowInterstitial,
  markInterstitialShown,
  canShowRewarded,
  markRewardedShown,
  isAdTestMode,
  setAdTestMode,
} from "@/lib/adConfig";




const INITIAL: GameState = {
  score: 0,
  best: 0,
  tickets: 0,
  combo: 1,
  timeLeft: 120,
  roundTime: 120,
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
  ammo: 20,
  reloading: false,
  reloadLeft: 0,
  board: null,
  orderStreak: 0,
  levelHits: 0,
  levelGoal: 8,
  fever: false,
  bankShots: 0,
};

const POWER_TEXT: Record<string, string> = {
  slowmo: "SLOW-MO",
  double: "DOUBLE SCORE",
  spread: "SPREAD SHOT",
};

function Pad({ value, size = 4 }: { value: number; size?: number }) {
  return <>{String(Math.max(0, Math.floor(value))).padStart(size, "0")}</>;
}

export default function ShootingGallery() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<CarnivalGame | null>(null);
  const [state, setState] = useState<GameState>(INITIAL);
  const [cursor, setCursor] = useState({ x: 0.5, y: 0.5 });
  const [pulse, setPulse] = useState(0);
  const [isTouch, setIsTouch] = useState(false);
  const [holding, setHolding] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [globalBoard, setGlobalBoard] = useState<LeaderboardEntry[] | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showSound, setShowSound] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [adTestMode, setAdTestModeState] = useState(false);
  const [touchSensitivity, setTouchSensitivityState] = useState(1.0);
  useEffect(() => setAdTestModeState(isAdTestMode()), []);

  const readTouchSensitivity = () => {
    try {
      const raw = localStorage.getItem("sg-touch-sens");
      if (raw === null) return 1.0;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? Math.max(0.5, Math.min(3.0, n)) : 1.0;
    } catch {
      return 1.0;
    }
  };

  const setTouchSensitivity = (value: number) => {
    const clamped = Math.max(0.5, Math.min(3.0, Math.round(value * 10) / 10));
    setTouchSensitivityState(clamped);
    try {
      localStorage.setItem("sg-touch-sens", String(clamped));
    } catch {
      /* ignore */
    }
  };

  const [bank, setBankState] = useState(0);
  const [owned, setOwned] = useState<string[]>(["classic"]);
  const [equipped, setEquippedState] = useState("classic");
  const [ownedGuns, setOwnedGuns] = useState<string[]>(["carnival"]);
  const [gun, setGunState] = useState("carnival");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [selectedGun, setSelectedGun] = useState<string | null>(null);
  const [shopTab, setShopTab] = useState<"crosshair" | "gun">("crosshair");
  const [board, setBoard] = useState<ScoreEntry[]>([]);
  const [playerName, setPlayerNameState] = useState("");
  const [maxLevel, setMaxLevelState] = useState(1);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const [banner, setBanner] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [tourStep, setTourStep] = useState(0); // 0 = off, 1..3 = live steps
  /** incremental drag state: aim advances by per-event deltas so a velocity-based
   *  gain can be applied (fast swipes travel further, slow drags stay precise). */
  const dragRef = useRef({
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    moved: false,
  });
  /** smoothed swipe speed in screen-widths per second (low-pass = no jitter spikes) */
  const speedRef = useRef(0);
  /** weak devices deliver fewer, larger pointer samples -> cap gain and step size
   *  so a single fast sample can't fling the crosshair past the target. */
  const lowEndRef = useRef(false);

  /** latest aim (0..1 screen space). Kept in a ref so pointer handlers never wait
   *  for a React render — the crosshair state is flushed once per animation frame. */
  const aimRef = useRef({ x: 0.5, y: 0.5 });
  const cursorRaf = useRef(0);
  /** mirrors `holding` for use inside pointer handlers (no stale-closure delay) */
  const holdingRef = useRef(false);

  /** coalesce crosshair re-renders to one per frame instead of one per touch event */
  const flushCursor = () => {
    if (cursorRaf.current) return;
    cursorRaf.current = requestAnimationFrame(() => {
      cursorRaf.current = 0;
      setCursor({ x: aimRef.current.x, y: aimRef.current.y });
    });
  };

  useEffect(() => () => {
    if (cursorRaf.current) cancelAnimationFrame(cursorRaf.current);
  }, []);


  const TOUR_STEPS = 3;
  const TOUR_KEY = "sg_tour_progress"; // highest step the user has completed

  const readTourProgress = () => {
    try {
      const raw = localStorage.getItem(TOUR_KEY);
      if (raw === null) return localStorage.getItem("sg_tour_done") === "1" ? TOUR_STEPS : 0;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? Math.min(TOUR_STEPS, Math.max(0, n)) : 0;
    } catch {
      return 0;
    }
  };

  const saveTourProgress = (step: number) => {
    try {
      const prev = readTourProgress();
      if (step > prev) localStorage.setItem(TOUR_KEY, String(step));
      if (step >= TOUR_STEPS) localStorage.setItem("sg_tour_done", "1");
    } catch {
      /* ignore */
    }
  };

  // advance the live tutorial and remember the step the user just finished
  const completeStep = (step: number) => {
    setTourStep((s) => (s === step ? (step >= TOUR_STEPS ? 0 : step + 1) : s));
    saveTourProgress(step);
  };

  const endTour = () => {
    setTourStep(0);
    saveTourProgress(TOUR_STEPS);
  };

  const restartTour = () => {
    try {
      localStorage.removeItem(TOUR_KEY);
      localStorage.removeItem("sg_tour_done");
    } catch {
      /* ignore */
    }
    setTourStep(1);
  };



  const skin = SHOP_ITEMS.find((i) => i.id === equipped) ?? SHOP_ITEMS[0]!;

  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
    // weak CPU/RAM -> fewer pointer samples per swipe, so aim gain is capped tighter
    lowEndRef.current =
      (navigator.hardwareConcurrency ?? 8) <= 4 ||
      ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8) <= 4;

    setBankState(getBank());
    setOwned(getOwned());
    setEquippedState(getEquipped());
    setOwnedGuns(getOwnedGuns());
    setGunState(getEquippedGun());
    setBoard(getBoard());
    setPlayerNameState(getPlayerName());
    setMaxLevelState(getMaxLevel());

    setTouchSensitivityState(readTouchSensitivity());
  }, []);

  // Ask returning players ("old users") who never set a name to enter one,
  // so their scores land on the global leaderboard under their name.
  // Brand-new players are left alone — they get prompted when they hit Play.
  useEffect(() => {
    if (getPlayerName()) return;
    const hasProgress =
      getBank() > 0 || getMaxLevel() > 1 || getBoard().length > 0;
    if (hasProgress) {
      setNameDraft("");
      setShowNamePrompt(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    gameRef.current?.setSkin(skin.hex);
  }, [skin.hex, state.phase]);

  useEffect(() => {
    gameRef.current?.setGun(gun);
  }, [gun, state.phase]);

  // wave banner
  useEffect(() => {
    if (!state.waveBanner) return undefined;
    setBanner(state.waveBanner.text);
    const t = setTimeout(() => setBanner(null), 1800);
    return () => clearTimeout(t);
  }, [state.waveBanner?.id]);

  // remember the highest level reached (shown on the menu badge)
  useEffect(() => {
    if (state.wave > maxLevel) {
      setMaxLevel(state.wave);
      setMaxLevelState(state.wave);
    }
  }, [state.wave, maxLevel]);


  // pull the global leaderboard whenever the panel opens
  useEffect(() => {
    if (!showLeaderboard) return;
    let alive = true;
    void playgamaLeaderboard(10).then((rows) => {
      if (alive) setGlobalBoard(rows);
    });
    return () => {
      alive = false;
    };
  }, [showLeaderboard]);

  // when a round ends, refresh the ticket bank and record the score under the saved name
  useEffect(() => {
    if (state.phase === "over") {
      setBankState(getBank());
      const who = playerName || getPlayerName();
      if (who && state.score > 0) {
        setBoard(saveScore(who, state.score));
        addMatch(who, state.score, state.wave);
      }
      void playgamaSubmitScore(state.score, who || undefined);
    }
  }, [state.phase]);


  // mobile: show the "aim from below the table" hint and start the live tutorial
  useEffect(() => {
    if (!isTouch) return undefined;
    if (state.phase !== "playing") {
      setShowHint(false);
      return undefined;
    }
    setShowHint(true);
    const t = setTimeout(() => setShowHint(false), 6000);
    // resume where the user left off — completed steps are skipped
    const completed = readTourProgress();
    if (completed < TOUR_STEPS) setTourStep((s) => (s === 0 ? completed + 1 : s));

    return () => clearTimeout(t);
  }, [isTouch, state.phase]);



  const buy = (id: string) => {
    const item = SHOP_ITEMS.find((i) => i.id === id);
    if (!item) return;
    if (owned.includes(id)) {
      setEquipped(id);
      setEquippedState(id);
      return;
    }
    if (bank < item.cost) return;
    setBank(bank - item.cost);
    setBankState(bank - item.cost);
    addOwned(id);
    setOwned(getOwned());
    setEquipped(id);
    setEquippedState(id);
    setSelectedItem(null);
  };

  const buyGun = (id: string) => {
    const item = GUN_ITEMS.find((i) => i.id === id);
    if (!item) return;
    if (ownedGuns.includes(id)) {
      setEquippedGun(id);
      setGunState(id);
      return;
    }
    if (bank < item.cost) return;
    setBank(bank - item.cost);
    setBankState(bank - item.cost);
    addOwnedGun(id);
    setOwnedGuns(getOwnedGuns());
    setEquippedGun(id);
    setGunState(id);
    setSelectedGun(null);
  };

  const handleItemClick = (id: string) => {
    if (owned.includes(id)) {
      setEquipped(id);
      setEquippedState(id);
      setSelectedItem(id);
    } else {
      setSelectedItem(id);
    }
  };

  const handleGunClick = (id: string) => {
    if (ownedGuns.includes(id)) {
      setEquippedGun(id);
      setGunState(id);
      setSelectedGun(id);
    } else {
      setSelectedGun(id);
    }
  };


  useEffect(() => {
    let game: CarnivalGame | null = null;
    let cancelled = false;
    void (async () => {
      const { CarnivalGame: Engine } = await import("@/game/engine");
      if (cancelled || !canvasRef.current) return;
      game = new Engine(canvasRef.current, setState);
      gameRef.current = game;
    })();
    return () => {
      cancelled = true;
      game?.dispose();
      gameRef.current = null;
    };
  }, []);

  // ---------- Playgama Bridge ----------
  useEffect(() => {
    void initPlaygama().then(() => playgamaGameReady());
  }, []);

  // tell the platform when actual gameplay is running (pauses ads, tracks sessions)
  useEffect(() => {
    if (state.phase === "playing") playgamaGameplayStart();
    else playgamaGameplayStop();
  }, [state.phase]);

  // platform requirement: pause the round (and its audio) whenever the game
  // loses focus / visibility, e.g. the player switches tab or gets a call
  useEffect(() => {
    const pauseIfPlaying = () => {
      if (gameRef.current?.state.phase === "playing") gameRef.current.pause();
    };
    const onVisibility = () => {
      if (document.hidden) pauseIfPlaying();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", pauseIfPlaying);
    window.addEventListener("pagehide", pauseIfPlaying);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", pauseIfPlaying);
      window.removeEventListener("pagehide", pauseIfPlaying);
    };
  }, []);



  useEffect(() => {
    if (isTouch) return undefined;
    const onMove = (e: PointerEvent) => {
      aimRef.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
      flushCursor();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
    };
  }, [isTouch]);


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (state.phase === "playing" || state.phase === "paused")) {
        e.preventDefault();
        if (state.phase === "playing") gameRef.current?.pause();
        else gameRef.current?.resume();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.phase]);

  const aimFromClient = (clientX: number, clientY: number) => {
    const nx = (clientX / window.innerWidth) * 2 - 1;
    const ny = -((clientY / window.innerHeight) * 2 - 1);
    gameRef.current?.setAim(nx, ny);
    aimRef.current = { x: clientX / window.innerWidth, y: clientY / window.innerHeight };
    flushCursor();
  };

  const setAimNormalized = (nx: number, ny: number) => {
    const cx = Math.max(0, Math.min(1, nx));
    const cy = Math.max(0, Math.min(1, ny));
    // aim reaches the engine on the same event tick; the DOM crosshair follows on rAF
    gameRef.current?.setAim(cx * 2 - 1, -(cy * 2 - 1));
    aimRef.current = { x: cx, y: cy };
    flushCursor();
  };

  const onTouchDown = (e: React.PointerEvent) => {
    if (!isTouch || state.phase !== "playing") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: e.timeStamp || performance.now(),
      moved: false,
    };
    speedRef.current = 0;
    holdingRef.current = true;
    setHolding(true);
    gameRef.current?.setLaser(true);
    completeStep(1);
  };

  const onTouchMove = (e: React.PointerEvent) => {
    if (!holdingRef.current || state.phase !== "playing") return;
    const d = dragRef.current;
    // only the newest sample matters for aim; coalesced points are dropped on purpose
    const nat = e.nativeEvent as PointerEvent;
    const last = nat.getCoalescedEvents?.().at(-1) ?? nat;
    const cx = last.clientX;
    const cy = last.clientY;
    const now = last.timeStamp || nat.timeStamp || performance.now();

    if (!d.moved && Math.hypot(cx - d.startX, cy - d.startY) > 8) {
      d.moved = true;
      completeStep(2);
    }

    // per-event delta in screen-relative units
    let dx = (cx - d.lastX) / window.innerWidth;
    let dy = (cy - d.lastY) / window.innerHeight;
    const dt = Math.max(8, Math.min(64, now - d.lastT)) / 1000; // clamp: no huge jumps after a stall
    d.lastX = cx;
    d.lastY = cy;
    d.lastT = now;

    // instantaneous speed (screen-widths / second), low-passed so the gain curve
    // reacts to the swipe as a whole and not to a single noisy sample
    const inst = Math.hypot(dx, dy) / dt;
    speedRef.current += (inst - speedRef.current) * 0.35;
    const speed = speedRef.current;

    // velocity gain: slow drags get sub-1 gain for fine placement, fast swipes get
    // amplified so long flicks cross the booth without lifting the finger.
    const lowEnd = lowEndRef.current;
    const maxGain = lowEnd ? 1.6 : 2.2;
    const t = Math.min(1, Math.max(0, (speed - 0.25) / 2.2));
    const gain = 0.75 + (maxGain - 0.75) * t * t;

    dx *= gain * touchSensitivity;
    dy *= gain * touchSensitivity;

    // overshoot guard: clamp how far one sample can move the aim. Weak devices
    // report fewer samples per swipe, so their per-sample step must stay smaller.
    const maxStep = lowEnd ? 0.09 : 0.14;
    const step = Math.hypot(dx, dy);
    if (step > maxStep) {
      const k = maxStep / step;
      dx *= k;
      dy *= k;
    }

    setAimNormalized(aimRef.current.x + dx, aimRef.current.y + dy);
  };


  const onTouchUp = () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);
    gameRef.current?.setLaser(false);
    if (state.phase === "playing" && !state.ending) {
      gameRef.current?.fire();
      if (tourStep === 3) completeStep(3);
    }
  };


  // any popup / non-playing screen is open: native touch scrolling must work again
  const overlayOpen =
    showHelp ||
    showLeaderboard ||
    showInstructions ||
    showShop ||
    showSound ||
    showBriefing ||
    state.phase !== "playing";

  // let the 3D scene idle at a low frame rate while a panel covers it (saves a lot
  // of GPU work on phones; object detail and resolution are untouched)
  useEffect(() => {
    gameRef.current?.setUiOverlay(overlayOpen);
  }, [overlayOpen]);


  // mobile: while a round is live, swallow every native scroll / pinch / double-tap
  // zoom gesture inside the play surface so aiming never moves the page.
  useEffect(() => {
    if (!isTouch || overlayOpen) return undefined;
    const el = rootRef.current;
    if (!el) return undefined;


    const swallow = (e: Event) => {
      if (e.cancelable) e.preventDefault();
    };
    // touchmove: blocks scroll + pinch-zoom. touchstart on a 2nd finger: blocks pinch start.
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) swallow(e);
    };
    const onTouchMove = (e: TouchEvent) => swallow(e);
    // iOS Safari double-tap zoom
    let lastTap = 0;
    const onTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTap < 350) swallow(e);
      lastTap = now;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    // iOS gesture events (pinch) + wheel-based trackpad/browser zoom
    el.addEventListener("gesturestart", swallow as EventListener);
    el.addEventListener("gesturechange", swallow as EventListener);
    el.addEventListener("gestureend", swallow as EventListener);
    el.addEventListener("dblclick", swallow as EventListener);
    el.addEventListener("wheel", swallow as EventListener, { passive: false });
    el.addEventListener("contextmenu", swallow as EventListener);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("gesturestart", swallow as EventListener);
      el.removeEventListener("gesturechange", swallow as EventListener);
      el.removeEventListener("gestureend", swallow as EventListener);
      el.removeEventListener("dblclick", swallow as EventListener);
      el.removeEventListener("wheel", swallow as EventListener);
      el.removeEventListener("contextmenu", swallow as EventListener);
    };
  }, [isTouch]);

  // lock the document itself (iOS rubber-band / pull-to-refresh) while aiming
  useEffect(() => {
    if (!isTouch) return undefined;
    const lock = state.phase === "playing" || holding;
    if (!lock) return undefined;
    const { body, documentElement: html } = document;
    const prev = {
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlOverscroll: html.style.overscrollBehavior,
      touchAction: body.style.touchAction,
    };
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    html.style.overscrollBehavior = "none";
    body.style.touchAction = "none";
    return () => {
      body.style.overflow = prev.bodyOverflow;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.touchAction = prev.touchAction;
    };
  }, [isTouch, state.phase, holding]);


  // the round is wrapping up: drop the trigger so no shots leak into the outro
  useEffect(() => {
    if (!state.ending) return;
    setHolding(false);
    setShowHint(false);
    gameRef.current?.setLaser(false);
  }, [state.ending]);





  useEffect(() => {
    if (state.toast) {
      setPulse(state.toast.id);
      const t = setTimeout(() => setPulse(0), 700);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state.toast]);

  const accuracy = state.shots ? Math.round((state.hits / state.shots) * 100) : 0;

  
  const [adBusy, setAdBusy] = useState(false);
  // rounds played per game mode (round length), so each mode paces ads on its own
  const roundsPlayedByMode = useRef<Record<number, number>>({});
  const roundsPlayedInMode = roundsPlayedByMode.current[state.roundTime] ?? 0;
  const launchRound = () => {
    // interstitial pacing is driven entirely by src/lib/adConfig.ts
    if (shouldShowInterstitial(roundsPlayedInMode, state.roundTime) && !adBusy) {
      setAdBusy(true);
      markInterstitialShown();
      void showInterstitial().finally(() => {
        setAdBusy(false);
        gameRef.current?.prepareRound();
        setShowBriefing(true);
      });
      return;
    }
    gameRef.current?.prepareRound();
    setShowBriefing(true);
  };
  const beginRound = () => {
    if (!playerName) {
      setNameDraft("");
      setShowNamePrompt(true);
      return;
    }
    launchRound();
  };
  const submitName = () => {
    const clean = nameDraft.trim().slice(0, 14);
    if (!clean) return;
    const prev = playerName;
    setPlayerName(clean);
    setPlayerNameState(clean);
    // old players: re-tag their existing local scores with the name they just chose
    setBoard(renameBoardEntries(prev, clean));
    renameHistoryEntries(prev, clean);
    setShowNamePrompt(false);
    launchRound();
  };


  const confirmBriefing = () => {
    setShowBriefing(false);
    const mode = state.roundTime;
    roundsPlayedByMode.current[mode] = (roundsPlayedByMode.current[mode] ?? 0) + 1;
    gameRef.current?.start();
  };

  // rewarded ad: double the tickets earned this round
  const [doubled, setDoubled] = useState(false);
  useEffect(() => {
    if (state.phase === "playing") setDoubled(false);
  }, [state.phase]);
  const rewardedAvailable = canShowRewarded(state.roundTime);
  const watchForDoubleTickets = () => {
    if (adBusy || doubled || !canShowRewarded(state.roundTime)) return;

    setAdBusy(true);
    markRewardedShown();
    void showRewarded()
      .then((rewarded) => {
        if (!rewarded) return;
        setDoubled(true);
        // no tickets this round? still pay out a small bonus for watching
        const reward = state.tickets > 0 ? state.tickets : 25;
        const next = getBank() + reward;
        setBank(next);
        setBankState(next);
      })
      .finally(() => setAdBusy(false));

  };


  // rewarded ad inside the prize shop: watch an ad, get tickets
  const watchAdForTickets = () => {
    if (adBusy) return;
    setAdBusy(true);
    markRewardedShown();
    void showRewarded()
      .then((rewarded) => {
        if (!rewarded) return; // early close -> no reward
        const next = getBank() + 100;
        setBank(next);
        setBankState(next);
      })
      .finally(() => setAdBusy(false));
  };

  const resumeAfterSound = useRef(false);
  const openSound = () => {
    if (state.phase === "playing") {
      gameRef.current?.pause();
      resumeAfterSound.current = true;
    }
    setShowSound(true);
  };
  const closeSound = () => {
    setShowSound(false);
    if (resumeAfterSound.current) {
      resumeAfterSound.current = false;
      gameRef.current?.resume();
    }
  };

  return (
    <div
      ref={rootRef}
      className={`relative h-[100dvh] w-full overflow-hidden overscroll-none bg-midway select-none ${overlayOpen ? "touch-auto" : "touch-none"}`}
      style={{ ["--ch-color" as string]: skin.color }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-none touch-none" />

      {/* vignette */}
      <div className="pointer-events-none absolute inset-0 bg-vignette" />

      {/* ---------- HUD top ---------- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:gap-4 sm:p-6">
        <div className="marquee-panel min-w-0">
          <span className="panel-label">Score</span>
          <span className="panel-digits">
            <Pad value={state.score} size={5} />
          </span>
          <span className="panel-label mt-1">Best</span>

          <span className="panel-digits text-[1.4rem]">
            <Pad value={state.best} size={5} />
          </span>
        </div>

        <div className="marquee-panel panel-center min-w-0 items-center">
          <div className="panel-cell">
            <span className="panel-label">Tickets</span>
            <span className="panel-digits text-ticket">
              <Pad value={state.tickets} size={3} />
            </span>
          </div>
          <div className="panel-cell">
            <span className="panel-label">Ammo</span>
            <span
              className={`panel-digits text-[1.4rem] ${
                !state.reloading && state.ammo <= 5 ? "ammo-low" : ""
              }`}
            >
              {state.reloading ? "--" : state.ammo}
            </span>
          </div>
          <div className="panel-cell">
            <span className="panel-label">Level</span>
            <span className="panel-digits text-[1.4rem]">{state.wave}</span>
          </div>
        </div>


        <div className="marquee-panel min-w-0 items-end text-right">
          <span className="panel-label">Time</span>

          <span className="panel-digits">
            <Pad value={Math.floor(state.timeLeft / 60)} size={2} />:
            <Pad value={Math.floor(state.timeLeft % 60)} size={2} />
          </span>
          <span className="panel-label mt-1">Combo</span>
          <span
            className="panel-digits text-[1.4rem] text-combo"
            style={{ transform: pulse ? "scale(1.25)" : "scale(1)", transition: "transform .18s" }}
          >
            x{state.combo}
          </span>
        </div>
      </div>

      {/* ---------- in-game quick controls ---------- */}
      {(state.phase === "playing" || state.phase === "paused") && (
        <div className="absolute right-2 top-24 z-30 flex flex-col gap-2 sm:right-6 sm:top-40">
          <button aria-label="Sound settings" className="hud-icon-button" onClick={openSound}>
            {state.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button
            aria-label="Game menu"
            className="hud-icon-button"
            onClick={() => gameRef.current?.pause()}
          >
            <Menu size={20} />
          </button>
        </div>
      )}


      {/* ---------- crosshair ---------- */}
      {state.phase === "playing" && state.forbidden && (
        <div className="forbidden-badge">
          🚫 Don't shoot: {TOY_SPECS[state.forbidden].label}
        </div>
      )}

      {/* ---------- TARGET BOARD: the one object you may shoot ---------- */}
      {state.phase === "playing" && state.board && (
        <div className={`target-board ${state.fever ? "is-fever" : ""}`}>
          <span className="target-board-kicker">Shoot</span>
          <strong className="target-board-name">{TOY_SPECS[state.board.kind].label}</strong>
          <span className="target-board-meta">
            Level {state.wave} · {state.levelHits}/{state.levelGoal} hits
            {state.orderStreak > 1 ? ` · streak x${state.orderStreak}` : ""}
            {state.fever ? " · FEVER x2" : ""}
          </span>
          <span className="target-board-bar">
            <i
              style={{
                width: `${Math.max(0, Math.min(100, (state.board.timeLeft / state.board.every) * 100))}%`,
              }}
            />
          </span>
          <span className="target-board-goal">
            <i
              style={{
                width: `${Math.max(0, Math.min(100, (state.levelHits / state.levelGoal) * 100))}%`,
              }}
            />
          </span>
        </div>
      )}

      {state.phase === "playing" && (banner || state.power || state.bossHp > 0) && (
        <>
          {banner && <div className="wave-banner">{banner}</div>}
          <div className="badge-row">
            {state.power && (
              <span className="power-badge">
                {POWER_TEXT[state.power.kind]} · {Math.ceil(state.power.timeLeft)}s
              </span>
            )}
            {state.bossHp > 0 && <span className="boss-badge">BOSS · {state.bossHp} HITS LEFT</span>}
          </div>
        </>
      )}

      {state.phase === "playing" && state.reloading && (
        <div className="reload-banner">
          <span className="reload-text">RELOADING...</span>
          <span className="reload-bar">
            <i style={{ width: `${Math.min(100, (1 - state.reloadLeft / 2) * 100)}%` }} />
          </span>
        </div>
      )}

      {state.phase === "playing" && (
        <div
          className="pointer-events-none absolute z-20"
          style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%`, transform: "translate(-50%,-50%)" }}
        >
          <Crosshair variant={skin.style} color={skin.color} hit={!!pulse} />
        </div>
      )}


      {/* ---------- hit toast ---------- */}
      {state.toast && pulse ? (
        <div
          key={state.toast.id}
          className="pointer-events-none absolute z-30 hit-toast"
          style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100 - 8}%` }}
        >
          <span className={state.toast.points < 0 || state.toast.time ? "text-penalty" : "text-ticket"}>
            {state.toast.time ? `-${state.toast.time}s` : `${state.toast.points > 0 ? "+" : ""}${state.toast.points}`}
          </span>
          <em className="block text-[0.7rem] not-italic tracking-widest opacity-80">{state.toast.text}</em>
        </div>
      ) : null}

      {/* ---------- mobile hint + live tutorial ---------- */}
      {isTouch && state.phase === "playing" && showHint && tourStep === 0 && (
        <div className="mobile-hint">Hold anywhere and drag to aim · lift your finger to fire</div>
      )}

      {isTouch && state.phase === "playing" && tourStep > 0 && (
        <div className="tour-card">
          <span className="tour-step">Step {tourStep} of 3</span>
          <span className="tour-text">
            {tourStep === 1 && "Press and hold anywhere on the screen — the laser sight switches on."}
            {tourStep === 2 && "Keep holding and drag your finger to move the crosshair. Adjust Touch Drag in Settings if it feels too fast or slow."}
            {tourStep === 3 && "Nice! Now lift your finger to fire the blaster."}
          </span>
          <div className="tour-actions">
            <button className="tour-skip" onClick={endTour}>
              Skip tutorial
            </button>
          </div>
        </div>
      )}

      {/* ---------- mobile aim layer: hold anywhere, release to fire ---------- */}
      {isTouch && state.phase === "playing" && !state.ending && (
        <div
          className="absolute inset-0 z-10 touch-none"
          onPointerDown={onTouchDown}
          onPointerMove={onTouchMove}
          onPointerUp={onTouchUp}
          onPointerCancel={onTouchUp}
        />
      )}

      {/* ---------- bottom blaster info ---------- */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2 sm:p-6">
        <div className="plaque min-w-0">
          <span className="plaque-title">{GUN_ITEMS.find((x) => x.id === gun)?.name ?? "Star Blaster 3000"}</span>
          <span className="plaque-sub hidden sm:block">Move mouse to aim · Left click to fire</span>
          <span className="plaque-sub sm:hidden">Hold and drag to aim · release to fire</span>
        </div>


        <div className="plaque text-right">
          <span className="plaque-title">Accuracy {accuracy}%</span>
          <span className="plaque-sub">
            {state.hits} hits / {state.shots} shots
          </span>
        </div>
      </div>



      {/* ---------- start screen ---------- */}
      {state.phase === "idle" && (
        <MainMenu
          best={state.best}
          bank={bank}
          board={board}
          playerName={playerName}
          level={maxLevel}

          onPlay={beginRound}
          onShop={() => setShowShop(true)}
          onHelp={() => setShowHelp(true)}
          onLeaderboard={() => setShowLeaderboard(true)}
          onRewardClaimed={(next) => setBankState(next)}
          onInstructions={() => setShowInstructions(true)}
          onSettings={() => setShowSound(true)}
          onTutorial={
            isTouch
              ? () => {
                  restartTour();
                  beginRound();
                }
              : undefined
          }
        />
      )}

      {/* ---------- player name prompt ---------- */}
      {showNamePrompt && (
        <div key="ov-name" className="absolute inset-0 z-[70] flex items-center justify-center bg-overlay px-4">
          <div className="overlay-card help-card max-w-[22rem] text-center">
            <h2 className="fair-title text-[clamp(1.4rem,5vw,2.2rem)]">What&apos;s your name?</h2>
            <p className="fair-sub">We&apos;ll save it for your profile and scores.</p>
            <input
              className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-center text-foreground outline-none"
              value={nameDraft}
              maxLength={14}
              autoFocus
              placeholder="Player name"
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitName();
              }}
            />
            <button className="fair-button mt-3" disabled={!nameDraft.trim()} onClick={submitName}>
              START GAME
            </button>
          </div>
        </div>
      )}


      {/* ---------- round briefing ---------- */}
      {showBriefing && (
        <div key="ov-briefing" className="absolute inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-overlay px-3 py-3 sm:items-center sm:px-4 sm:py-4">
          <div className="overlay-card help-card">
            <JoyBlasterLogo size="sm" />
            <h2 className="fair-title text-[clamp(1.6rem,5vw,2.8rem)]">Warning</h2>
            <p className="fair-sub">Read the rules before the round starts.</p>

            <div className="warning-list">
              <div className="warning-row bad">
                <img className="warning-thumb" src={asset("toys/bomb.png")} alt="Bomb" width={44} height={44} />
                <span>
                  <strong>Bombs</strong> blow 5 seconds off the clock and reset your combo. Never shoot them.
                </span>
              </div>
              <div className="warning-row forbidden">
                {state.forbidden ? (
                  <img
                    className="warning-thumb"
                    src={asset(`toys/${state.forbidden}.png`)}
                    alt={TOY_SPECS[state.forbidden].label}
                    width={44}
                    height={44}
                  />
                ) : (
                  <span className="warning-icon">🚫</span>
                )}
                <span>
                  This round's forbidden prize is{" "}
                  <strong>{state.forbidden ? TOY_SPECS[state.forbidden].label : "…"}</strong>. Shoot it and you
                  <strong> lose half your score</strong>.
                </span>
              </div>
              <div className="warning-row">
                <span className="warning-icon">🎯</span>
                <span>
                  The board above the booth names <strong>one object</strong>. Only that object scores — hit anything
                  else and you <strong>lose 3-5 seconds</strong> plus your combo. The board rotates every few seconds,
                  so read it before you pull.
                </span>
              </div>
              <div className="warning-row">
                <span className="warning-icon">⏱️</span>
                <span>
                  Each level runs on its own clock, starting at <strong>45 seconds</strong> and tightening as you climb:
                  faster toys, quicker board changes and steeper penalties. Clear the level's hit quota to bank the
                  progress and reset the clock.
                </span>
              </div>
              <div className="warning-row">
                <span className="warning-icon">🔥</span>
                <span>
                  From <strong>Level 5</strong> a combo of six lights <strong>Fever</strong> — double score and double
                  tickets until you miss. Level 6 is <strong>Blackout Rush</strong>: the booth lights pulse dark.
                </span>
              </div>
              <div className="warning-row">
                <span className="warning-icon">↩️</span>
                <span>
                  A shot that misses the shelves <strong>ricochets off the back wall</strong>. Land the bounce on the
                  board's target for a <strong>Bank Shot</strong> at 1.5x.
                </span>
              </div>
            </div>


            <div className="tod-picker">
              <span className="tod-label">Choose your environment</span>
              <div className="tod-options">
                <button
                  type="button"
                  className={`tod-option day ${state.timeOfDay === "day" ? "selected" : ""}`}
                  onClick={() => gameRef.current?.setTimeOfDay("day")}
                >
                  <span className="tod-emoji">☀️</span>
                  <strong>Day</strong>
                  <span className="tod-hint">Bright sunny fair</span>
                </button>
                <button
                  type="button"
                  className={`tod-option night ${state.timeOfDay === "night" ? "selected" : ""}`}
                  onClick={() => gameRef.current?.setTimeOfDay("night")}
                >
                  <span className="tod-emoji">🌙</span>
                  <strong>Night</strong>
                  <span className="tod-hint">Neon midway lights</span>
                </button>
              </div>
            </div>

            <div className="pause-buttons">
              <button className="fair-button" onClick={confirmBriefing}>Got it · Start</button>
              <button className="fair-button alt" onClick={() => setShowBriefing(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- sound settings ---------- */}
      {showSound && (
        <div
          key="ov-sound"
          className="absolute inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay px-3 py-3 sm:items-center sm:px-4 sm:py-4"
          onClick={closeSound}
        >
          <div className="overlay-card help-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="fair-title text-[clamp(1.6rem,5vw,2.8rem)]">Settings</h2>
            <p className="fair-sub">Tune the carnival music, blaster effects, and mobile controls.</p>

            <button
              className={`sound-toggle ${state.muted ? "off" : "on"}`}
              role="switch"
              aria-checked={!state.muted}
              onClick={() => gameRef.current?.toggleMute()}
            >
              <span className="sound-toggle-label">{state.muted ? "Sound Off" : "Sound On"}</span>
              <span className="sound-switch" aria-hidden="true">
                <span className="sound-knob" />
              </span>
            </button>

            <div className={`volume-rows ${state.muted ? "is-muted" : ""}`}>
              <label className="volume-row">
                <span className="volume-name">Music</span>
                <input
                  type="range"
                  className="volume-slider"
                  min={0}
                  max={100}
                  step={1}
                  disabled={state.muted}
                  value={Math.round(state.musicVolume * 100)}
                  onChange={(e) => gameRef.current?.setMusicVolume(Number(e.target.value) / 100)}
                />
                <span className="volume-value">{Math.round(state.musicVolume * 100)}%</span>
              </label>
              <label className="volume-row">
                <span className="volume-name">Effects</span>
                <input
                  type="range"
                  className="volume-slider"
                  min={0}
                  max={100}
                  step={1}
                  disabled={state.muted}
                  value={Math.round(state.sfxVolume * 100)}
                  onChange={(e) => gameRef.current?.setSfxVolume(Number(e.target.value) / 100)}
                />
                <span className="volume-value">{Math.round(state.sfxVolume * 100)}%</span>
              </label>
              {isTouch && (
                <label className="volume-row">
                  <span className="volume-name">Touch Drag</span>
                  <input
                    type="range"
                    className="volume-slider"
                    min={5}
                    max={30}
                    step={1}
                    value={Math.round(touchSensitivity * 10)}
                    onChange={(e) => setTouchSensitivity(Number(e.target.value) / 10)}
                  />
                  <span className="volume-value">{touchSensitivity.toFixed(1)}x</span>
                </label>
              )}
            </div>

            <button
              className={`sound-toggle ${adTestMode ? "on" : "off"}`}
              role="switch"
              aria-checked={adTestMode}
              onClick={() => setAdTestModeState(setAdTestMode(!adTestMode))}
            >
              <span className="sound-toggle-label">
                {adTestMode ? "Ad Test Mode On" : "Ad Test Mode Off"}
              </span>
              <span className="sound-switch" aria-hidden="true">
                <span className="sound-knob" />
              </span>
            </button>
            <p className="fair-sub" style={{ fontSize: "0.8rem", opacity: 0.7 }}>
              Simulates interstitial and rewarded ads locally so you can verify
              timing without real ad calls.
            </p>

            <button className="fair-button" onClick={closeSound}>Close</button>

          </div>
        </div>
      )}

      {/* ---------- prize shop ---------- */}
      {showShop && (
        <div key="ov-shop" className="absolute inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay px-3 py-3 sm:items-center sm:px-4 sm:py-4" onClick={() => setShowShop(false)}>
          <div className="overlay-card help-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="fair-title text-[clamp(1.6rem,5vw,2.8rem)]">Prize Shop</h2>
            <p className="fair-sub">Ticket bank: <strong className="text-ticket">{bank}</strong></p>

            <div className="shop-boards">
              <div className="shop-board">
                <span className="shop-board-title">Score Board</span>
                <strong className="shop-board-value">{board[0]?.score ?? 0}</strong>
                <span className="shop-board-meta">Best score</span>
                {board.length > 0 && (
                  <ul className="shop-board-list">
                    {board.map((e, i) => (
                      <li key={`${e.name}-${i}`}>
                        <span>{i + 1}. {e.name}</span>
                        <span>{e.score}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="shop-board">
                <span className="shop-board-title">Target Board</span>
                <strong className="shop-board-value">{accuracy}%</strong>
                <span className="shop-board-meta">
                  {state.hits} hits / {state.shots} shots
                </span>
                <span className="shop-board-bar">
                  <i style={{ width: `${Math.max(0, Math.min(100, accuracy))}%` }} />
                </span>
              </div>

              <div className="shop-board">
                <span className="shop-board-title">Progress Board</span>
                <strong className="shop-board-value">Lv {state.wave}</strong>
                <span className="shop-board-meta">
                  {state.levelHits}/{state.levelGoal} hits this level
                </span>
                <span className="shop-board-bar">
                  <i
                    style={{
                      width: `${Math.max(0, Math.min(100, (state.levelHits / Math.max(1, state.levelGoal)) * 100))}%`,
                    }}
                  />
                </span>
              </div>
            </div>

            <div className="shop-tabs">
              <button
                className={`shop-tab ${shopTab === "crosshair" ? "on" : ""}`}
                onClick={() => setShopTab("crosshair")}
              >
                Crosshairs
              </button>
              <button
                className={`shop-tab ${shopTab === "gun" ? "on" : ""}`}
                onClick={() => setShopTab("gun")}
              >
                Blasters
              </button>
            </div>
            <div className="shop-grid" hidden={shopTab !== "crosshair"}>
              {SHOP_ITEMS.map((item) => {
                const isOwned = owned.includes(item.id);
                const isEq = equipped === item.id;
                const isSelected = selectedItem === item.id;
                return (
                  <button
                    key={item.id}
                    className={`shop-item ${isEq ? "equipped" : isOwned ? "owned" : bank < item.cost ? "locked" : ""} ${isSelected ? "selected" : ""}`}
                    onClick={() => handleItemClick(item.id)}
                  >
                    <span className="shop-swatch">
                      <Crosshair variant={item.style} color={item.color} size={40} />
                    </span>
                    <span className="shop-name">{item.name}</span>
                    <span className="shop-blurb">{item.blurb}</span>
                    <span className="shop-cost">{isEq ? "EQUIPPED" : isOwned ? "OWNED" : `${item.cost} 🎟`}</span>
                  </button>
                );
              })}
            </div>
            {shopTab === "crosshair" && selectedItem && !owned.includes(selectedItem) && (
              <>
                <button
                  className="fair-button shop-purchase"
                  disabled={bank < (SHOP_ITEMS.find((i) => i.id === selectedItem)?.cost ?? 0)}
                  onClick={() => buy(selectedItem)}
                >
                  Purchase {SHOP_ITEMS.find((i) => i.id === selectedItem)?.name} for {SHOP_ITEMS.find((i) => i.id === selectedItem)?.cost} 🎟
                </button>
                {(() => {
                  const cost = SHOP_ITEMS.find((i) => i.id === selectedItem)?.cost ?? 0;
                  const short = cost - bank;
                  if (bank < cost) {
                    return (
                      <p className="shop-purchase-hint">
                        You need {short} more ticket{short === 1 ? "" : "s"} to buy this item.
                      </p>
                    );
                  }
                  return null;
                })()}
              </>
            )}
            <div className="shop-grid" hidden={shopTab !== "gun"}>
              {GUN_ITEMS.map((item) => {
                const isOwned = ownedGuns.includes(item.id);
                const isEq = gun === item.id;
                const isSelected = selectedGun === item.id;
                return (
                  <button
                    key={item.id}
                    className={`shop-item ${isEq ? "equipped" : isOwned ? "owned" : bank < item.cost ? "locked" : ""} ${isSelected ? "selected" : ""}`}
                    onClick={() => handleGunClick(item.id)}
                  >
                    <span className="shop-swatch gun">
                      <GunIcon skin={item} size={72} />
                    </span>
                    <span className="shop-name">{item.name}</span>
                    <span className="shop-blurb">{item.blurb}</span>
                    <span className="shop-cost">{isEq ? "EQUIPPED" : isOwned ? "OWNED" : `${item.cost} 🎟`}</span>
                  </button>
                );
              })}
            </div>
            {shopTab === "gun" && selectedGun && !ownedGuns.includes(selectedGun) && (
              <>
                <button
                  className="fair-button shop-purchase"
                  disabled={bank < (GUN_ITEMS.find((i) => i.id === selectedGun)?.cost ?? 0)}
                  onClick={() => buyGun(selectedGun)}
                >
                  Purchase {GUN_ITEMS.find((i) => i.id === selectedGun)?.name} for {GUN_ITEMS.find((i) => i.id === selectedGun)?.cost} 🎟
                </button>
                {(() => {
                  const cost = GUN_ITEMS.find((i) => i.id === selectedGun)?.cost ?? 0;
                  const short = cost - bank;
                  if (bank < cost) {
                    return (
                      <p className="shop-purchase-hint">
                        You need {short} more ticket{short === 1 ? "" : "s"} to buy this item.
                      </p>
                    );
                  }
                  return null;
                })()}
              </>
            )}
            <button
              className="fair-button shop-watch-ad"
              onClick={watchAdForTickets}
              disabled={adBusy}
            >
              {adBusy ? "Loading ad…" : "Watch Ad — +100 🎟"}
            </button>
            <Link to="/shop" className="fair-button shop-3d-link">
              Open 3D Showroom
            </Link>
            <button className="fair-button" onClick={() => setShowShop(false)}>Close</button>
          </div>
        </div>
      )}

      {/* ---------- instructions popup ---------- */}
      {showLeaderboard && (
        <div
          key="ov-leaderboard"
          className="absolute inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay px-3 py-3 sm:items-center sm:px-4 sm:py-4"
          onClick={() => setShowLeaderboard(false)}
        >
          <div className="overlay-card help-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="fair-title text-[clamp(1.6rem,5vw,2.8rem)]">Leaderboard</h2>
            <p className="fair-sub">
              {globalBoard === null
                ? "Loading global scores…"
                : globalBoard.length
                  ? "Top players worldwide"
                  : "Global scores unavailable here — showing your local board"}
            </p>
            <ul className="shop-board-list">
              {(globalBoard && globalBoard.length
                ? globalBoard
                : board.map((e) => ({ name: e.name, score: e.score }))
              ).map((e, i) => (
                <li key={`${e.name}-${i}`}>
                  <span>
                    {i + 1}. {e.name}
                  </span>
                  <strong>{e.score.toLocaleString()}</strong>
                </li>
              ))}
              {!board.length && globalBoard !== null && !globalBoard.length && (
                <li>
                  <span>No scores yet — play a round!</span>
                </li>
              )}
            </ul>
            <button className="fair-btn mt-4" onClick={() => setShowLeaderboard(false)}>
              Back
            </button>
          </div>
        </div>
      )}

      {showHelp && (
        <div
          key="ov-help"
          className="absolute inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay px-3 py-3 sm:items-center sm:px-4 sm:py-4"
          onClick={() => setShowHelp(false)}
        >
          <div className="overlay-card help-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="fair-title text-[clamp(1.6rem,5vw,2.8rem)]">How to Play</h2>
            <ol className="help-list">
              <li>
                <span className="help-step">1</span>
                <span>
                  {isTouch
                    ? "Press and hold anywhere on the screen — a green laser sight switches on."
                    : "Move your mouse to sweep the crosshair across the stall."}
                </span>
              </li>
              <li>
                <span className="help-step">2</span>
                <span>
                  {isTouch
                    ? "Drag your finger to move the crosshair. Adjust Touch Drag sensitivity in Settings if it feels too fast or slow."
                    : "Line the crosshair up with a toy, gift box or the golden gift."}
                </span>
              </li>
              <li>
                <span className="help-step">3</span>
                <span>{isTouch ? "Lift your finger to fire the blaster." : "Left click to fire the blaster."}</span>
              </li>
              <li>
                <span className="help-step">4</span>
                <span>Chain hits without missing to build your combo multiplier.</span>
              </li>
              <li>
                <span className="help-step">5</span>
                <span>Avoid bombs — they cost 200 points and reset your combo.</span>
              </li>
              <li>
                <span className="help-step">6</span>
                <span>Press ESC any time to pause the round.</span>
              </li>
            </ol>
            <button className="fair-button" onClick={() => setShowHelp(false)}>
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ---------- object instructions popup ---------- */}
      {showInstructions && (
        <div
          key="ov-instructions"
          className="absolute inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay px-3 py-3 sm:items-center sm:px-4 sm:py-4"
          onClick={() => setShowInstructions(false)}
        >
          <div className="overlay-card help-card instructions-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="fair-title text-[clamp(1.6rem,5vw,2.8rem)]">Object Guide</h2>
            <p className="fair-sub">Every target on the shelf and how many points it&apos;s worth.</p>

            <div className="object-grid">
              {[
                {
                  title: "Common Toys",
                  kinds: [
                    "bear", "duck", "car", "cup", "bunny", "ball", "dino", "pig",
                    "penguin", "panda", "soccer", "clown", "plane", "train", "top", "milk", "robot",
                  ] as ToyKind[],
                },
                { title: "Special Prizes", kinds: ["gift", "goldgift", "goldbear", "unicorn"] as ToyKind[] },
                { title: "Power-ups", kinds: ["clock", "star", "spread"] as ToyKind[] },
                { title: "Hazards", kinds: ["bomb", "warning"] as ToyKind[] },
                { title: "Boss", kinds: ["boss"] as ToyKind[] },
              ].map((group) => (
                <div key={group.title} className="object-section">
                  <h3 className="object-section-title">{group.title}</h3>
                  <ul className="object-list">
                    {group.kinds.map((kind) => {
                      const spec = TOY_SPECS[kind];
                      return (
                        <li key={kind} className={`object-row ${spec.points < 0 ? "bad" : ""}`}>
                          <img className="object-thumb" src={asset(`toys/${kind}.png`)} alt={spec.label} loading="lazy" width={36} height={36} />
                          <span className="object-name">{spec.label}</span>
                          <span className="object-pts">
                            {spec.points > 0 ? `+${spec.points}` : spec.points}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            <button className="fair-button" onClick={() => setShowInstructions(false)}>
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ---------- game over ---------- */}
      {state.ending && (
        <div className="outro-veil pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-4">
          <span className="fair-title outro-title text-[clamp(2rem,9vw,4.5rem)]">Time&apos;s Up!</span>
        </div>
      )}

      {state.phase === "over" && (
        <div className="go-overlay absolute inset-0 z-40 flex items-start justify-center overflow-y-auto bg-overlay px-3 py-3 sm:items-center sm:px-4 sm:py-4">
          <div className="overlay-card go-card">
            <h2 className="fair-title go-title text-[clamp(2rem,6vw,3.6rem)]">Round Over!</h2>
            <div className="results">
              <div className="go-step" style={{ ["--go-delay" as string]: "0.5s" }}>
                <span>Score</span>
                <strong>
                  <CountUp value={state.score} delay={600} />
                </strong>
              </div>
              <div className="go-step" style={{ ["--go-delay" as string]: "0.7s" }}>
                <span>Tickets</span>
                <strong className="text-ticket">
                  <CountUp value={state.tickets} delay={800} />
                </strong>
              </div>
              <div className="go-step" style={{ ["--go-delay" as string]: "0.9s" }}>
                <span>Accuracy</span>
                <strong>
                  <CountUp value={accuracy} delay={1000} suffix="%" />
                </strong>
              </div>
              <div className="go-step" style={{ ["--go-delay" as string]: "1.1s" }}>
                <span>Best</span>
                <strong>
                  <CountUp value={state.best} delay={1200} />
                </strong>
              </div>
              <div className="go-step" style={{ ["--go-delay" as string]: "1.3s" }}>
                <span>Bank shots</span>
                <strong>
                  <CountUp value={state.bankShots} delay={1400} />
                </strong>
              </div>
            </div>

            <div className="prizes go-step" style={{ ["--go-delay" as string]: "1.5s" }}>
              <span className="plaque-sub">Prizes unlocked</span>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {state.prizes.length ? (
                  state.prizes.map((p, i) => (
                    <span
                      key={p}
                      className="prize-chip go-step"
                      style={{ ["--go-delay" as string]: `${1.7 + i * 0.12}s` }}
                    >
                      {p}
                    </span>
                  ))
                ) : (
                  <span className="prize-chip opacity-60">No prize yet — try again!</span>
                )}
              </div>
            </div>
            <div className="pause-buttons go-step" style={{ ["--go-delay" as string]: "2.1s" }}>
              {(rewardedAvailable || doubled) && (
                <button
                  className="fair-button"
                  onClick={watchForDoubleTickets}
                  disabled={adBusy || doubled}
                >
                  {doubled
                    ? "Bonus Tickets Added!"
                    : adBusy
                      ? "Loading ad…"
                      : state.tickets > 0
                        ? "Watch Ad — Double Tickets"
                        : "Watch Ad — Bonus Tickets"}
                </button>
              )}

              <button className="fair-button" onClick={beginRound} disabled={adBusy}>
                Play Again
              </button>
              <button className="fair-button alt" onClick={() => gameRef.current?.mainMenu()}>
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ---------- pause menu ---------- */}
      {state.phase === "paused" && (
        <Overlay>
          <h2 className="fair-title text-[clamp(2rem,6vw,3.6rem)]">Paused</h2>
          <p className="fair-sub">Press ESC or Resume to get back to the action.</p>
          <div className="pause-buttons">
            <button className="fair-button" onClick={() => gameRef.current?.resume()}>
              Resume
            </button>
            <button className="fair-button alt" onClick={() => gameRef.current?.mainMenu()}>
              Main Menu
            </button>
            <button className="fair-button alt" onClick={() => setShowSound(true)}>
              Sound Settings
            </button>
            <button className="fair-button alt" onClick={() => gameRef.current?.exit()}>
              Exit Game
            </button>
          </div>
        </Overlay>
      )}

      <SplashScreen />
    </div>

  );
}

function Overlay({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  // every overlay must open at the top, never inherit the previous popup's scroll
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cardRef.current?.scrollTo({ top: 0 });
  }, []);
  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center overflow-y-auto bg-overlay px-3 py-3 sm:items-center sm:px-4 sm:py-4">
      <div ref={cardRef} className={`overlay-card${wide ? " overlay-card-wide" : ""}`}>{children}</div>
    </div>
  );
}
