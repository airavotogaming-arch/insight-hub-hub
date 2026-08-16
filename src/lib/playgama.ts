/**
 * Playgama Bridge integration.
 * Docs: https://wiki.playgama.com/playgama/for-developers/bridge
 *
 * Everything here is browser-only and fails soft: if the SDK is missing
 * (local dev, direct web hosting), each helper resolves to a safe no-op so the
 * game keeps working exactly as before.
 */

import { isAdTestMode, TEST_AD_DURATION } from "./adConfig";

const SDK_URL = "https://bridge.playgama.com/v2/stable/playgama-bridge.js";

/**
 * Renders a fake full-screen ad placeholder and resolves when it closes.
 * Used only in ad test mode — no platform calls are made.
 */
function simulateAd(kind: "interstitial" | "rewarded"): Promise<void> {
  return new Promise((resolve) => {
    const ms = TEST_AD_DURATION[kind];
    const startedAt = Date.now();
    console.info(`[ad-test] ${kind} opened (${ms}ms simulated)`);

    const el = document.createElement("div");
    el.setAttribute("data-ad-test", kind);
    el.style.cssText =
      "position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;" +
      "align-items:center;justify-content:center;gap:12px;background:rgba(8,6,20,.94);" +
      "color:#fff;font:600 18px/1.4 system-ui,sans-serif;text-align:center;padding:24px";

    const title = document.createElement("div");
    title.textContent = `TEST AD — ${kind.toUpperCase()}`;
    title.style.cssText = "letter-spacing:.12em;font-size:22px";

    const note = document.createElement("div");
    note.style.cssText = "opacity:.7;font-size:14px;font-weight:400";
    note.textContent = "Simulated — no real ad request";

    const countdown = document.createElement("div");
    countdown.style.cssText = "font-size:40px;font-variant-numeric:tabular-nums";

    el.append(title, countdown, note);
    document.body.appendChild(el);

    const tick = () => {
      const left = Math.max(0, ms - (Date.now() - startedAt));
      countdown.textContent = (left / 1000).toFixed(1) + "s";
    };
    tick();
    const timer = setInterval(tick, 100);

    setTimeout(() => {
      clearInterval(timer);
      el.remove();
      console.info(`[ad-test] ${kind} closed after ${Date.now() - startedAt}ms`);
      resolve();
    }, ms);
  });
}


type BridgeState = "loading" | "opened" | "closed" | "failed" | "rewarded";

export type LeaderboardEntry = { name: string; score: number; rank?: number };

type PlaygamaBridge = {
  initialize: () => Promise<void>;
  platform: {
    sendMessage: (message: string) => void;
  };
  player?: {
    id?: string | null;
    name?: string | null;
    isAuthorized?: boolean;
    authorize?: () => Promise<void>;
  };
  leaderboard?: {
    setScore: (options: Record<string, unknown>) => Promise<void>;
    getEntries: (options?: Record<string, unknown>) => Promise<unknown>;
  };
  advertisement: {
    interstitialState?: BridgeState;
    rewardedState?: BridgeState;
    showInterstitial: () => void;
    showRewarded: () => void;
    on: (event: string, cb: (state: BridgeState) => void) => () => void;
  };
};


declare global {
  interface Window {
    bridge?: PlaygamaBridge;
  }
}

const PLATFORM_MESSAGE = {
  GAME_READY: "game_ready",
  IN_GAME_LOADING_STARTED: "in_game_loading_started",
  IN_GAME_LOADING_STOPPED: "in_game_loading_stopped",
  GAMEPLAY_STARTED: "gameplay_started",
  GAMEPLAY_STOPPED: "gameplay_stopped",
  PLAYER_GOT_ACHIEVEMENT: "player_got_achievement",
} as const;

const EVENT = {
  INTERSTITIAL_STATE_CHANGED: "interstitial_state_changed",
  REWARDED_STATE_CHANGED: "rewarded_state_changed",
} as const;

let readyPromise: Promise<PlaygamaBridge | null> | null = null;

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.bridge) {
      resolve();
      return;
    }
    // The tag is already in index.html (platform requirement) — it may still be loading.
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    const el = existing ?? document.createElement("script");
    el.addEventListener("load", () => resolve(), { once: true });
    el.addEventListener("error", () => reject(new Error("Playgama Bridge failed to load")), {
      once: true,
    });
    if (!existing) {
      el.src = SDK_URL;
      el.async = false;
      document.head.appendChild(el);
    }
  });
}

/** Loads + initializes the bridge once. Resolves null when unavailable. */
export function initPlaygama(): Promise<PlaygamaBridge | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    try {
      await loadScript();
      const bridge = window.bridge;
      if (!bridge) return null;
      await bridge.initialize();
      bridge.platform.sendMessage(PLATFORM_MESSAGE.IN_GAME_LOADING_STARTED);
      return bridge;
    } catch (err) {
      console.warn("[playgama]", err);
      return null;
    }
  })();

  return readyPromise;
}

async function bridgeOrNull() {
  // Always make sure the bridge is initialized before any ad call: the
  // platform only intercepts ads issued through an initialized bridge.
  return initPlaygama();
}

function send(message: string) {
  void bridgeOrNull().then((b) => {
    try {
      b?.platform.sendMessage(message);
    } catch (err) {
      console.warn("[playgama]", err);
    }
  });
}

/** Call once the game is playable (menu visible, assets ready). */
export function playgamaGameReady() {
  send(PLATFORM_MESSAGE.IN_GAME_LOADING_STOPPED);
  send(PLATFORM_MESSAGE.GAME_READY);
}

