/**
 * HeroBackground — full-screen cinematic ambient backdrop.
 * Crossfades between album art thumbnails using CSS transitions.
 */
import { useEffect, useRef, useState } from "react";
import usePlayerStore from "../store/usePlayerStore";

export default function HeroBackground() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const [layers, setLayers] = useState([{ src: null, id: 0 }]);
  const counterRef = useRef(1);

  useEffect(() => {
    const src = currentTrack?.thumbnail || null;
    setLayers((prev) => {
      const id = counterRef.current++;
      // Keep max 2 layers for crossfade
      const next = [...prev, { src, id }].slice(-2);
      return next;
    });
  }, [currentTrack?.thumbnail]);

  return (
    <div className="fixed inset-0 overflow-hidden" aria-hidden="true">
      {/* Layered crossfade images */}
      {layers.map((layer, i) => (
        <div
          key={layer.id}
          className="absolute inset-0 transition-opacity duration-[1500ms] ease-in-out"
          style={{ opacity: i === layers.length - 1 ? 1 : 0 }}
        >
          {layer.src ? (
            <img
              src={layer.src}
              alt=""
              className="w-full h-full object-cover scale-110"
              style={{ filter: "blur(60px) saturate(1.4) brightness(0.35)" }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#0a0a0c] via-[#0f0f14] to-[#050508]" />
          )}
        </div>
      ))}

      {/* Gradient overlays for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent to-[#0a0a0ccc]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0c]" />

      {/* Subtle vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)",
        }}
      />
    </div>
  );
}
