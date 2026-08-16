import type { CrosshairStyle } from "@/game/shop";

interface CrosshairProps {
  variant: CrosshairStyle;
  color: string;
  size?: number;
  hit?: boolean;
}

/**
 * Reticle renderer. Every shop item maps to a structurally different
 * crosshair (not just a recolor). Shapes are pure CSS spans.
 */
export function Crosshair({ variant, color, size = 62, hit = false }: CrosshairProps) {
  return (
    <span
      className={`crosshair ${hit ? "crosshair-hit" : ""}`}
      data-variant={variant}
      style={{ width: size, height: size, ["--ch-color" as string]: color }}
    >
      <span className="ch-ring" />
      <span className="ch-inner" />
      <span className="ch-dot" />
      <span className="ch-tick ch-t" />
      <span className="ch-tick ch-b" />
      <span className="ch-tick ch-l" />
      <span className="ch-tick ch-r" />
      <span className="ch-diag ch-d1" />
      <span className="ch-diag ch-d2" />
    </span>
  );
}
