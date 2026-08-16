import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DAILY_LADDER, claimDaily, getDailyState, type DailyState } from "@/game/daily";
import { getBank } from "@/game/shop";

export const Route = createFileRoute("/daily")({
  head: () => ({
    meta: [
      { title: "Daily Gift — Toy Blitz Carnival" },
      {
        name: "description",
        content:
          "Claim your free Toy Blitz Carnival daily gift, build a 7 day streak and bank up to 2,000 coins for the prize shop.",
      },
      { property: "og:title", content: "Daily Gift — Toy Blitz Carnival" },
      {
        property: "og:description",
        content: "A free coin gift every day — keep the streak alive for the day 7 jackpot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DailyPage,
});

const countdown = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
};

function DailyPage() {
  const [state, setState] = useState<DailyState | null>(null);
  const [bank, setBankState] = useState(0);
  const [note, setNote] = useState("");
  const [popping, setPopping] = useState(false);

  const refresh = () => {
    setState(getDailyState());
    setBankState(getBank());
  };

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 1000);
    return () => window.clearInterval(id);
  }, []);

  const claim = () => {
    const res = claimDaily();
    if (!res.ok) return;
    setPopping(true);
    refresh();
    setNote(`+${res.amount.toLocaleString()} coins · ${res.streak} day streak!`);
    window.setTimeout(() => setPopping(false), 700);
    window.setTimeout(() => setNote(""), 3000);
  };

  const day = state?.day ?? 1;

  return (
    <main className="pf-root">
      <div className="pf-card">
        <Link to="/" className="pf-back">← BACK TO MENU</Link>

        <h1 className="pg-title">🎁 DAILY GIFT</h1>

        <div className="pf-stats">
          <div className="pf-stat">
            <strong>{state?.streak ?? 0}</strong>
            <span>STREAK</span>
          </div>
          <div className="pf-stat">
            <strong>{state?.bestStreak ?? 0}</strong>
            <span>BEST</span>
          </div>
          <div className="pf-stat">
            <strong>{bank.toLocaleString()}</strong>
            <span>COINS</span>
          </div>
        </div>

        <div className="pg-ladder">
          {DAILY_LADDER.map((amount, i) => {
            const slot = i + 1;
            const done = slot < day;
            const active = slot === day;
            return (
              <div
                key={slot}
                className={`pg-day ${done ? "is-done" : ""} ${active ? "is-active" : ""} ${slot === 7 ? "is-big" : ""}`}
              >
                <span className="pg-day-label">DAY {slot}</span>
                <span className="pg-day-icon">{done ? "✅" : slot === 7 ? "🏆" : "🎁"}</span>
                <span className="pg-day-amount">🪙 {amount.toLocaleString()}</span>
              </div>
            );
          })}
        </div>

        {state?.canClaim ? (
          <button className={`pf-share ${popping ? "pg-pop" : ""}`} onClick={claim}>
            <span>🎁</span> OPEN DAY {day} GIFT · 🪙 {(state.amount ?? 0).toLocaleString()}
          </button>
        ) : (
          <button className="pf-share" disabled>
            <span>⏳</span> NEXT GIFT IN {countdown(state?.msUntilNext ?? 0)}
          </button>
        )}
        {note && <p className="pf-note">{note}</p>}

        <p className="pf-note">
          Come back every day to climb the ladder. Miss a day and the streak restarts at day 1.
        </p>

        <div className="pg-links">
          <Link to="/spin" className="pg-link">🎡 LUCKY SPIN</Link>
          <Link to="/rewards" className="pg-link">🎁 NEXT REWARD</Link>
        </div>
      </div>
    </main>
  );
}
