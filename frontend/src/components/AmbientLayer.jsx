/**
 * AmbientLayer — invisible Web Audio API ambient sound mixer.
 *
 * Generates three ambient sound types procedurally (no external files):
 *   rain   — filtered white noise (bandpass ~1200 Hz)
 *   vinyl  — brown noise (1/f low-rumble) simulating old vinyl
 *   engine — sawtooth oscillator through lowpass filter (~85 Hz)
 *
 * Reads ambientLevels from the Zustand store and updates gain in real-time.
 * AudioContext is created lazily on first user interaction to comply with
 * browser autoplay policies.
 */
import { useEffect, useRef } from "react";
import usePlayerStore from "../store/usePlayerStore";

// Singleton AudioContext shared across remounts
let sharedCtx = null;

function getAudioContext() {
  if (!sharedCtx) {
    sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return sharedCtx;
}

// Build a 4-second looping buffer of white noise
function createWhiteNoiseBuffer(ctx) {
  const len    = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data   = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// Build a 4-second looping buffer of brown noise (1/f)
function createBrownNoiseBuffer(ctx) {
  const len    = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data   = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5; // amplify
  }
  return buffer;
}

function createRainNodes(ctx) {
  const source = ctx.createBufferSource();
  source.buffer = createWhiteNoiseBuffer(ctx);
  source.loop   = true;

  const filter = ctx.createBiquadFilter();
  filter.type            = "bandpass";
  filter.frequency.value = 1200;
  filter.Q.value         = 0.7;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();

  return { gain };
}

function createVinylNodes(ctx) {
  const source = ctx.createBufferSource();
  source.buffer = createBrownNoiseBuffer(ctx);
  source.loop   = true;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();

  return { gain };
}

function createEngineNodes(ctx) {
  const osc = ctx.createOscillator();
  osc.type            = "sawtooth";
  osc.frequency.value = 82;

  const filter = ctx.createBiquadFilter();
  filter.type            = "lowpass";
  filter.frequency.value = 220;
  filter.Q.value         = 1.5;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start();

  return { gain };
}

export default function AmbientLayer() {
  const ambientLevels = usePlayerStore((s) => s.ambientLevels);
  const nodesRef      = useRef(null); // { rain, vinyl, engine } — each has .gain

  // ── Initialise on first user interaction ────────────────────────
  useEffect(() => {
    const init = () => {
      if (nodesRef.current) return; // already initialised

      const ctx = getAudioContext();

      // Resume if suspended (Chrome autoplay policy)
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      nodesRef.current = {
        rain:   createRainNodes(ctx),
        vinyl:  createVinylNodes(ctx),
        engine: createEngineNodes(ctx),
      };
    };

    // Initialise on any user gesture
    window.addEventListener("click",      init, { once: true });
    window.addEventListener("keydown",    init, { once: true });
    window.addEventListener("touchstart", init, { once: true });

    return () => {
      window.removeEventListener("click",      init);
      window.removeEventListener("keydown",    init);
      window.removeEventListener("touchstart", init);
    };
  }, []);

  // ── Sync gain values when sliders change ────────────────────────
  useEffect(() => {
    const nodes = nodesRef.current;
    if (!nodes) return;

    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Max perceived gains tuned so they blend pleasantly with music
    const MAX = { rain: 0.28, vinyl: 0.18, engine: 0.22 };

    ["rain", "vinyl", "engine"].forEach((key) => {
      const target = ambientLevels[key] * MAX[key];
      nodes[key].gain.gain.setTargetAtTime(target, now, 0.15);
    });
  }, [ambientLevels]);

  // Nothing to render — purely audio
  return null;
}
