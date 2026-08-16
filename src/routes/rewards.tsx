import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import giftImg from "@/assets/menu-gift.png";
import { GAMES_PER_REWARD, claimReward, getRewardState, rewardAmount, type RewardState } from "@/game/rewards";
import { getBank, getHistory, type MatchEntry } from "@/game/shop";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Next Reward — Toy Blitz Carnival" },
      {
        name: "description",
        content:
          "Watch your Toy Blitz Carnival mystery box fill up: every 10 finished matches unlocks a bigger coin payout, up to 2,000 coins.",
      },
      { property: "og:title", content: "Next Reward — Toy Blitz Carnival" },
      {
        property: "og:description",
        content: "Every 10 matches fills a mystery box. Open it for coins and start the next one.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RewardsPage,
});

function RewardsPage() {
  const [state, setState] = useState<RewardState | null>(null);
  const [bank, setBankState] = useState(0);
  const [history, setHistory] = useState<MatchEntry[]>([]);
  const [note, setNote] = useState("");
  const [opening, setOpening] = useState(false);

  const refresh = () => {
    setState(getRewardState());
    setBankState(getBank());
    setHistory(getHistory());
  };

  useEffect(refresh, []);

  const open = () => {
    const res = claimReward();
    if (!res.ok) return;
    setOpening(true);
    refresh();
    setNote(`Box opened — +${res.amount.toLocaleString()} coins!`);
    window.setTimeout(() => setOpening(false), 800);
    window.setTimeout(() => setNote(""), 3000);
  };

  const pct = ((state?.progress ?? 0) / GAMES_PER_REWARD) * 100;
  const upcoming = [0, 1, 2].map((i) => ({
    box: (state?.claimed ?? 0) + i + 1,
    amount: rewardAmount((state?.claimed ?? 0) + i),
  }));

  return (
    <main className="pf-root">
      <div className="pf-card">
        <Link to="/" className="pf-back">← BACK TO MENU</Link>

        <h1 className="pg-title">📦 NEXT REWARD</h1>

        <div className="pf-stats">
          <div className="pf-stat">
            <strong>{state?.played ?? 0}</strong>
            <span>MATCHES</span>
          </div>
          <div className="pf-stat">
            <strong>{state?.claimed ?? 0}</strong>
            <span>BOXES OPENED</span>
          </div>
          <div className="pf-stat">
            <strong>{bank.toLocaleString()}</strong>
            <span>COINS</span>
          </div>
        </div>

        <div className="pg-box">
          <img
            className={`pg-box-img ${state?.ready ? "is-ready" : ""} ${opening ? "pg-pop" : ""}`}
            src={giftImg}
            alt="Mystery reward box"
            width={640}
            height={640}
            loading="lazy"
          />
          <div className="pg-bar big">
            <span className="pg-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="pg-box-prog">
            {state?.progress ?? 0} / {GAMES_PER_REWARD} matches
          </span>
        </div>

        {state?.ready ? (
          <button className="pf-share" onClick={open}>
            <span>🎁</span> OPEN BOX · 🪙 {state.amount.toLocaleString()}
          </button>
        ) : (
          <button className="pf-share" disabled>
            <span>🔒</span> {state?.remaining ?? GAMES_PER_REWARD} MORE MATCH
            {(state?.remaining ?? 2) === 1 ? "" : "ES"}
          </button>
        )}
        {note && <p className="pf-note">{note}</p>}

        <h2 className="pf-h2">UPCOMING BOXES</h2>
        <ul className="pf-board">
          {upcoming.map((u) => (
            <li key={u.box}>
              <span>📦 Box #{u.box}</span>
              <strong>🪙 {u.amount.toLocaleString()}</strong>
            </li>
          ))}
        </ul>

        <h2 className="pf-h2">RECENT MATCHES</h2>
        <ul className="pf-board">
          {history.length === 0 && <li className="pf-empty">No matches yet — play a round!</li>}
          {history.slice(0, 5).map((e, i) => (
            <li key={`${e.at}-${i}`}>
              <span className="pf-lvl">LVL {e.level}</span>
              <strong>{e.score.toLocaleString()}</strong>
            </li>
          ))}
        </ul>

        <div className="pg-links">
          <Link to="/daily" className="pg-link">🎁 DAILY GIFT</Link>
          <Link to="/spin" className="pg-link">🎡 LUCKY SPIN</Link>
        </div>
      </div>
    </main>
  );
}
