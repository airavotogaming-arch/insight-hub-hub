import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SPIN_COST, WEDGES, getSpinState, spin, type SpinState } from "@/game/spin";

export const Route = createFileRoute("/spin")({
  head: () => ({
    meta: [
      { title: "Lucky Spin — Toy Blitz Carnival" },
      {
        name: "description",
        content:
          "Spin the Toy Blitz Carnival prize wheel: one free spin every day, extra spins for coins, and a 2,500 coin jackpot wedge.",
      },
      { property: "og:title", content: "Lucky Spin — Toy Blitz Carnival" },
      {
        property: "og:description",
        content: "Take your free daily spin on the carnival wheel and win coins for the prize shop.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SpinPage,
});

const SEG = 360 / WEDGES.length;

const countdown = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
};

const wheelGradient = `conic-gradient(${WEDGES.map(
  (w, i) => `${w.color} ${i * SEG}deg ${(i + 1) * SEG}deg`,
).join(", ")})`;

function SpinPage() {
  const [state, setState] = useState<SpinState | null>(null);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [note, setNote] = useState("");
  const timers = useRef<number[]>([]);

  const refresh = () => setState(getSpinState());

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 1000);
    timers.current.push(id);
    const t = timers.current;
    return () => t.forEach((x) => window.clearInterval(x));
  }, []);

  const doSpin = () => {
    if (spinning) return;
    const res = spin();
    if (!res.ok) {
      setNote(`Not enough coins — a spin costs ${SPIN_COST.toLocaleString()}.`);
      window.setTimeout(() => setNote(""), 2600);
      return;
    }
    setSpinning(true);
    setNote("");
    // land the pointer (top, 0deg) in the middle of the winning wedge
    const target = 360 * 6 - (res.index * SEG + SEG / 2);
    setAngle((a) => a + (target - (a % 360) + 360) % 360 + 360 * 5);
    window.setTimeout(() => {
      setSpinning(false);
      refresh();
      setNote(
        `${res.usedFree ? "Free spin" : `-${SPIN_COST.toLocaleString()} coins`} → +${res.coins.toLocaleString()} coins!`,
      );
    }, 4200);
  };

  const free = state?.freeAvailable ?? false;

  return (
    <main className="pf-root">
      <div className="pf-card">
        <Link to="/" className="pf-back">← BACK TO MENU</Link>

        <h1 className="pg-title">🎡 LUCKY SPIN</h1>

        <div className="pf-stats">
          <div className="pf-stat">
            <strong>{state?.totalSpins ?? 0}</strong>
            <span>SPINS</span>
          </div>
          <div className="pf-stat">
            <strong>{(state?.totalWon ?? 0).toLocaleString()}</strong>
            <span>WON</span>
          </div>
          <div className="pf-stat">
            <strong>{(state?.bank ?? 0).toLocaleString()}</strong>
            <span>COINS</span>
          </div>
        </div>

        <div className="pg-wheel-wrap">
          <span className="pg-wheel-pin" aria-hidden="true">▼</span>
          <div
            className="pg-wheel"
            style={{
              background: wheelGradient,
              transform: `rotate(${angle}deg)`,
              transition: spinning ? "transform 4s cubic-bezier(0.12, 0.72, 0.06, 1)" : "none",
            }}
          >
            {WEDGES.map((w, i) => (
              <span
                key={w.label + i}
                className="pg-wedge-label"
                style={{ transform: `rotate(${i * SEG + SEG / 2}deg) translateY(-78px)` }}
              >
                {w.label}
              </span>
            ))}
          </div>
          <span className="pg-wheel-hub" aria-hidden="true">🎯</span>
        </div>

        <button className="pf-share" onClick={doSpin} disabled={spinning}>
          <span>🎡</span>{" "}
          {spinning
            ? "SPINNING…"
            : free
              ? "FREE SPIN"
              : `SPIN · 🪙 ${SPIN_COST.toLocaleString()}`}
        </button>
        {!free && !spinning && (
          <p className="pf-note">Free spin resets in {countdown(state?.msUntilFree ?? 0)}</p>
        )}
        {note && <p className="pf-note">{note}</p>}

        <div className="pg-links">
          <Link to="/daily" className="pg-link">🎁 DAILY GIFT</Link>
          <Link to="/rewards" className="pg-link">📦 NEXT REWARD</Link>
        </div>
      </div>
    </main>
  );
}
