import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { GAMES_PER_REWARD, claimReward, getRewardState, type RewardState } from "@/game/rewards";
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

  // read progress on mount and whenever the coin balance changes (i.e. after a round)
  useEffect(() => {
    setReward(getRewardState());
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
                <span className="mm-challenge-text">Break 50 Toys</span>
                <div className="mm-progress-row">
                  <Bar value={32} max={50} tone="cyan" />
                  <span className="mm-progress-text">32/50</span>
                </div>
              </div>
              <div className="mm-reward">
                <span className="mm-res-icon gem">💎</span>
                <span className="mm-reward-x">x10</span>
              </div>
            </div>
          </section>

          <section className="mm-panel mm-panel-blue">
            <h2 className="mm-panel-title">MISSIONS</h2>
            <ul className="mm-missions">
              {[
                { icon: "⭐", label: "Play 3 Games", v: 2, m: 3, txt: "2/3" },
                { icon: "🔥", label: "Get 5 Combos", v: 3, m: 5, txt: "3/5" },
                { icon: "🎯", label: "Score 20000 Points", v: 15000, m: 20000, txt: "15000/20000" },
              ].map((m) => (
                <li key={m.label} className="mm-mission">
                  <span className="mm-mission-icon">{m.icon}</span>
                  <div className="mm-mission-body">
                    <span className="mm-mission-label">{m.label}</span>
                    <div className="mm-progress-row">
                      <Bar value={m.v} max={m.m} tone="cyan" />
                      <span className="mm-progress-text">{m.txt}</span>
                    </div>
                  </div>
                  <span className="mm-mission-reward">
                    <span className="mm-res-icon coin">🪙</span>500
                  </span>
                </li>
              ))}
            </ul>
            <button className="mm-view-all" onClick={onInstructions}>
              VIEW ALL
            </button>
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
