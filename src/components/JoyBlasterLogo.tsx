import { useEffect, useRef, useState } from "react";
import logo from "@/assets/toy-blitz-carnival-logo.png";

type Props = { size?: "lg" | "sm"; className?: string };

export default function JoyBlasterLogo({ size = "lg", className = "" }: Props) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Image may already be cached/decoded before React attaches onLoad
    if (imgRef.current?.complete) {
      setLoaded(true);
      return;
    }
    // Kick off an eager decode so the logo paints as soon as bytes arrive
    const pre = new Image();
    pre.src = logo;
    pre.decode?.().then(() => setLoaded(true)).catch(() => setLoaded(true));
    const t = setTimeout(() => setLoaded(true), 1200); // failsafe
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`logo-wrap ${size === "sm" ? "sm" : "lg"} ${className}`.trim()}
      data-loaded={loaded ? "true" : "false"}
    >
      {!loaded && <div className="logo-skeleton" aria-hidden="true" />}
      <img
        ref={imgRef}
        src={logo}
        alt="Toy Blitz Carnival logo"
        width={1024}
        height={1024}
        loading="eager"
        fetchPriority="high"
        decoding="sync"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className="logo-img"
      />
    </div>
  );
}
