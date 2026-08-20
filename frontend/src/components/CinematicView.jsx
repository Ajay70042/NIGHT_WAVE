/**
 * CinematicView — the full-screen ambient experience.
 * Wraps HeroBackground + HeroCenter + exit button (top-right).
 * Replaces the whole screen content when isCinematic === true.
 */
import { X, Car, CloudRain, Building2, Sparkles } from "lucide-react";
import HeroBackground from "./HeroBackground";
import HeroCenter from "./HeroCenter";
import usePlayerStore from "../store/usePlayerStore";

const SCENES = [
  { id: "night-drive",    label: "Night Drive",    Icon: Car        },
  { id: "rainy-window",   label: "Rainy Window",   Icon: CloudRain  },
  { id: "tokyo-midnight", label: "Tokyo Midnight", Icon: Building2  },
  { id: "cyber-dawn",     label: "Cyber Dawn",     Icon: Sparkles   },
];

export default function CinematicView() {
  const { toggleCinematic, activeScene, setScene } = usePlayerStore();

  const currentIdx  = SCENES.findIndex((s) => s.id === activeScene);
  const currentMeta = SCENES[currentIdx] ?? SCENES[0];
  const nextScene   = SCENES[(currentIdx + 1) % SCENES.length];
  const { Icon: SceneIcon } = currentMeta;

  return (
    <div className="fixed inset-0 z-40 flex flex-col">
      {/* Background fills everything */}
      <HeroBackground />

      {/* Top bar — scene switcher (left) + exit (right) */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-5 shrink-0">
        {/* Scene pill */}
        <button
          onClick={() => setScene(nextScene.id)}
          title={`Switch to ${nextScene.label}`}
          className="
            group flex items-center gap-1.5
            glass rounded-full px-3 py-1.5
            hover:bg-white/10 transition-all duration-200
            hover:scale-[1.03] active:scale-95
          "
        >
          <SceneIcon className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs text-white/60 group-hover:text-white transition-colors hidden sm:inline">
            {currentMeta.label}
          </span>
        </button>

        {/* Exit cinematic mode */}
        <button
          onClick={toggleCinematic}
          title="Exit cinema mode (Esc)"
          className="
            flex items-center gap-2
            glass rounded-full px-3 py-1.5
            text-white/50 hover:text-white
            hover:bg-white/10 transition-all duration-200
            hover:scale-[1.03] active:scale-95
          "
        >
          <X className="w-3.5 h-3.5" />
          <span className="text-xs hidden sm:inline">Exit</span>
        </button>
      </div>

      {/* Hero center — big title */}
      <div className="relative z-10 flex-1">
        <HeroCenter />
      </div>
    </div>
  );
}
