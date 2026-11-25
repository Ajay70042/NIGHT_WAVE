import { useEffect, useRef, useState } from "react";

/**
 * Returns true while the interface chrome (close / back buttons) should be
 * visible. Fades away after `delay` ms without real activity.
 */
export function useIdleChrome(delay = 2600, active = true) {
  const [shown, setShown] = useState(true);
  const timer = useRef(null);
  const last = useRef(null);

  useEffect(() => {
    if (!active) return;
    const arm = () => {
      setShown(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setShown(false), delay);
    };
    const move = (e) => {
      const p = last.current;
      last.current = { x: e.screenX, y: e.screenY };
      if (p && Math.abs(p.x - e.screenX) < 3 && Math.abs(p.y - e.screenY) < 3) return;
      arm();
    };
    arm();
    window.addEventListener("mousemove", move, { passive: true });
    const others = ["pointerdown", "keydown"];
    others.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      window.removeEventListener("mousemove", move);
      others.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [delay, active]);

  return shown;
}
