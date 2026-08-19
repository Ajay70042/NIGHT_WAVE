/** Top nav bar — logo, search trigger, live count badge */
import { Search, Radio } from "lucide-react";
import usePlayerStore from "../store/usePlayerStore";

export default function TopBar() {
  const { openSearch, currentTrack } = usePlayerStore();
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).toLowerCase();

  return (
    <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-4">
      {/* Clock */}
      <span className="text-sm text-white/40 tabular-nums font-light">{timeStr}</span>

      {/* Center: live badge */}
      <div className="flex items-center gap-2 glass rounded-full px-4 py-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        <span className="text-xs text-white/60 font-medium">
          {currentTrack ? currentTrack.artist : "NightWave"}
        </span>
      </div>

      {/* Right: Search */}
      <button
        onClick={openSearch}
        className="
          flex items-center gap-2 text-white/40 hover:text-white
          transition-colors duration-200
          text-sm
        "
        aria-label="Search"
        title="Search (Ctrl+K)"
      >
        <Search className="w-4 h-4" />
        <kbd className="hidden md:inline text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
          ⌘K
        </kbd>
      </button>
    </div>
  );
}
