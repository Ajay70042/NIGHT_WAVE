/**
 * TopBar — logo, scene switcher, search trigger.
 * Scene pill cycles through 4 ambient scenes on click.
 */
import { Search, Car, CloudRain, Building2, Sparkles } from "lucide-react";
import usePlayerStore from "../store/usePlayerStore";

const SCENES = [
  { id: "night-drive",    label: "Night Drive",    Icon: Car        },
  { id: "rainy-window",   label: "Rainy Window",   Icon: CloudRain  },
  { id: "tokyo-midnight", label: "Tokyo Midnight", Icon: Building2  },
  { id: "cyber-dawn",     label: "Cyber Dawn",     Icon: Sparkles   },
];

export default function TopBar() {
  const { openSearch, currentTrack, activeScene, setScene } = usePlayerStore();

  const now = new Date();
  const timeStr = now
    .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    .toLowerCase();

  const currentIdx  = SCENES.findIndex((s) => s.id === activeScene);
  const currentMeta = SCENES[currentIdx] ?? SCENES[0];
  const nextScene   = SCENES[(currentIdx + 1) % SCENES.length];
  const { Icon: SceneIcon } = currentMeta;

  return (
    <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-4">

      {/* Left: clock + scene switcher */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-white/30 tabular-nums font-light hidden sm:inline">
          {timeStr}
        </span>

        <button
          onClick={() => setScene(nextScene.id)}
          title={`Switch to ${nextScene.label}`}
          className="
            group flex items-center gap-1.5
            glass rounded-full px-3 py-1.5
            hover:bg-white/10
            transition-all duration-200 hover:scale-[1.03]
            active:scale-95
          "
        >
          <SceneIcon className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs text-white/60 group-hover:text-white transition-colors hidden sm:inline">
            {currentMeta.label}
          </span>
        </button>
      </div>

      {/* Center: live / track badge */}
      <div className="flex items-center gap-2 glass rounded-full px-4 py-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        <span className="text-xs text-white/60 font-medium">
          {currentTrack ? currentTrack.artist : "NightWave"}
        </span>
      </div>

      {/* Right: search */}
      <button
        onClick={openSearch}
        className="
          flex items-center gap-2 text-white/40 hover:text-white
          transition-colors duration-200 text-sm
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
