import { useEffect } from "react";
import usePlayerStore from "../store/usePlayerStore";

export function useKeyboardShortcuts(seek) {
  const { openSearch, isPlaying, setIsPlaying, next, previous, toggleMute } =
    usePlayerStore();

  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      // Don't intercept if typing in an input
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;
        case "k":
        case "K":
          if (!e.ctrlKey && !e.metaKey) {
            setIsPlaying(!isPlaying);
          }
          break;
        case "/":
          e.preventDefault();
          openSearch();
          break;
        case "ArrowRight":
          e.preventDefault();
          seek?.((s) => s + 10);
          break;
        case "ArrowLeft":
          e.preventDefault();
          seek?.((s) => Math.max(0, s - 10));
          break;
        case "n":
          next();
          break;
        case "p":
          previous();
          break;
        case "m":
          toggleMute();
          break;
        default:
          break;
      }

      // Ctrl+K / Cmd+K → search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        openSearch();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPlaying, openSearch, setIsPlaying, next, previous, seek, toggleMute]);
}
