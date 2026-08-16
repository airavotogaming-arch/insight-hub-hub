import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import shopBg from "@/assets/shop-bg.jpg";
import { ModelViewer } from "@/components/ModelViewer";
import { GUN_ITEMS } from "@/game/guns";
import {
  SHOP_ITEMS,
  addOwned,
  addOwnedGun,
  getBank,
  getEquipped,
  getEquippedGun,
  getOwned,
  getOwnedGuns,
  setBank,
  setEquipped,
  setEquippedGun,
} from "@/game/shop";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Prize Shop — Rotate 3D Blasters & Crosshairs | Toy Blitz" },
      {
        name: "description",
        content:
          "Browse the Toy Blitz prize shop in 3D: spin every premium blaster and crosshair, compare ticket prices and equip your favourite loadout.",
      },
      { property: "og:title", content: "Prize Shop — Rotate 3D Blasters & Crosshairs" },
      {
        property: "og:description",
        content: "Interactive 3D previews of every carnival blaster and reticle in Toy Blitz.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopPage,
});

type Tab = "gun" | "crosshair";

function ShopPage() {
  const [tab, setTab] = useState<Tab>("gun");
  const [bank, setBankState] = useState(0);
  const [owned, setOwned] = useState<string[]>(["classic"]);
  const [ownedGuns, setOwnedGunsState] = useState<string[]>(["carnival"]);
  const [crosshair, setCrosshair] = useState("classic");
  const [gun, setGun] = useState("carnival");
  const [selGun, setSelGun] = useState("carnival");
  const [selCross, setSelCross] = useState("classic");

  useEffect(() => {
    setBankState(getBank());
    setOwned(getOwned());
    setOwnedGunsState(getOwnedGuns());
    setCrosshair(getEquipped());
    setGun(getEquippedGun());
    setSelGun(getEquippedGun());
    setSelCross(getEquipped());
  }, []);

  const isGun = tab === "gun";
  const items = isGun ? GUN_ITEMS : SHOP_ITEMS;
  const selectedId = isGun ? selGun : selCross;
  const selected = items.find((i) => i.id === selectedId) ?? items[0]!;
  const ownedIds = isGun ? ownedGuns : owned;
  const equippedId = isGun ? gun : crosshair;
  const isOwned = ownedIds.includes(selected.id);
  const isEquipped = equippedId === selected.id;
  const short = selected.cost - bank;

  const equip = (id: string) => {
    if (isGun) {
      setEquippedGun(id);
      setGun(id);
    } else {
      setEquipped(id);
      setCrosshair(id);
    }
  };

  const act = () => {
    if (isOwned) {
      equip(selected.id);
      return;
    }
    if (bank < selected.cost) return;
    const next = bank - selected.cost;
    setBank(next);
    setBankState(next);
    if (isGun) {
      addOwnedGun(selected.id);
      setOwnedGunsState(getOwnedGuns());
    } else {
      addOwned(selected.id);
      setOwned(getOwned());
    }
    equip(selected.id);
  };

  return (
    <div className="shop-page" style={{ backgroundImage: `url(${shopBg})` }}>
      <div className="shop-page-scrim" />
      <div className="shop-page-inner">
        <header className="shop-page-head">
          <Link to="/" className="fair-button shop-page-back">
            ← Back to game
          </Link>
          <div>
            <h1 className="fair-title shop-page-title">Prize Shop</h1>
            <p className="fair-sub">
              Ticket bank: <strong className="text-ticket">{bank}</strong> 🎟 · drag a model to spin it
            </p>
          </div>
        </header>

        <div className="shop-tabs shop-page-tabs">
          <button className={`shop-tab ${isGun ? "on" : ""}`} onClick={() => setTab("gun")}>
            Blasters
          </button>
          <button className={`shop-tab ${!isGun ? "on" : ""}`} onClick={() => setTab("crosshair")}>
            Crosshairs
          </button>
        </div>

        <div className="shop-page-body">
          <section className="shop-stage">
            <ModelViewer
              key={`${tab}-${selected.id}`}
              kind={isGun ? "gun" : "crosshair"}
              itemId={selected.id}
              className="model-viewer"
            />
            <div className="shop-stage-info">
              <h2 className="shop-stage-name">{selected.name}</h2>
              <p className="shop-stage-blurb">{selected.blurb}</p>
              <p className="shop-stage-hint">Drag to rotate · scroll to zoom</p>
              <button
                className="fair-button shop-purchase"
                disabled={!isOwned && bank < selected.cost}
                onClick={act}
              >
                {isEquipped
                  ? "Equipped"
                  : isOwned
                    ? "Equip"
                    : `Buy for ${selected.cost} 🎟`}
              </button>
              {!isOwned && short > 0 && (
                <p className="shop-purchase-hint">
                  You need {short} more ticket{short === 1 ? "" : "s"}.
                </p>
              )}
            </div>
          </section>

          <section className="shop-page-list">
            {items.map((item) => {
              const own = ownedIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  className={`shop-item shop-page-item ${equippedId === item.id ? "equipped" : own ? "owned" : bank < item.cost ? "locked" : ""} ${selected.id === item.id ? "selected" : ""}`}
                  onClick={() => (isGun ? setSelGun(item.id) : setSelCross(item.id))}
                >
                  <span className="shop-page-thumb">
                    <ModelViewer
                      kind={isGun ? "gun" : "crosshair"}
                      itemId={item.id}
                      className="model-viewer thumb"
                    />
                  </span>
                  <span className="shop-name">{item.name}</span>
                  <span className="shop-cost">
                    {equippedId === item.id ? "EQUIPPED" : own ? "OWNED" : `${item.cost} 🎟`}
                  </span>
                </button>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
}
