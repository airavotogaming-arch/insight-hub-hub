import { secureGet, secureSet, safeInt } from "./secureStore";
import {
  getBank,
  setBank,
  getBoard,
  getMaxLevel,
  getMatchesPlayed,
  getOwned,
  getOwnedGuns,
} from "./shop";
import { getRewardState } from "./rewards";
import { getBestStreak } from "./daily";
import { getSpinState } from "./spin";

const CLAIMED = "carnival-achv-claimed";

export interface AchievementDef {
  id: string;
  name: string;
  blurb: string;
  icon: string;
  target: number;
  reward: number;
  /** current progress, read live from saved game state */
  value: () => number;
  /** how the number reads in the UI */
  format?: (n: number) => string;
}

const num = (n: number) => n.toLocaleString();

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-blast", name: "First Blast", blurb: "Finish your first match", icon: "🎯", target: 1, reward: 100, value: getMatchesPlayed },
  { id: "regular", name: "Carnival Regular", blurb: "Finish 10 matches", icon: "🎪", target: 10, reward: 400, value: getMatchesPlayed },
  { id: "veteran", name: "Fairground Veteran", blurb: "Finish 50 matches", icon: "🏟️", target: 50, reward: 1500, value: getMatchesPlayed },
  { id: "sharp", name: "Sharpshooter", blurb: "Score 5,000 in one match", icon: "🔫", target: 5000, reward: 300, value: () => getBoard()[0]?.score ?? 0, format: num },
  { id: "marks", name: "Marksman", blurb: "Score 25,000 in one match", icon: "⭐", target: 25000, reward: 900, value: () => getBoard()[0]?.score ?? 0, format: num },
  { id: "legend", name: "Gallery Legend", blurb: "Score 100,000 in one match", icon: "👑", target: 100000, reward: 3000, value: () => getBoard()[0]?.score ?? 0, format: num },
  { id: "climb-5", name: "Climbing Up", blurb: "Reach level 5", icon: "🪜", target: 5, reward: 350, value: getMaxLevel },
  { id: "climb-15", name: "Top of the Tent", blurb: "Reach level 15", icon: "🎢", target: 15, reward: 1200, value: getMaxLevel },
  { id: "sights", name: "Sight Collector", blurb: "Own 3 crosshairs", icon: "🎯", target: 3, reward: 500, value: () => getOwned().length },
  { id: "armory", name: "Little Armory", blurb: "Own 3 blasters", icon: "🧰", target: 3, reward: 700, value: () => getOwnedGuns().length },
  { id: "banker", name: "Ticket Banker", blurb: "Hold 5,000 coins at once", icon: "🪙", target: 5000, reward: 600, value: getBank, format: num },
  { id: "boxes", name: "Box Breaker", blurb: "Open 3 mystery boxes", icon: "🎁", target: 3, reward: 650, value: () => getRewardState().claimed },
  { id: "streak", name: "Daily Devotee", blurb: "Hit a 3 day gift streak", icon: "📅", target: 3, reward: 800, value: getBestStreak },
  { id: "spinner", name: "Wheel Spinner", blurb: "Spin the lucky wheel 10 times", icon: "🎡", target: 10, reward: 750, value: () => getSpinState().totalSpins },
];

export interface AchievementRow extends AchievementDef {
  progress: number;
  pct: number;
  unlocked: boolean;
  claimed: boolean;
  claimable: boolean;
}

const getClaimedIds = (): string[] => {
  const ids = secureGet<string[]>(CLAIMED, []);
  return Array.isArray(ids) ? ids.filter((i) => typeof i === "string") : [];
};

export function getAchievements(): AchievementRow[] {
  const claimedIds = new Set(getClaimedIds());
  return ACHIEVEMENTS.map((a) => {
    const progress = Math.max(0, safeInt(a.value(), 99_999_999));
    const unlocked = progress >= a.target;
    const claimed = claimedIds.has(a.id);
    return {
      ...a,
      progress: Math.min(progress, a.target),
      pct: Math.min(100, (progress / a.target) * 100),
      unlocked,
      claimed,
      claimable: unlocked && !claimed,
    };
  });
}

export function claimAchievement(id: string): { ok: boolean; reward: number; bank: number } {
  const row = getAchievements().find((a) => a.id === id);
  if (!row || !row.claimable) return { ok: false, reward: 0, bank: getBank() };
  setBank(getBank() + row.reward);
  secureSet(CLAIMED, [...new Set([...getClaimedIds(), id])]);
  return { ok: true, reward: row.reward, bank: getBank() };
}

export function claimAllAchievements(): { count: number; reward: number; bank: number } {
  let count = 0;
  let reward = 0;
  for (const row of getAchievements()) {
    if (!row.claimable) continue;
    const res = claimAchievement(row.id);
    if (res.ok) {
      count += 1;
      reward += row.reward;
    }
  }
  return { count, reward, bank: getBank() };
}
