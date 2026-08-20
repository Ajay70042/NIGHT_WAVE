/**
 * BrowseTopBar — fixed top bar for browse/home mode.
 * Left:  NightWave logo + live dot
 * Right: Search button + Cinema mode button
 */
import { Search, Maximize2 } from "lucide-react";
import usePlayerStore from "../store/usePlayerStore";

export default function BrowseTopBar() {
  const { openSearch, toggleCinematic } = usePlayerStore();

  return (
    <div
      className="
        fixed top-0 left-0 right-0 z-30
        flex items-center justify-between
        px-5 sm:px-8
      "
      style={{
        paddingTop: "calc(12px + env(safe-area-inset-top, 0px))",
        paddingBottom: "12px",
        background:
          "linear-gradient(to bottom, rgba(8,8,14,0.95) 0%, rgba(8,8,14,0.8) 70%, transparent 100%)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
        </span>
        <span
          className="font-display font-extrabold text-white text-lg tracking-tight"
          style={{ textShadow: "0 1px 16px rgba(0,0,0,0.7)" }}
        >
          NightWave
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button
          onClick={openSearch}
          className="
            flex items-center gap-2
            glass rounded-full px-3 py-1.5
            text-white/50 hover:text-white text-sm
            hover:bg-white/10 transition-all duration-200
          "
          title="Search (Ctrl+K)"
        >
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">Search</span>
          <kbd className="hidden md:inline text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
            ⌘K
          </kbd>
        </button>

        {/* Cinema mode */}
        <button
          onClick={toggleCinematic}
          title="Cinema mode"
          className="
            flex items-center gap-2
            glass rounded-full px-3 py-1.5
            text-white/50 hover:text-white
            hover:bg-white/10 transition-all duration-200
            hover:scale-[1.03] active:scale-95
          "
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="text-xs hidden sm:inline">Cinema</span>
        </button>
      </div>
    </div>
  );
}