export function playgamaGameplayStart() {
  send(PLATFORM_MESSAGE.GAMEPLAY_STARTED);
}

export function playgamaGameplayStop() {
  send(PLATFORM_MESSAGE.GAMEPLAY_STOPPED);
}

function waitForAd(
  bridge: PlaygamaBridge,
  event: string,
  trigger: () => void,
  finalStates: BridgeState[],
): Promise<BridgeState> {
  return new Promise((resolve) => {
    let done = false;
    let off: (() => void) | undefined;
    const finish = (state: BridgeState) => {
      if (done) return;
      done = true;
      try {
        off?.();
      } catch {
        /* noop */
      }
      clearTimeout(guard);
      resolve(state);
    };
    // safety net: never block the game if the platform goes silent
    const guard = setTimeout(() => finish("failed"), 30000);
    try {
      off = bridge.advertisement.on(event, (state) => {
        if (finalStates.includes(state)) finish(state);
      });
      trigger();
    } catch (err) {
      console.warn("[playgama]", err);
      finish("failed");
    }
  });
}

/** Shows an interstitial (between rounds). Always resolves. */
export async function showInterstitial(): Promise<void> {
  if (isAdTestMode()) {
    await simulateAd("interstitial");
    return;
  }
  const bridge = await bridgeOrNull();
  if (!bridge) {
    console.warn("[playgama] interstitial requested but bridge unavailable");
    return;
  }
  console.info("[playgama] showInterstitial()");
  await waitForAd(
    bridge,
    EVENT.INTERSTITIAL_STATE_CHANGED,
    () => bridge.advertisement.showInterstitial(),
    ["closed", "failed"],
  );
}

/** Shows a rewarded ad. Resolves true only when the reward was granted. */
export async function showRewarded(): Promise<boolean> {
  if (isAdTestMode()) {
    await simulateAd("rewarded");
    return true;
  }
  const bridge = await bridgeOrNull();
  if (!bridge) {
    console.warn("[playgama] rewarded requested but bridge unavailable");
    return false;
  }
  console.info("[playgama] showRewarded()");


  return new Promise<boolean>((resolve) => {
    let rewarded = false;
    let done = false;
    let off: (() => void) | undefined;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        off?.();
      } catch {
        /* noop */
      }
      clearTimeout(guard);
      resolve(rewarded);
    };
    const guard = setTimeout(finish, 60000);
    try {
      off = bridge.advertisement.on(EVENT.REWARDED_STATE_CHANGED, (state) => {
        if (state === "rewarded") rewarded = true;
        if (state === "closed" || state === "failed") finish();
      });
      bridge.advertisement.showRewarded();
    } catch (err) {
      console.warn("[playgama]", err);
      finish();
    }
  });
}

/** True when running inside a Playgama platform frame. */
export async function isPlaygamaAvailable() {
  return (await bridgeOrNull()) !== null;
}

/* ------------------------------------------------------------------ *
 * Leaderboard (Playgama game id: see public/playgama-bridge-config.json)
 * ------------------------------------------------------------------ */

/** Playgama game identifier — also mirrored in the bridge config file. */
export const PLAYGAMA_GAME_ID = "cmslvqbxl02tllj0icmpadmpz";

const LEADERBOARD_ID = "score";

/** Name the platform knows the player by, when it exposes one. */
export async function playgamaPlayerName(): Promise<string | null> {
  const bridge = await bridgeOrNull();
  const name = bridge?.player?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

/** Publishes a score to the platform leaderboard. Never throws. */
export async function playgamaSubmitScore(score: number, name?: string): Promise<boolean> {
  const bridge = await bridgeOrNull();
  if (!bridge?.leaderboard) return false;
  try {
    await bridge.leaderboard.setScore({
      gameId: PLAYGAMA_GAME_ID,
      leaderboardId: LEADERBOARD_ID,
      score: Math.max(0, Math.round(score)),
      ...(name ? { name } : {}),
    });
    return true;
  } catch (err) {
    console.warn("[playgama] setScore", err);
    return false;
  }
}

function normalizeEntries(raw: unknown): LeaderboardEntry[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { entries?: unknown })?.entries)
      ? ((raw as { entries: unknown[] }).entries)
      : [];
  return list
    .map((item) => {
      const e = item as Record<string, unknown>;
      const name =
        (typeof e['name'] === "string" && e['name']) ||
        (typeof e['playerName'] === "string" && e['playerName']) ||
        (typeof e['id'] === "string" && e['id']) ||
        "Player";
      const score = Number(e['score'] ?? e['value'] ?? 0);
      const rank = Number(e['rank'] ?? NaN);
      return {
        name: String(name),
        score: Number.isFinite(score) ? score : 0,
        ...(Number.isFinite(rank) ? { rank } : {}),
      } as LeaderboardEntry;
    })
    .sort((a, b) => b.score - a.score);
}

/** Reads the platform leaderboard. Returns [] when unavailable. */
export async function playgamaLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const bridge = await bridgeOrNull();
  if (!bridge?.leaderboard) return [];
  try {
    const raw = await bridge.leaderboard.getEntries({
      gameId: PLAYGAMA_GAME_ID,
      leaderboardId: LEADERBOARD_ID,
      quantityTop: limit,
    });
    return normalizeEntries(raw).slice(0, limit);
  } catch (err) {
    console.warn("[playgama] getEntries", err);
    return [];
  }
}
