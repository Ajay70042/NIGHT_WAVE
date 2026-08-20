/**
 * HeroBackground — 4-scene cinematic ambient backdrop.
 *
 * Scenes (all pure CSS/Canvas, no video files):
 *   "night-drive"     — perspective road with animated lane markings
 *   "rainy-window"    — Canvas raindrop particles over neon city glow
 *   "tokyo-midnight"  — CSS building silhouettes + lit windows
 *   "cyber-dawn"      — animated aurora gradient blobs
 *
 * Transitions: fade the old scene out, swap, fade new scene in.
 */
import { useEffect, useRef, useState } from "react";
import usePlayerStore from "../store/usePlayerStore";

// ─── Shared constants ────────────────────────────────────────────
const STARS = Array.from({ length: 130 }, (_, i) => ({
  x: ((i * 73.1 + 17.3) % 100),
  y: ((i * 37.7 + 5.1) % 62),
  size: i % 6 === 0 ? 2 : i % 3 === 0 ? 1.5 : 1,
  opacity: 0.18 + ((i * 13) % 10) / 30,
}));

const TOKYO_BUILDINGS = [
  { x: 0,    w: 7,  h: 62, seed: 3  },
  { x: 6.5,  w: 5,  h: 42, seed: 17 },
  { x: 11,   w: 9,  h: 80, seed: 7  },
  { x: 19.5, w: 6,  h: 52, seed: 29 },
  { x: 25,   w: 11, h: 88, seed: 11 },
  { x: 35.5, w: 7,  h: 58, seed: 23 },
  { x: 42,   w: 5,  h: 38, seed: 41 },
  { x: 46.5, w: 8,  h: 74, seed: 13 },
  { x: 54,   w: 10, h: 85, seed: 5  },
  { x: 63.5, w: 6,  h: 48, seed: 37 },
  { x: 69,   w: 8,  h: 68, seed: 19 },
  { x: 76.5, w: 7,  h: 54, seed: 31 },
  { x: 83,   w: 9,  h: 64, seed: 9  },
  { x: 91.5, w: 5,  h: 44, seed: 43 },
  { x: 96,   w: 6,  h: 79, seed: 7  },
];

// ─── Scene: Night Drive ──────────────────────────────────────────
function NightDriveScene() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #020209 0%, #07051c 22%, #0e0820 48%, #17091c 68%, #0c0608 100%)",
      }}
    >
      {/* Stars */}
      <div className="absolute inset-0" aria-hidden="true">
        {STARS.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              borderRadius: "50%",
              background: "#fff",
              opacity: s.opacity,
            }}
          />
        ))}
      </div>

      {/* Horizon amber glow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "51%",
          left: "10%",
          right: "10%",
          height: "70px",
          background:
            "radial-gradient(ellipse at center, rgba(255,110,30,0.22) 0%, transparent 70%)",
          filter: "blur(14px)",
          pointerEvents: "none",
        }}
      />

      {/* Road surface — perspective trapezoid */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "48%",
          background: "linear-gradient(180deg, #0c0c10 0%, #101014 100%)",
          clipPath: "polygon(26% 0, 74% 0, 100% 100%, 0% 100%)",
          overflow: "hidden",
        }}
      >
        {/* Animated center lane dashes */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className="scene-road-dash"
              style={{ animationDelay: `${-(i / 12) * 1.8}s` }}
            />
          ))}
        </div>

        {/* Road edges — faint amber lines */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to right, transparent 2%, rgba(255,180,40,0.18) 3.5%, transparent 5.5%, transparent 94.5%, rgba(255,180,40,0.18) 96.5%, transparent 98%)",
          }}
        />
      </div>

      {/* Side neon streaks */}
      <div className="scene-road-edge-l" aria-hidden="true" />
      <div className="scene-road-edge-r" aria-hidden="true" />

      {/* Far-off streetlamp halos */}
      {[15, 85].map((pos, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "46%",
            left: `${pos}%`,
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "rgba(255,220,120,0.9)",
            boxShadow: "0 0 30px 15px rgba(255,200,80,0.15)",
          }}
        />
      ))}
    </div>
  );
}

