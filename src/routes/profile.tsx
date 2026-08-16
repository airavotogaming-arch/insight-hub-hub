import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import avatarImg from "@/assets/menu-avatar.png";
import {
  getPlayerName,
  setPlayerName,
  getMaxLevel,
  getBank,
  getBoard,
  renameBoardEntries,
  getHistory,
  renameHistoryEntries,
  type ScoreEntry,
  type MatchEntry,
} from "@/game/shop";

import { renderProfileCard } from "@/lib/profileCard";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Player Profile — Toy Blitz Carnival" },
      {
        name: "description",
        content:
          "View your Toy Blitz Carnival player profile: nickname, level reached, coins banked and your best carnival scores.",
      },
      { property: "og:title", content: "Player Profile — Toy Blitz Carnival" },
      {
        property: "og:description",
        content: "Your carnival stats: level, coins and top scores from the shooting gallery.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const formatWhen = (ms: number) => {
  if (!ms) return "—";
  const d = new Date(ms);
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

function ProfilePage() {
  const [name, setName] = useState("");
  const [level, setLevel] = useState(1);
  const [coins, setCoins] = useState(0);
  const [board, setBoard] = useState<ScoreEntry[]>([]);
  const [history, setHistory] = useState<MatchEntry[]>([]);
  const [tab, setTab] = useState<"scores" | "history">("scores");
  const [levelFilter, setLevelFilter] = useState("");
  const [sort, setSort] = useState<"newest" | "score">("newest");
  const [page, setPage] = useState(1);
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState("");

  useEffect(() => {
    setName(getPlayerName());
    setLevel(getMaxLevel());
    setCoins(getBank());
    setBoard(getBoard());
    setHistory(getHistory());
  }, []);

  const PAGE_SIZE = 6;

  const filtered = useMemo(() => {
    const q = levelFilter.trim();
    const rows = q ? history.filter((e) => String(e.level).includes(q)) : history;
    return [...rows].sort((a, b) => (sort === "score" ? b.score - a.score : b.at - a.at));
  }, [history, levelFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [levelFilter, sort, tab]);

  const save = (v: string) => {
    const prev = getPlayerName();
    setName(v);
    setPlayerName(v);
    // keep saved scores attached to the player after a rename
    if (v.trim()) {
      setBoard(renameBoardEntries(prev, v));
      setHistory(renameHistoryEntries(prev, v));
    }
  };


  const shareCard = async () => {
    setSharing(true);
    setShareNote("");
    try {
      const blob = await renderProfileCard({
        name,
        level,
        coins,
        best: board[0]?.score ?? 0,
        avatarSrc: avatarImg,
      });
      if (!blob) throw new Error("render failed");
      const file = new File([blob], "toy-blitz-profile.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "My Toy Blitz Carnival profile",
          text: `${(name || "PLAYER ONE").toUpperCase()} — Level ${level}. Can you beat my score?`,
        });
        setShareNote("Shared!");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "toy-blitz-profile.png";
        a.click();
        URL.revokeObjectURL(url);
        setShareNote("Card downloaded — send it to your friends!");
      }
    } catch {
      setShareNote("Couldn't share the card. Try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <main className="pf-root">
      <div className="pf-card">
        <Link to="/" className="pf-back">
          ← BACK TO MENU
        </Link>


        <div className="pf-head">
          <img className="pf-avatar" src={avatarImg} alt="Player avatar" width={512} height={512} />
          <div>
            <h1 className="pf-name">{(name || "PLAYER ONE").toUpperCase()}</h1>
            <span className="pf-sub">Level {level}</span>
          </div>
        </div>

        <label className="pf-field">
          <span>NICKNAME</span>
          <input
            value={name}
            maxLength={14}
            placeholder="PLAYER ONE"
            onChange={(e) => save(e.target.value)}
          />
        </label>

        <div className="pf-stats">
          <div className="pf-stat">
            <strong>{level}</strong>
            <span>LEVEL</span>
          </div>
          <div className="pf-stat">
            <strong>{coins.toLocaleString()}</strong>
            <span>COINS</span>
          </div>
          <div className="pf-stat">
            <strong>{(board[0]?.score ?? 0).toLocaleString()}</strong>
            <span>BEST SCORE</span>
          </div>
        </div>

        <button className="pf-share" onClick={shareCard} disabled={sharing}>
          <span>📤</span> {sharing ? "MAKING CARD…" : "SHARE PROFILE CARD"}
        </button>
        {shareNote && <p className="pf-note">{shareNote}</p>}



        <div className="pf-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "scores"}
            className={`pf-tab ${tab === "scores" ? "is-on" : ""}`}
            onClick={() => setTab("scores")}
          >
            TOP SCORES
          </button>
          <button
            role="tab"
            aria-selected={tab === "history"}
            className={`pf-tab ${tab === "history" ? "is-on" : ""}`}
            onClick={() => setTab("history")}
          >
            HISTORY
          </button>
        </div>

        {tab === "scores" ? (
          <ul className="pf-board">
            {board.length === 0 && <li className="pf-empty">No scores yet — go play!</li>}
            {board.map((e, i) => (
              <li key={`${e.name}-${i}`}>
                <span>#{i + 1}</span>
                <span>{e.name}</span>
                <strong>{e.score.toLocaleString()}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <div className="pf-filters">
              <input
                className="pf-filter-input"
                value={levelFilter}
                inputMode="numeric"
                placeholder="Search level…"
                aria-label="Filter matches by level"
                onChange={(e) => setLevelFilter(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
              />
              <select
                className="pf-filter-select"
                value={sort}
                aria-label="Sort matches"
                onChange={(e) => setSort(e.target.value === "score" ? "score" : "newest")}
              >
                <option value="newest">Newest</option>
                <option value="score">Highest score</option>
              </select>
            </div>

            <ul className="pf-board">
              {pageRows.length === 0 && (
                <li className="pf-empty">
                  {history.length === 0 ? "No matches played yet." : "No matches at that level."}
                </li>
              )}
              {pageRows.map((e, i) => (
                <li key={`${e.at}-${i}`}>
                  <span className="pf-when">{formatWhen(e.at)}</span>
                  <span className="pf-lvl">LVL {e.level}</span>
                  <strong>{e.score.toLocaleString()}</strong>
                </li>
              ))}
            </ul>

            {filtered.length > PAGE_SIZE && (
              <div className="pf-pager">
                <button
                  className="pf-page-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  ‹ PREV
                </button>
                <span className="pf-page-info">
                  {safePage} / {pageCount}
                </span>
                <button
                  className="pf-page-btn"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={safePage >= pageCount}
                >
                  NEXT ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
