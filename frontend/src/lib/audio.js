import { create } from "zustand";

/** Stable tempo per track (fallback during quiet intros/buffering). */
export const bpmFor = (id = "") =>
  84 + ([...String(id)].reduce((n, c) => n + c.charCodeAt(0), 0) * 7) % 44;

/** Live beat info detected from the audio output. */
export const useBeat = create(() => ({ beat: 0, level: 0, at: 0 }));

/**
 * Pure onset detector: feed low-band energy per frame, returns true on a beat.
 * Beat = energy clearly above the recent average, with a refractory gap.
 */
export function createBeatDetector({ window = 43, ratio = 1.32, minGapMs = 220, floor = 0.015 } = {}) {
  const hist = [];
  let last = -Infinity;
  return (energy, nowMs) => {
    const avg = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
    hist.push(energy);
    if (hist.length > window) hist.shift();
    if (energy > floor && energy > avg * ratio && nowMs - last > minGapMs) {
      last = nowMs;
      return true;
    }
    return false;
  };
}

let _ctx = null;
let _analyser = null;
let _sourceConnected = false;
let _raf = 0;

/**
 * Connects an HTMLAudioElement to Web Audio AnalyserNode for real-time beat detection.
 */
export function ensureBeatAnalyser(audioEl, getPlayerState) {
  if (typeof window === "undefined" || !audioEl) return;

  try {
    if (!_ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      _ctx = new AudioCtx();
      _analyser = _ctx.createAnalyser();
      _analyser.fftSize = 1024;
      _analyser.smoothingTimeConstant = 0.25;
    }

    if (_ctx.state === "suspended") {
      _ctx.resume().catch(() => {});
    }

    if (!_sourceConnected) {
      const src = _ctx.createMediaElementSource(audioEl);
      src.connect(_analyser);
      _analyser.connect(_ctx.destination);
      _sourceConnected = true;
    }

    if (_raf) return;

    const detect = createBeatDetector();
    const bins = new Uint8Array(_analyser.frequencyBinCount);
    let lastFallbackBeat = 0;

    const frame = () => {
      const pState = getPlayerState();
      if (!pState.playing || audioEl.paused) {
        if (useBeat.getState().level !== 0) {
          useBeat.setState({ level: 0 });
        }
        _raf = requestAnimationFrame(frame);
        return;
      }

      _analyser.getByteFrequencyData(bins);
      const hzPerBin = _ctx.sampleRate / _analyser.fftSize;
      const top = Math.max(2, Math.round(160 / hzPerBin));
      let e = 0;
      for (let i = 0; i < top; i++) e += bins[i] / 255;
      e /= top;

      const now = performance.now();
      const s = useBeat.getState();

      if (e > 0.005) {
        if (detect(e * e, now)) {
          useBeat.setState({ beat: s.beat + 1, level: Math.min(1, e * 1.45), at: now });
        } else if (Math.abs(s.level - e) > 0.015) {
          useBeat.setState({ level: s.level * 0.84 + e * 0.16 });
        }
      } else {
        const intervalMs = 60000 / bpmFor(pState.currentId || "0");
        if (now - lastFallbackBeat >= intervalMs) {
          lastFallbackBeat = now;
          useBeat.setState({ beat: s.beat + 1, level: 0.65, at: now });
        } else if (s.level > 0.05) {
          useBeat.setState({ level: s.level * 0.92 });
        }
      }

      _raf = requestAnimationFrame(frame);
    };

    _raf = requestAnimationFrame(frame);
  } catch (err) {
    console.warn("Beat analyser notice:", err);
  }
}
