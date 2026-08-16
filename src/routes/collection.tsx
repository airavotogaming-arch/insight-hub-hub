import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ModelViewer } from "@/components/ModelViewer";
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
      { title: "Collection — 3D Armory | Toy Blitz Carnival" },
      {
        name: "description",
        content:
          "Spin every blaster and crosshair you own in full 3D, track collection completion and equip your carnival loadout in one tap.",
      },
      { property: "og:title", content: "Collection — 3D Armory | Toy Blitz Carnival" },
      {
        property: "og:description",
        content: "Rotate your carnival blasters and reticles in 3D and equip them instantly.",
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
  const [selGun, setSelGun] = useState("carnival");
  const [selCross, setSelCross] = useState("classic");
  const [note, setNote] = useState("");

  useEffect(() => {
    setOwned(getOwned());
    setOwnedGuns(getOwnedGuns());
    setCrosshair(getEquipped());
    setGun(getEquippedGun());
    setSelGun(getEquippedGun());
    setSelCross(getEquipped());
  }, []);

  const flash = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote(""), 2200);
  };

  const isGun = tab === "guns";
  const items = isGun ? GUN_ITEMS : SHOP_ITEMS;
  const selected = items.find((i) => i.id === (isGun ? selGun : selCross)) ?? items[0]!;
  const ownedIds = isGun ? ownedGuns : owned;
  const equippedId = isGun ? gun : crosshair;
  const hasSelected = ownedIds.includes(selected.id);
  const selectedEquipped = equippedId === selected.id;

  const equip = (id: string) => {
    if (!ownedIds.includes(id)) return;
    if (isGun) {
      setEquippedGun(id);
      setGun(id);
    } else {
      setEquipped(id);
      setCrosshair(id);
    }
    flash(`${items.find((i) => i.id === id)?.name ?? "Item"} equipped!`);
  };

  const gunPct = Math.round((ownedGuns.length / GUN_ITEMS.length) * 100);
  const sightPct = Math.round((owned.length / SHOP_ITEMS.length) * 100);
  const total = ownedGuns.length + owned.length;
  const totalMax = GUN_ITEMS.length + SHOP_ITEMS.length;

  return (
    <main className="pf-root">
      <div className="pf-card pg-wide pg-armory">
        <Link to="/" className="pf-back">← BACK TO MENU</Link>

        <h1 className="pg-title">🎒 3D COLLECTION</h1>

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
            aria-selected={isGun}
            className={`pf-tab ${isGun ? "is-on" : ""}`}
            onClick={() => setTab("guns")}
          >
            BLASTERS {gunPct}%
          </button>
          <button
            role="tab"
            aria-selected={!isGun}
            className={`pf-tab ${!isGun ? "is-on" : ""}`}
            onClick={() => setTab("sights")}
          >
            CROSSHAIRS {sightPct}%
          </button>
        </div>

        {note && <p className="pf-note">{note}</p>}

        <section className="pg-stage">
          <ModelViewer
            key={`${tab}-${selected.id}`}
            kind={isGun ? "gun" : "crosshair"}
            itemId={selected.id}
            className={`model-viewer ${hasSelected ? "" : "is-locked"}`}
          />
          <div className="pg-stage-info">
            <h2 className="pg-stage-name">{selected.name}</h2>
            <p className="pg-stage-blurb">{selected.blurb}</p>
            <p className="pg-stage-hint">Drag to rotate · scroll to zoom</p>
            {hasSelected ? (
              <button className="pg-equip" disabled={selectedEquipped} onClick={() => equip(selected.id)}>
                {selectedEquipped ? "EQUIPPED" : "EQUIP"}
              </button>
            ) : (
              <Link to="/shop" className="pg-equip locked">
                🔒 UNLOCK FOR 🪙 {selected.cost.toLocaleString()}
              </Link>
            )}
          </div>
        </section>

        <div className="pg-grid">
          {items.map((item) => {
            const have = ownedIds.includes(item.id);
            const on = equippedId === item.id;
            const sel = selected.id === item.id;
            return (
              <button
                key={item.id}
                className={`pg-cell ${have ? "" : "is-locked"} ${on ? "is-on" : ""} ${sel ? "is-sel" : ""}`}
                onClick={() => (isGun ? setSelGun(item.id) : setSelCross(item.id))}
                onDoubleClick={() => equip(item.id)}
              >
                <div className="pg-cell-art">
                  <ModelViewer
                    kind={isGun ? "gun" : "crosshair"}
                    itemId={item.id}
                    className="model-viewer thumb"
                  />
                  {!have && <span className="pg-lock">🔒</span>}
                </div>
                <span className="pg-cell-name">{item.name}</span>
                <span className="pg-cell-blurb">
                  {on ? "EQUIPPED" : have ? "OWNED" : `🪙 ${item.cost.toLocaleString()}`}
                </span>
              </button>
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
