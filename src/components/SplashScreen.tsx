import { useEffect, useState } from "react";
import logoAsset from "@/assets/airavoto-logo.png";

export default function SplashScreen() {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 2000);
    const t2 = setTimeout(() => setGone(true), 2650);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (gone) return null;

  return (
    <div className={`splash-screen${leaving ? " is-leaving" : ""}`} aria-hidden={leaving}>
      <div className="splash-inner">
        <img src={logoAsset} alt="Airavoto Games" className="splash-logo" width={512} height={512} />
        <span className="splash-kicker">GAMES</span>
        <span className="splash-word">AIRAVOTO</span>
        <span className="credit-line">made by ujwal guru</span>
      </div>
    </div>
  );
}
