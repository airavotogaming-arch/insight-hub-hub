import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { GAMES_PER_REWARD, claimReward, getRewardState, type RewardState } from "@/game/rewards";
import { getDailyState, type DailyState } from "@/game/daily";
import { getSpinState } from "@/game/spin";
import { getAchievements, type AchievementRow } from "@/game/achievements";

import JoyBlasterLogo from "@/components/JoyBlasterLogo";
import menuBg from "@/assets/menu-bg.png";
import blasterImg from "@/assets/menu-blaster.png";
import giftImg from "@/assets/menu-gift.png";
import avatarImg from "@/assets/menu-avatar.png";

export interface MainMenuProps {
  best: number;
  bank: number;
  board: { name: string; score: number }[];
  playerName?: string;
  level?: number;
  onPlay: () => void;
  onShop: () => void;
  onHelp: () => void;
  onInstructions: () => void;
  onSettings: () => void;
  onLeaderboard?: () => void;
  /** called after a mystery box is opened, with the new coin balance */
  onRewardClaimed?: (bank: number) => void;
  onTutorial?: (() => void) | undefined;
}

function Bar({ value, max, tone = "gold" }: { value: number; max: number; tone?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <span className={`mm-bar mm-bar-${tone}`}>
      <span className="mm-bar-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

export default function MainMenu({
  best,
  bank,
  board,
  playerName,
  level: levelProp,
  onPlay,
  onShop,
  onHelp,
  onInstructions,
  onSettings,
  onLeaderboard,
  onRewardClaimed,
  onTutorial,
}: MainMenuProps) {
  const [reward, setReward] = useState<RewardState | null>(null);
  const [rewardNote, setRewardNote] = useState("");
  const [dailyReady, setDailyReady] = useState(false);
  const [spinReady, setSpinReady] = useState(false);
  const [missions, setMissions] = useState<AchievementRow[]>([]);
  const [daily, setDaily] = useState<DailyState | null>(null);

  // read progress on mount and whenever the coin balance changes (i.e. after a round)
  useEffect(() => {
    setReward(getRewardState());
    const d = getDailyState();
    setDaily(d);
    setDailyReady(d.canClaim);
    setSpinReady(getSpinState().freeAvailable);
    const rows = getAchievements();
    setMissions(
      [...rows]
        .filter((a) => !a.claimed)
        .sort((a, b) => (b.claimable ? 1 : 0) - (a.claimable ? 1 : 0) || b.pct - a.pct)
        .slice(0, 3),
    );
  }, [bank, best]);


  const openBox = useCallback(() => {
    const res = claimReward();
    if (!res.ok) return;
    setReward(getRewardState());
    setRewardNote(`+${res.amount.toLocaleString()} coins!`);
    onRewardClaimed?.(res.bank);
    window.setTimeout(() => setRewardNote(""), 2600);
  }, [onRewardClaimed]);
  const level = Math.max(1, levelProp ?? Math.floor(best / 5000) + 1);
  const xp = best % 5000;
  const coins = bank;
  const gems = Math.floor(best / 500);
  const tickets = Math.floor(bank / 100);
  const secondBest = board[1]?.score ?? Math.max(0, best - 1032);

  return (
    <div className="mm-root">
      <div className="mm-bg" aria-hidden="true">
        <img className="mm-photo" src={menuBg} alt="" />
        <span className="mm-photo-veil" />
        <span className="mm-curtain left" />
        <span className="mm-curtain right" />
        <span className="mm-glow" />
        <span className="mm-bulbs" />
      </div>

      {/* ---------------- top bar ---------------- */}
      <header className="mm-top">
        <Link to="/profile" className="mm-player" aria-label="Open player profile">
          <img className="mm-avatar" src={avatarImg} alt="Player avatar" width={512} height={512} />
          <div className="mm-player-info">
            <span className="mm-player-name">{(playerName || "PLAYER ONE").toUpperCase()}</span>
            <div className="mm-xp-row">
              <span className="mm-level-badge">{level}</span>
              <Bar value={xp} max={5000} tone="gold" />
              <span className="mm-xp-text">{xp}/5000</span>
            </div>
          </div>
        </Link>

        <div className="mm-resources">
          <div className="mm-res">
            <span className="mm-res-icon coin">🪙</span>
            <strong>{coins.toLocaleString()}</strong>
            <button className="mm-plus" aria-label="Get more coins" onClick={onShop}>
              +
            </button>
          </div>
          <div className="mm-res">
            <span className="mm-res-icon gem">💎</span>
            <strong>{gems.toLocaleString()}</strong>
            <button className="mm-plus" aria-label="Get more gems" onClick={onShop}>
              +
            </button>
          </div>
          <div className="mm-res">
            <span className="mm-res-icon ticket">🎟️</span>
            <strong>{tickets.toLocaleString()}</strong>
            <button className="mm-plus" aria-label="Get more tickets" onClick={onShop}>
              +
            </button>
          </div>
        </div>

        <div className="mm-top-actions">
          <Link to="/daily" className="mm-icon-btn">
            <span className="mm-icon-glyph">🎁</span>
            <span>DAILY GIFT</span>
            {dailyReady && <span className="mm-dot" aria-label="Gift ready" />}
          </Link>
          <Link to="/spin" className="mm-icon-btn">
            <span className="mm-icon-glyph">🎡</span>
            <span>LUCKY SPIN</span>
            {spinReady && <span className="mm-dot" aria-label="Free spin ready" />}
          </Link>
          <button className="mm-icon-btn" onClick={onSettings}>
            <span className="mm-icon-glyph">⚙️</span>
            <span>SETTINGS</span>
          </button>
        </div>

      </header>

      {/* ---------------- body ---------------- */}
      <div className="mm-body">
        <aside className="mm-col mm-left">
          <section className="mm-panel mm-panel-blue">
            <h2 className="mm-panel-title">HIGH SCORE</h2>
            <div className="mm-score-hero">
              <span className="mm-trophy">🏆</span>
              <strong className="mm-score-value">{best.toLocaleString()}</strong>
            </div>
            <span className="mm-panel-label">BEST SCORE</span>
            <strong className="mm-score-sub">{secondBest.toLocaleString()}</strong>
          </section>

          <section className="mm-panel mm-panel-dark">
            <h2 className="mm-ribbon">DAILY CHALLENGE</h2>
            <div className="mm-challenge">
              <div className="mm-challenge-main">
                <span className="mm-challenge-text">
                  {daily?.canClaim ? `Day ${daily.day} gift is ready` : "Gift claimed — come back tomorrow"}
                </span>
                <div className="mm-progress-row">
                  <Bar value={daily?.streak ?? 0} max={7} tone="cyan" />
                  <span className="mm-progress-text">{(daily?.streak ?? 0) % 7}/7</span>
                </div>
              </div>
              <Link to="/daily" className="mm-reward" aria-label="Open daily gift">
                <span className="mm-res-icon coin">🪙</span>
                <span className="mm-reward-x">{(daily?.amount ?? 0).toLocaleString()}</span>
              </Link>
            </div>
          </section>

          <section className="mm-panel mm-panel-blue">
            <h2 className="mm-panel-title">MISSIONS</h2>
            <ul className="mm-missions">
              {missions.length === 0 && (
                <li className="mm-mission">
                  <span className="mm-mission-icon">🏆</span>
                  <div className="mm-mission-body">
                    <span className="mm-mission-label">All badges claimed!</span>
                  </div>
                </li>
              )}
              {missions.map((m) => (
                <li key={m.id} className="mm-mission">
                  <span className="mm-mission-icon">{m.icon}</span>
                  <div className="mm-mission-body">
                    <span className="mm-mission-label">{m.blurb}</span>
                    <div className="mm-progress-row">
                      <Bar value={m.progress} max={m.target} tone="cyan" />
                      <span className="mm-progress-text">
                        {(m.format ?? String)(m.progress)}/{(m.format ?? String)(m.target)}
                      </span>
                    </div>
                  </div>
                  <span className="mm-mission-reward">
                    <span className="mm-res-icon coin">🪙</span>
                    {m.reward.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
            <Link to="/achievements" className="mm-view-all">
              VIEW ALL
            </Link>
          </section>

        </aside>

        {/* ---------------- center ---------------- */}
        <section className="mm-center">
          <div className="mm-logo">
            <JoyBlasterLogo />
          </div>

          <button className="mm-play" onClick={onPlay}>
            <span className="mm-play-lights" aria-hidden="true" />
            <span className="mm-play-text">PLAY NOW</span>
          </button>

          <div className="mm-modes">
            <button className="mm-mode blue" onClick={onPlay}>
              <span>🎯</span> ARCADE MODE
            </button>
            <button className="mm-mode purple" onClick={onPlay}>
              <span>⏱️</span> TIME ATTACK
            </button>
            <button className="mm-mode green" onClick={onPlay}>
              <span>∞</span> ENDLESS MODE
            </button>
          </div>
        </section>

        {/* ---------------- right ---------------- */}
        <aside className="mm-col mm-right">
          <section className="mm-panel mm-panel-red">
            <h2 className="mm-panel-title">
              NEXT REWARD
              <Link to="/rewards" className="mm-panel-more">ALL ›</Link>
            </h2>

            <img
              className={`mm-gift ${reward?.ready ? "is-ready" : ""}`}
              src={giftImg}
              alt="Mystery reward box"
              loading="lazy"
              width={640}
              height={640}
            />
            <div className="mm-progress-row center">
              <Bar value={reward?.progress ?? 0} max={GAMES_PER_REWARD} tone="cyan" />
              <span className="mm-progress-text">
                {reward?.progress ?? 0}/{GAMES_PER_REWARD}
              </span>
            </div>
            {reward?.ready ? (
              <button className="mm-claim" onClick={openBox}>
                OPEN BOX
                <span className="mm-upgrade-cost">
                  <span className="mm-res-icon coin">🪙</span>
                  {reward.amount.toLocaleString()}
                </span>
              </button>
            ) : (
              <span className="mm-panel-note">
                {reward
                  ? `Play ${reward.remaining} more game${reward.remaining === 1 ? "" : "s"} · 🪙${reward.amount.toLocaleString()}`
                  : "Play games to fill the box"}
              </span>
            )}
            {rewardNote && <span className="mm-panel-note mm-reward-note">{rewardNote}</span>}
          </section>

          <section className="mm-panel mm-panel-blue mm-weapon">
            <h2 className="mm-panel-title">CARNIVAL BLASTER</h2>
            <img
              className="mm-blaster"
              src={blasterImg}
              alt="Carnival blaster"
              loading="lazy"
              width={768}
              height={768}
            />
            <span className="mm-power">
              POWER <strong>+40%</strong>
            </span>
            <button className="mm-upgrade" onClick={onShop}>
              UPGRADE
              <span className="mm-upgrade-cost">
                <span className="mm-res-icon coin">🪙</span>2,000
              </span>
            </button>
          </section>
        </aside>
      </div>

      {/* ---------------- bottom nav ---------------- */}
      <nav className="mm-bottom">
        <button className="mm-nav" onClick={onLeaderboard ?? onHelp}>
          <span>🏆</span> LEADERBOARD
        </button>
        <button className="mm-nav" onClick={onShop}>
          <span>🛒</span> PRIZE SHOP
        </button>
        <Link to="/achievements" className="mm-nav">
          <span>🏅</span> ACHIEVEMENTS
        </Link>
        <Link to="/collection" className="mm-nav">
          <span>🎒</span> COLLECTION
        </Link>
        <button className="mm-nav" onClick={onInstructions}>
          <span>📖</span> HOW TO PLAY
        </button>
        <button className="mm-nav" onClick={onTutorial ?? onHelp}>
          <span>🎓</span> TUTORIAL
        </button>
      </nav>


      <p className="mm-credit">made by ujwal guru</p>
    </div>
  );
}
