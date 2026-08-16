import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  claimAchievement,
  claimAllAchievements,
  getAchievements,
  type AchievementRow,
} from "@/game/achievements";
import { getBank } from "@/game/shop";

export const Route = createFileRoute("/achievements")({
  head: () => ({
    meta: [
      { title: "Achievements — Toy Blitz Carnival" },
      {
        name: "description",
        content:
          "Track every Toy Blitz Carnival achievement: matches played, high scores, levels reached and collections — then claim coin rewards.",
      },
      { property: "og:title", content: "Achievements — Toy Blitz Carnival" },
      {
        property: "og:description",
        content: "Unlock carnival badges for scores, levels and collections, and cash them in for coins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AchievementsPage,
});

function AchievementsPage() {
  const [rows, setRows] = useState<AchievementRow[]>([]);
  const [bank, setBankState] = useState(0);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<"all" | "ready" | "locked" | "claimed">("all");

  const refresh = () => {
    setRows(getAchievements());
    setBankState(getBank());
  };

  useEffect(refresh, []);

  const claim = (id: string) => {
    const res = claimAchievement(id);
    if (!res.ok) return;
    refresh();
    setNote(`+${res.reward.toLocaleString()} coins claimed!`);
    window.setTimeout(() => setNote(""), 2600);
  };

  const claimAll = () => {
    const res = claimAllAchievements();
    if (!res.count) return;
    refresh();
    setNote(`${res.count} badge${res.count === 1 ? "" : "s"} claimed · +${res.reward.toLocaleString()} coins`);
    window.setTimeout(() => setNote(""), 3000);
  };

  const unlocked = rows.filter((r) => r.unlocked).length;
  const readyCount = rows.filter((r) => r.claimable).length;

  const visible = useMemo(() => {
    if (filter === "ready") return rows.filter((r) => r.claimable);
    if (filter === "locked") return rows.filter((r) => !r.unlocked);
    if (filter === "claimed") return rows.filter((r) => r.claimed);
    return rows;
  }, [rows, filter]);

  return (
    <main className="pf-root">
      <div className="pf-card pg-wide">
        <Link to="/" className="pf-back">← BACK TO MENU</Link>

        <h1 className="pg-title">🏅 ACHIEVEMENTS</h1>

        <div className="pf-stats">
          <div className="pf-stat">
            <strong>{unlocked}/{rows.length}</strong>
            <span>UNLOCKED</span>
          </div>
          <div className="pf-stat">
            <strong>{readyCount}</strong>
            <span>READY</span>
          </div>
          <div className="pf-stat">
            <strong>{bank.toLocaleString()}</strong>
            <span>COINS</span>
          </div>
        </div>

        <button className="pf-share" onClick={claimAll} disabled={readyCount === 0}>
          <span>🪙</span> {readyCount ? `CLAIM ALL (${readyCount})` : "NOTHING TO CLAIM"}
        </button>
        {note && <p className="pf-note">{note}</p>}

        <div className="pf-tabs" role="tablist">
          {(["all", "ready", "locked", "claimed"] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              className={`pf-tab ${filter === f ? "is-on" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <ul className="pg-list">
          {visible.length === 0 && <li className="pg-empty">Nothing here yet — keep playing!</li>}
          {visible.map((a) => (
            <li key={a.id} className={`pg-achv ${a.unlocked ? "is-on" : ""}`}>
              <span className="pg-achv-icon">{a.icon}</span>
              <div className="pg-achv-body">
                <span className="pg-achv-name">{a.name}</span>
                <span className="pg-achv-blurb">{a.blurb}</span>
                <div className="pg-bar">
                  <span className="pg-bar-fill" style={{ width: `${a.pct}%` }} />
                </div>
                <span className="pg-achv-prog">
                  {(a.format ?? String)(a.progress)} / {(a.format ?? String)(a.target)}
                </span>
              </div>
              {a.claimed ? (
                <span className="pg-badge done">CLAIMED</span>
              ) : a.claimable ? (
                <button className="pg-claim" onClick={() => claim(a.id)}>
                  🪙 {a.reward.toLocaleString()}
                </button>
              ) : (
                <span className="pg-badge">🔒 {a.reward.toLocaleString()}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
