/**
 * PocketMode — AMOLED / OLED Battery Saver & Pocket Touch Shield
 *
 * Provides a pure pitch-black (#000000) shield mode for mobile devices:
 * - 0% screen power consumption on OLED / AMOLED displays
 * - Prevents accidental screen touches when phone is in pocket or bag
 * - Minimal ultra-dim glowing track info & clock
 * - Double-tap or swipe to exit
 */
import { useEffect, useState, useRef, useCallback } from "react";
import { Lock, Unlock, Moon, Sparkles } from "lucide-react";
import usePlayerStore from "../store/usePlayerStore";
import { formatTime } from "../lib/formatTime";

export default function PocketMode() {
  const { isPocketMode, togglePocketMode, currentTrack, isPlaying, progress, duration } = usePlayerStore();
  const [timeStr, setTimeStr] = useState("");
  const [tapNotice, setTapNotice] = useState(false);
  const lastTapRef = useRef(0);
  const noticeTimerRef = useRef(null);

  // Live clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Double tap to wake
  const handleTouchOrClick = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 400) {
      // Double tap detected -> Exit pocket mode
      togglePocketMode();
    } else {
      lastTapRef.current = now;
      setTapNotice(true);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => {
        setTapNotice(false);
      }, 1500);
    }
  }, [togglePocketMode]);

  if (!isPocketMode) return null;

  return (
    <div
      onClick={handleTouchOrClick}
      onTouchStart={handleTouchOrClick}
      className="fixed inset-0 z-[99999] bg-black select-none flex flex-col justify-between p-8 text-white/30 cursor-pointer overflow-hidden transition-opacity duration-300"
      style={{
        backgroundColor: "#000000",
        touchAction: "none",
      }}
    >
      {/* ── Top Bar: Minimal Status ── */}
      <div className="flex items-center justify-between text-xs tracking-widest uppercase opacity-40 font-mono">
        <div className="flex items-center gap-2">
          <Moon className="w-3.5 h-3.5" />
          <span>Pocket Shield</span>
        </div>
        <div>{timeStr}</div>
      </div>

      {/* ── Center: Clock & Track Info ── */}
      <div className="flex flex-col items-center justify-center text-center space-y-4 my-auto">
        <div className="text-5xl sm:text-7xl font-thin tracking-tighter text-white/20 font-mono">
          {timeStr}
        </div>

        {currentTrack && (
          <div className="space-y-1 max-w-xs">
            <p className="text-sm font-medium text-white/40 truncate">
              {currentTrack.title}
            </p>
            <p className="text-xs text-white/25 truncate">
              {currentTrack.artist}
            </p>
            <div className="flex items-center justify-center gap-2 pt-2 text-[10px] text-white/20 font-mono">
              <span>{formatTime(progress)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}

        {/* Pulse indicator */}
        {isPlaying && (
          <div className="flex items-center gap-1.5 pt-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-pulse" />
            <span className="text-[10px] text-accent/30 tracking-widest uppercase font-mono">Playing</span>
          </div>
        )}
      </div>

      {/* ── Bottom: Unlock Prompt ── */}
      <div className="flex flex-col items-center justify-center space-y-2 pb-4">
        <div
          className={`text-xs text-center transition-all duration-300 ${
            tapNotice
              ? "text-accent opacity-100 scale-105"
              : "text-white/20 opacity-50"
          }`}
        >
          {tapNotice ? (
            <span className="flex items-center gap-1.5 font-medium">
              <Unlock className="w-3.5 h-3.5 text-accent" /> Tap once more to unlock
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Double tap anywhere to unlock
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
