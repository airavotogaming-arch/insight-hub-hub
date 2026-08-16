import { secureGet, secureSet, safeInt } from "./secureStore";
import { getBank, setBank } from "./shop";

/** Local calendar day key, e.g. "2026-08-16". */
export const dayKey = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Whole days between two day keys (b - a). */
export const daysBetween = (a: string, b: string): number => {
  const pa = Date.parse(`${a}T00:00:00`);
  const pb = Date.parse(`${b}T00:00:00`);
  if (!Number.isFinite(pa) || !Number.isFinite(pb)) return 99;
  return Math.round((pb - pa) / 86_400_000);
};

const LAST = "carnival-daily-last";
const STREAK = "carnival-daily-streak";
const BEST_STREAK = "carnival-daily-best-streak";

/** Seven day ladder — day 7 is the big one, then it loops. */
export const DAILY_LADDER = [150, 250, 400, 600, 850, 1200, 2000];

export interface DailyState {
  /** 1..7 — the day slot that can be claimed right now */
  day: number;
  /** current consecutive-day streak (already claimed days) */
  streak: number;
  bestStreak: number;
  /** the gift for the claimable slot */
  amount: number;
  canClaim: boolean;
  /** last claimed day key, "" if never */
  lastClaim: string;
  /** ms until the next gift unlocks (0 when claimable) */
  msUntilNext: number;
}

const getStreak = () => safeInt(secureGet<number>(STREAK, 0), 9999);
const getLast = () => {
  const v = secureGet<string>(LAST, "");
  return typeof v === "string" ? v : "";
};

export function getDailyState(): DailyState {
  const today = dayKey();
  const last = getLast();
  const stored = getStreak();
  const gap = last ? daysBetween(last, today) : 99;

  // gap 0 -> already claimed today; gap 1 -> streak continues; more -> reset
  const streak = !last || gap > 1 ? 0 : stored;
  const canClaim = gap !== 0;
  const day = (streak % DAILY_LADDER.length) + 1;
  const amount = DAILY_LADDER[day - 1] ?? DAILY_LADDER[0]!;

  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);

  return {
    day,
    streak,
    bestStreak: safeInt(secureGet<number>(BEST_STREAK, 0), 9999),
    amount,
    canClaim,
    lastClaim: last,
    msUntilNext: canClaim ? 0 : Math.max(0, midnight.getTime() - Date.now()),
  };
}

export function claimDaily(): { ok: boolean; amount: number; bank: number; streak: number } {
  const state = getDailyState();
  if (!state.canClaim) return { ok: false, amount: 0, bank: getBank(), streak: state.streak };
  const bank = getBank() + state.amount;
  setBank(bank);
  const streak = state.streak + 1;
  secureSet(STREAK, streak);
  secureSet(LAST, dayKey());
  if (streak > state.bestStreak) secureSet(BEST_STREAK, streak);
  return { ok: true, amount: state.amount, bank: getBank(), streak };
}

export const getBestStreak = () => safeInt(secureGet<number>(BEST_STREAK, 0), 9999);
