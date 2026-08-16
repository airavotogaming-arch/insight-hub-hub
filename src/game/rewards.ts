import { secureGet, secureSet, safeInt } from "./secureStore";
import { getMatchesPlayed, getBank, setBank } from "./shop";

/** Games you have to finish to unlock one mystery box. */
export const GAMES_PER_REWARD = 10;

const CLAIMED = "carnival-rewards-claimed";

/** Coins in the box; grows a little with every box you open, capped. */
export const rewardAmount = (claimed: number) => Math.min(2000, 250 + claimed * 150);

export interface RewardState {
  /** total finished matches on record */
  played: number;
  /** boxes already opened */
  claimed: number;
  /** games completed toward the current box (0..GAMES_PER_REWARD) */
  progress: number;
  /** games still needed */
  remaining: number;
  /** the box is full and can be opened */
  ready: boolean;
  /** coins the next box pays out */
  amount: number;
}

const getClaimed = () => safeInt(secureGet<number>(CLAIMED, 0), 9999);

export function getRewardState(): RewardState {
  const played = getMatchesPlayed();
  const claimed = getClaimed();
  const earned = Math.floor(played / GAMES_PER_REWARD);
  const ready = earned > claimed;
  const progress = ready ? GAMES_PER_REWARD : played - claimed * GAMES_PER_REWARD;
  const clamped = Math.max(0, Math.min(GAMES_PER_REWARD, progress));
  return {
    played,
    claimed,
    progress: clamped,
    remaining: Math.max(0, GAMES_PER_REWARD - clamped),
    ready,
    amount: rewardAmount(claimed),
  };
}

/** Opens the box: pays the coins and moves on to the next one. */
export function claimReward(): { ok: boolean; amount: number; bank: number } {
  const state = getRewardState();
  if (!state.ready) return { ok: false, amount: 0, bank: getBank() };
  const bank = getBank() + state.amount;
  setBank(bank);
  secureSet(CLAIMED, state.claimed + 1);
  return { ok: true, amount: state.amount, bank: getBank() };
}