// ─── Scene: Rainy Window ─────────────────────────────────────────
function RainyWindowScene() {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Raindrop particle system
    class Drop {
      constructor() { this.reset(); }
      reset() {
        this.x      = Math.random() * canvas.width;
        this.y      = Math.random() * canvas.height * -1;
        this.len    = Math.random() * 22 + 8;
        this.speed  = Math.random() * 4 + 2.5;
        this.drift  = (Math.random() - 0.4) * 0.6; // slight wind angle
        this.opacity = Math.random() * 0.35 + 0.08;
        this.width  = Math.random() * 1.4 + 0.3;
      }
      update() {
        this.y += this.speed;
        this.x += this.drift;
        if (this.y > canvas.height + this.len) this.reset();
      }
      draw() {
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + this.drift * 5, this.y + this.len);
        ctx.strokeStyle = `rgba(180,210,255,${this.opacity})`;
        ctx.lineWidth   = this.width;
        ctx.stroke();
      }
    }

    const drops = Array.from({ length: 220 }, () => new Drop());

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drops.forEach((d) => { d.update(); d.draw(); });
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: "#030710" }}>
      {/* City glow blobs (blurred color light sources) */}
      {[
        { top: "15%",  left:  "8%",  w: "45%", h: "55%", color: "rgba(255,70,80,0.13)"   },
        { top: "25%",  right: "10%", w: "40%", h: "50%", color: "rgba(40,90,255,0.16)"   },
        { bottom: "8%",left:  "28%", w: "44%", h: "42%", color: "rgba(120,40,220,0.12)"  },
        { top: "40%",  left:  "40%", w: "30%", h: "35%", color: "rgba(30,200,200,0.10)"  },
        { bottom: "20%",right:"5%",  w: "25%", h: "30%", color: "rgba(255,140,30,0.09)"  },
      ].map((blob, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            position: "absolute",
            top: blob.top, bottom: blob.bottom,
            left: blob.left, right: blob.right,
            width: blob.w, height: blob.h,
            background: `radial-gradient(ellipse, ${blob.color} 0%, transparent 70%)`,
            filter: "blur(50px)",
          }}
        />
      ))}

      {/* Rain canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ opacity: 0.75 }}
        aria-hidden="true"
      />

      {/* Glass condensation sheen */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(120deg, rgba(255,255,255,0.018) 0%, transparent 55%, rgba(255,255,255,0.012) 100%)",
        }}
      />
    </div>
  );
}

// ─── Scene: Tokyo Midnight ───────────────────────────────────────
function BuildingWindows({ building, pctH }) {
  const rows = Math.max(2, Math.floor(pctH / 8));
  const cols = Math.max(2, Math.floor(building.w / 3));
  const total = rows * cols;
  return (
    <div
      style={{
        position: "absolute",
        top: "8%", bottom: "4%", left: "10%", right: "10%",
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: "2px",
      }}
    >
      {Array.from({ length: total }, (_, i) => {
        const lit   = (building.seed * 3 + i * 7) % 11 < 4;
        const warm  = (building.seed + i * 3) % 7 < 4;
        const color = warm
          ? "rgba(255,235,160,0.75)"
          : "rgba(130,195,255,0.55)";
        return (
          <div
            key={i}
            style={{
              background: lit ? color : "transparent",
              borderRadius: "1px",
              opacity: lit ? 0.6 + ((building.seed + i) % 5) / 10 : 0,
            }}
          />
        );
      })}
    </div>
  );
}

