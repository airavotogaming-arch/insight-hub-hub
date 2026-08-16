import { useEffect, useState } from "react";

/** Counts from 0 up to `value`, starting after `delay` ms. */
export function CountUp({
  value,
  delay = 0,
  duration = 900,
  suffix = "",
}: {
  value: number;
  delay?: number;
  duration?: number;
  suffix?: string;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [value, delay, duration]);

  return (
    <>
      {shown}
      {suffix}
    </>
  );
}
