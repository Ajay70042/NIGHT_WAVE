import { useCallback } from "react";
import HeroBackground from "./components/HeroBackground";
import TopBar from "./components/TopBar";
import HeroCenter from "./components/HeroCenter";
import PlayerBar from "./components/PlayerBar";
import SearchModal from "./components/SearchModal";
import QueueDrawer from "./components/QueueDrawer";
import LyricsView from "./components/LyricsView";
import { useAudioEngine } from "./hooks/useAudioEngine";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import usePlayerStore from "./store/usePlayerStore";

export default function App() {
  const { analyser, seek: engineSeek } = useAudioEngine();
  const { progress } = usePlayerStore();

  // Wrap seek so keyboard shortcuts can do relative seeks
  const seek = useCallback(
    (valOrFn) => {
      const next = typeof valOrFn === "function" ? valOrFn(progress) : valOrFn;
      engineSeek(next);
    },
    [engineSeek, progress]
  );

  useKeyboardShortcuts(seek);

  return (
    <div className="relative flex flex-col h-screen overflow-hidden bg-obsidian">
      {/* Layer 0: ambient background */}
      <HeroBackground />

      {/* Layer 1: content */}
      <div className="relative z-10 flex flex-col h-full pb-[80px]">
        <TopBar />
        <HeroCenter analyserRef={analyser} />
      </div>

      {/* Layer 2: fixed overlays */}
      <PlayerBar seek={engineSeek} />
      <QueueDrawer />
      <LyricsView />
      <SearchModal />
    </div>
  );
}