function TokyoMidnightScene() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #010410 0%, #030820 28%, #050c30 55%, #080f22 78%, #040710 100%)",
      }}
    >
      {/* Stars — fewer, only top 50% */}
      <div className="absolute inset-0" aria-hidden="true">
        {STARS.slice(0, 80).map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${s.x}%`,
              top:  `${s.y * 0.7}%`,
              width: s.size,
              height: s.size,
              borderRadius: "50%",
              background: "#d0d8ff",
              opacity: s.opacity * 0.8,
            }}
          />
        ))}
      </div>

      {/* Moon */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "12%", right: "18%",
          width: "28px", height: "28px",
          borderRadius: "50%",
          background: "rgba(200,220,255,0.75)",
          boxShadow: "0 0 40px 15px rgba(140,170,255,0.12), 0 0 80px 30px rgba(80,100,200,0.06)",
        }}
      />

      {/* Building skyline — bottom 55% */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", bottom: "0%", left: 0, right: 0, height: "55%" }}
      >
        {TOKYO_BUILDINGS.map((b, i) => {
          const pctH = b.h;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                bottom: 0,
                left: `${b.x}%`,
                width: `${b.w}%`,
                height: `${pctH}%`,
                background: "rgba(4, 6, 18, 0.97)",
                borderTop: `1px solid rgba(60,100,200,0.18)`,
              }}
            >
              <BuildingWindows building={b} pctH={pctH} />
            </div>
          );
        })}
      </div>

      {/* Neon reflection strip at very bottom */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0, height: "6%",
          background:
            "linear-gradient(to top, rgba(30,50,160,0.35) 0%, transparent 100%)",
        }}
      />

      {/* Horizontal atmospheric haze */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "43%", left: 0, right: 0, height: "6%",
          background:
            "linear-gradient(to bottom, transparent 0%, rgba(10,20,80,0.25) 50%, transparent 100%)",
          filter: "blur(6px)",
        }}
      />
    </div>
  );
}

// ─── Scene: Cyber Dawn ───────────────────────────────────────────
function CyberDawnScene() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(155deg, #040111 0%, #080320 22%, #0e0528 48%, #060c1c 74%, #030810 100%)",
      }}
    >
      {/* Aurora blobs */}
      <div className="scene-aurora scene-aurora-1" aria-hidden="true" />
      <div className="scene-aurora scene-aurora-2" aria-hidden="true" />
      <div className="scene-aurora scene-aurora-3" aria-hidden="true" />

      {/* Subtle dot grid */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(100,60,255,0.07) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          backgroundPosition: "24px 24px",
        }}
      />

      {/* Bottom horizon purple sweep */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0, height: "28%",
          background:
            "linear-gradient(to top, rgba(160,30,180,0.14) 0%, transparent 100%)",
          filter: "blur(18px)",
          transform: "scale(1.05)",
        }}
      />

      {/* Sparse large stars */}
      {STARS.slice(50, 90).map((s, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size * 1.2,
            height: s.size * 1.2,
            borderRadius: "50%",
            background: "#c8b8ff",
            opacity: s.opacity * 0.6,
            boxShadow: s.size > 1.5 ? "0 0 6px 2px rgba(180,140,255,0.2)" : "none",
          }}
        />
      ))}
    </div>
  );
}

// ─── Scene registry ──────────────────────────────────────────────
const SCENE_COMPONENTS = {
  "night-drive":    NightDriveScene,
  "rainy-window":   RainyWindowScene,
  "tokyo-midnight": TokyoMidnightScene,
  "cyber-dawn":     CyberDawnScene,
};

// ─── Main export ─────────────────────────────────────────────────
export default function HeroBackground() {
  const activeScene = usePlayerStore((s) => s.activeScene);

  // Cross-fade: hold the old scene while fading out, then swap
  const [displayScene, setDisplayScene] = useState(activeScene);
  const [fading, setFading]             = useState(false);

  useEffect(() => {
    if (activeScene === displayScene) return;
    setFading(true);
    const t = setTimeout(() => {
      setDisplayScene(activeScene);
      setFading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [activeScene]); // eslint-disable-line react-hooks/exhaustive-deps

  const SceneComponent = SCENE_COMPONENTS[displayScene] ?? NightDriveScene;

  return (
    <div className="fixed inset-0 overflow-hidden" aria-hidden="true">
      {/* Active scene */}
      <div
        className="absolute inset-0"
        style={{
          opacity: fading ? 0 : 1,
          transition: "opacity 0.35s ease",
        }}
      >
        <SceneComponent />
      </div>

      {/* Global dark vignette overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,0.58) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Soft content readability overlay */}
      <div
        className="absolute inset-0 bg-black/30"
        style={{ pointerEvents: "none" }}
      />

      {/* Film grain — SVG fractal noise for analog texture */}
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full"
        style={{ opacity: 0.08, mixBlendMode: "soft-light" }}
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <filter id="film-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="3"
            seed="12"
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix in="noise" type="saturate" values="0" result="mono" />
          <feComponentTransfer in="mono">
            <feFuncR type="discrete" tableValues="0.1 0.3 0.5 0.7 0.9" />
            <feFuncG type="discrete" tableValues="0.1 0.3 0.5 0.7 0.9" />
            <feFuncB type="discrete" tableValues="0.1 0.3 0.5 0.7 0.9" />
          </feComponentTransfer>
        </filter>
        <rect width="100%" height="100%" filter="url(#film-grain)" />
      </svg>
    </div>
  );
}
