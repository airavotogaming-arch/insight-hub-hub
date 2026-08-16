/**
 * Ad frequency configuration.
 *
 * Tweak these values to control how often ads appear. All timings are the
 * single source of truth for the game's ad pacing — nothing else hardcodes
 * frequency numbers.
 *
 * Overrides can also be set at runtime (e.g. from the console or a build-time
 * bootstrap) with `setAdConfig({ interstitialEveryNRounds: 3 })`.
 */
export type AdConfig = {
  /** Master switch for interstitials. */
  interstitialsEnabled: boolean;
  /** How many rounds must be played before the first interstitial can show. */
  interstitialAfterRounds: number;
  /** Show an interstitial once every N rounds (1 = every round). */
  interstitialEveryNRounds: number;
  /** Minimum seconds between two interstitials, regardless of round count. */
  interstitialCooldownSeconds: number;

  /** Master switch for the rewarded "double tickets" offer. */
  rewardedEnabled: boolean;
  /** Minimum seconds between two rewarded ads. */
  rewardedCooldownSeconds: number;
};

/** Game modes, keyed by round length in seconds. */
export type GameMode = 60 | 120 | 180;

export const DEFAULT_AD_CONFIG: AdConfig = {
  interstitialsEnabled: true,
  // Portals (and their QA tools) expect an interstitial early in the session,
  // so the first one plays before the very first round.
  interstitialAfterRounds: 0,
  interstitialEveryNRounds: 2,
  interstitialCooldownSeconds: 45,

  rewardedEnabled: true,
  rewardedCooldownSeconds: 0,
};

/**
 * Per-mode overrides, merged on top of the base config.
 * Short rounds finish faster, so Blitz gets a longer gap between ads.
 */
export const DEFAULT_MODE_AD_CONFIG: Record<GameMode, Partial<AdConfig>> = {
  // Blitz (60s): rounds are quick — ad less often per round, longer cooldown.
  60: {
    interstitialAfterRounds: 0,
    interstitialEveryNRounds: 3,
    interstitialCooldownSeconds: 60,
  },
  // 2 min: baseline pacing.
  120: {},
  // 3 min: long rounds — ads can come a bit sooner.
  180: {
    interstitialAfterRounds: 0,
    interstitialEveryNRounds: 2,
    interstitialCooldownSeconds: 45,
  },
};


let config: AdConfig = { ...DEFAULT_AD_CONFIG };
let modeConfig: Record<GameMode, Partial<AdConfig>> = {
  60: { ...DEFAULT_MODE_AD_CONFIG[60] },
  120: { ...DEFAULT_MODE_AD_CONFIG[120] },
  180: { ...DEFAULT_MODE_AD_CONFIG[180] },
};

function isGameMode(mode: number | undefined): mode is GameMode {
  return mode === 60 || mode === 120 || mode === 180;
}

/** Effective config for a mode (base config + that mode's overrides). */
export function getAdConfig(mode?: number): AdConfig {
  if (!isGameMode(mode)) return config;
  return { ...config, ...modeConfig[mode] };
}

/** Merge partial overrides into the base config (applies to every mode). */
export function setAdConfig(overrides: Partial<AdConfig>): AdConfig {
  config = { ...config, ...overrides };
  return config;
}

/** Merge partial overrides into a single mode's config. */
export function setModeAdConfig(mode: GameMode, overrides: Partial<AdConfig>) {
  modeConfig = { ...modeConfig, [mode]: { ...modeConfig[mode], ...overrides } };
  return getAdConfig(mode);
}


/* ------------------------------------------------------------------ *
 * Test mode: simulates ads locally (fake overlay + timing logs) so ad
 * pacing can be verified without any real platform ad calls.
 * ------------------------------------------------------------------ */
const TEST_MODE_KEY = "carnival-ad-test";

let testMode = (() => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TEST_MODE_KEY) === "1";
  } catch {
    return false;
  }
})();

export function isAdTestMode() {
  return testMode;
}

export function setAdTestMode(on: boolean) {
  testMode = on;
  try {
    window.localStorage.setItem(TEST_MODE_KEY, on ? "1" : "0");
  } catch {
    /* noop */
  }
  return testMode;
}

/** How long simulated ads stay on screen, in ms. */
export const TEST_AD_DURATION = {
  interstitial: 3000,
  rewarded: 5000,
} as const;


let lastInterstitialAt = 0;
let lastRewardedAt = 0;

/**
 * Decides whether an interstitial should play before the next round.
 * @param roundsPlayed rounds already completed in this mode this session
 * @param mode round length in seconds (60 | 120 | 180)
 */
export function shouldShowInterstitial(roundsPlayed: number, mode?: number): boolean {
  const c = getAdConfig(mode);
  if (!c.interstitialsEnabled) return false;
  if (roundsPlayed < c.interstitialAfterRounds) return false;

  const every = Math.max(1, c.interstitialEveryNRounds);
  const sinceFirst = roundsPlayed - c.interstitialAfterRounds;
  if (sinceFirst % every !== 0) return false;

  const elapsed = (Date.now() - lastInterstitialAt) / 1000;
  if (lastInterstitialAt && elapsed < c.interstitialCooldownSeconds) return false;

  return true;
}

export function markInterstitialShown() {
  lastInterstitialAt = Date.now();
}

export function canShowRewarded(mode?: number): boolean {
  const c = getAdConfig(mode);
  if (!c.rewardedEnabled) return false;
  const elapsed = (Date.now() - lastRewardedAt) / 1000;
  if (lastRewardedAt && elapsed < c.rewardedCooldownSeconds) return false;
  return true;
}


export function markRewardedShown() {
  lastRewardedAt = Date.now();
}
