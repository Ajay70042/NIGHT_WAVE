/**
 * Visualizer — canvas-based frequency bar visualizer.
 * Reads from Web Audio API AnalyserNode (shared via ref from useAudioEngine).
 * Shows circular bars during playback; gentle idle pulse ring when paused.
 */
import { useEffect, useRef } from "react";
import usePlayerStore from "../store/usePlayerStore";

const BAR_COUNT = 80;
const ACCENT_LIME = "#a3e635";
const ACCENT_BLUE = "#38bdf8";

export default function Visualizer({ analyserRef }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    let idlePhase = 0;

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;
      const radius = Math.min(W, H) * 0.3;

      const analyser = analyserRef?.current;

      if (analyser && isPlayingRef.current) {
        // ── Real analyser data (native Audio mode) ────────────────
        const bufLen = analyser.frequencyBinCount;
        const dataArr = new Uint8Array(bufLen);
        analyser.getByteFrequencyData(dataArr);

        for (let i = 0; i < BAR_COUNT; i++) {
          const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
          const freqIdx = Math.floor((i / BAR_COUNT) * (bufLen * 0.7));
          const value = dataArr[freqIdx] / 255;
          const barH = value * radius * 0.6 + 2;

          const x1 = cx + Math.cos(angle) * radius;
          const y1 = cy + Math.sin(angle) * radius;
          const x2 = cx + Math.cos(angle) * (radius + barH);
          const y2 = cy + Math.sin(angle) * (radius + barH);

          const t = value;
          const r = Math.round(163 + (56 - 163) * t);
          const g = Math.round(230 + (189 - 230) * t);
          const b = Math.round(53 + (248 - 53) * t);

          ctx.beginPath();
          ctx.strokeStyle = `rgba(${r},${g},${b},${0.4 + value * 0.6})`;
          ctx.lineWidth = 2.5;
          ctx.lineCap = "round";
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        const avg = dataArr.reduce((a, b) => a + b, 0) / bufLen / 255;
        const grad = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius * 1.05);
        grad.addColorStop(0, `rgba(163,230,53,${avg * 0.3})`);
        grad.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.95, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

      } else if (!analyser && isPlayingRef.current) {
        // ── Simulated bars (IFrame API mode — cross-origin audio) ─
        idlePhase += 0.04;
        for (let i = 0; i < BAR_COUNT; i++) {
          const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
          // Pseudo-random animated bars using sin waves at different freqs
          const value = Math.max(0,
            0.3 + 0.25 * Math.sin(idlePhase * 1.3 + i * 0.4) +
            0.2  * Math.sin(idlePhase * 2.1 + i * 0.8) +
            0.15 * Math.sin(idlePhase * 0.7 + i * 0.2)
          );
          const barH = value * radius * 0.5 + 2;

          const x1 = cx + Math.cos(angle) * radius;
          const y1 = cy + Math.sin(angle) * radius;
          const x2 = cx + Math.cos(angle) * (radius + barH);
          const y2 = cy + Math.sin(angle) * (radius + barH);

          const t = value;
          const r = Math.round(163 + (56 - 163) * t);
          const g = Math.round(230 + (189 - 230) * t);
          const b = Math.round(53 + (248 - 53) * t);

          ctx.beginPath();
          ctx.strokeStyle = `rgba(${r},${g},${b},${0.35 + value * 0.55})`;
          ctx.lineWidth = 2.5;
          ctx.lineCap = "round";
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

      } else {
        // ── Idle: slow breathing ring ─────────────────────────────
        idlePhase += 0.015;
        const pulse = (Math.sin(idlePhase) + 1) / 2;
        const ringOpacity = 0.08 + pulse * 0.1;
        const ringScale = radius + pulse * 6;

        ctx.beginPath();
        ctx.arc(cx, cy, ringScale, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(163,230,53,${ringOpacity})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, radius - 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,0.04)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [analyserRef]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      aria-hidden="true"
    />
  );
}
