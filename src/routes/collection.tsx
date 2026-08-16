import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crosshair } from "@/components/Crosshair";
import { GunIcon } from "@/components/GunIcon";
import { GUN_ITEMS } from "@/game/guns";
import {
  SHOP_ITEMS,
  getEquipped,
  getEquippedGun,
  getOwned,
  getOwnedGuns,
  setEquipped,
  setEquippedGun,
} from "@/game/shop";

export const Route = createFileRoute("/collection")({
  head: () => ({
    meta: [
      { title: "Collection — Toy Blitz Carnival" },
      {
        name: "description",
        content:
          "Your Toy Blitz Carnival collection: every blaster and crosshair you own, what is still locked, and one-tap equipping.",
      },
      { property: "og:title", content: "Collection — Toy Blitz Carnival" },
      {
        property: "og:description",
        content: "See which carnival blasters and reticles you own and equip them instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CollectionPage,
});

function CollectionPage() {
  const [owned, setOwned] = useState<string[]>(["classic"]);
  const [ownedGuns, setOwnedGuns] = useState<string[]>(["carnival"]);
  const [crosshair, setCrosshair] = useState("classic");
  const [gun, setGun] = useState("carnival");
  const [tab, setTab] = useState<"guns" | "sights">("guns");
  const [note, setNote] = useState("");

  useEffect(() => {
    setOwned(getOwned());
    setOwnedGuns(getOwnedGuns());
    setCrosshair(getEquipped());
    setGun(getEquippedGun());
  }, []);

  const flash = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote(""), 2200);
  };

  const equipGun = (id: string) => {
    if (!ownedGuns.includes(id)) return;
    setEquippedGun(id);
    setGun(id);
    flash(`${GUN_ITEMS.find((g) => g.id === id)?.name ?? "Blaster"} equipped!`);
  };

  const equipSight = (id: string) => {
    if (!owned.includes(id)) return;
    setEquipped(id);
    setCrosshair(id);
    flash(`${SHOP_ITEMS.find((s) => s.id === id)?.name ?? "Crosshair"} equipped!`);
  };

  const gunPct = Math.round((ownedGuns.length / GUN_ITEMS.length) * 100);
  const sightPct = Math.round((owned.length / SHOP_ITEMS.length) * 100);
  const total = ownedGuns.length + owned.length;
  const totalMax = GUN_ITEMS.length + SHOP_ITEMS.length;

  return (
    <main className="pf-root">
      <div className="pf-card pg-wide">
        <Link to="/" className="pf-back">← BACK TO MENU</Link>

        <h1 className="pg-title">🎒 COLLECTION</h1>

        <div className="pf-stats">
          <div className="pf-stat">
            <strong>{ownedGuns.length}/{GUN_ITEMS.length}</strong>
            <span>BLASTERS</span>
          </div>
          <div className="pf-stat">
            <strong>{owned.length}/{SHOP_ITEMS.length}</strong>
            <span>CROSSHAIRS</span>
          </div>
          <div className="pf-stat">
            <strong>{Math.round((total / totalMax) * 100)}%</strong>
            <span>COMPLETE</span>
          </div>
        </div>

        <div className="pf-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "guns"}
            className={`pf-tab ${tab === "guns" ? "is-on" : ""}`}
            onClick={() => setTab("guns")}
          >
            BLASTERS {gunPct}%
          </button>
          <button
            role="tab"
            aria-selected={tab === "sights"}
            className={`pf-tab ${tab === "sights" ? "is-on" : ""}`}
            onClick={() => setTab("sights")}
          >
            CROSSHAIRS {sightPct}%
          </button>
        </div>

        {note && <p className="pf-note">{note}</p>}

        <div className="pg-grid">
          {tab === "guns"
            ? GUN_ITEMS.map((g) => {
                const have = ownedGuns.includes(g.id);
                const on = gun === g.id;
                return (
                  <div key={g.id} className={`pg-cell ${have ? "" : "is-locked"} ${on ? "is-on" : ""}`}>
                    <div className="pg-cell-art">
                      <GunIcon skin={g} size={72} />
                      {!have && <span className="pg-lock">🔒</span>}
                    </div>
                    <span className="pg-cell-name">{g.name}</span>
                    <span className="pg-cell-blurb">{g.blurb}</span>
                    {have ? (
                      <button className="pg-equip" disabled={on} onClick={() => equipGun(g.id)}>
                        {on ? "EQUIPPED" : "EQUIP"}
                      </button>
                    ) : (
                      <Link to="/shop" className="pg-equip locked">
                        🪙 {g.cost.toLocaleString()}
                      </Link>
                    )}
                  </div>
                );
              })
            : SHOP_ITEMS.map((s) => {
                const have = owned.includes(s.id);
                const on = crosshair === s.id;
                return (
                  <div key={s.id} className={`pg-cell ${have ? "" : "is-locked"} ${on ? "is-on" : ""}`}>
                    <div className="pg-cell-art">
                      <Crosshair variant={s.style} color={s.color} size={64} />
                      {!have && <span className="pg-lock">🔒</span>}
                    </div>
                    <span className="pg-cell-name">{s.name}</span>
                    <span className="pg-cell-blurb">{s.blurb}</span>
                    {have ? (
                      <button className="pg-equip" disabled={on} onClick={() => equipSight(s.id)}>
                        {on ? "EQUIPPED" : "EQUIP"}
                      </button>
                    ) : (
                      <Link to="/shop" className="pg-equip locked">
                        🪙 {s.cost.toLocaleString()}
                      </Link>
                    )}
                  </div>
                );
              })}
        </div>

        <div className="pg-links">
          <Link to="/shop" className="pg-link">🛒 PRIZE SHOP</Link>
          <Link to="/achievements" className="pg-link">🏅 ACHIEVEMENTS</Link>
        </div>
      </div>
    </main>
  );
}
