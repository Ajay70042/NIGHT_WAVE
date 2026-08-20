/**
 * wordSync.js — High-Precision Word-Level Karaoke Synchronization Engine.
 *
 * Capabilities:
 * 1. True Word Timings: When exact millisecond timestamps are available (e.g. from
 *    YouTube auto-captions / subtitles or enhanced LRC), uses exact audio-aligned timing.
 * 2. Syllable-Aware Vocal Pacing: For standard line-level LRC, calculates natural
 *    vocal delivery using vowel-group syllable weights and punctuation breath pauses.
 * 3. Dead-Air Clamping: Bounds vocal delivery so words NEVER stretch across long
 *    instrumental solos or lag behind the actual singer.
 * 4. Micro-Interpolation: High-frequency smooth transitions that adapt to fast and slow tempos.
 */

/**
 * Counts natural syllables in a word using phoneme and vowel-group detection.
 * Handles English, Latin, and non-Latin character sets.
 *
 * @param {string} word
 * @returns {number} estimated syllable count (min 1)
 */
export function countSyllables(word) {
  if (!word) return 1;
  const clean = word.toLowerCase().trim();

  // If non-Latin (Hindi, CJK, Arabic, etc.), count unicode glyphs
  if (/[^\u0000-\u007F]/.test(clean)) {
    const chars = clean.replace(/[\s\p{P}]+/gu, "");
    return Math.max(1, Math.min(chars.length, Math.ceil(chars.length / 2)));
  }

  const alpha = clean.replace(/[^a-z]/g, "");
  if (alpha.length <= 3) return 1;

  // Count vowel groups (e.g. "ea", "ou", "ai")
  const matches = alpha.match(/[aeiouy]{1,2}/g);
  let count = matches ? matches.length : 1;

  // Subtract silent trailing 'e' (e.g. "make", "late"), but preserve "le" (e.g. "little")
  if (alpha.endsWith("e") && !alpha.endsWith("le") && !alpha.endsWith("ee") && count > 1) {
    count--;
  }

  // Handle words ending in "ed" or "es"
  if ((alpha.endsWith("ed") || alpha.endsWith("es")) && count > 1 && !alpha.endsWith("ted") && !alpha.endsWith("ded")) {
    count--;
  }

  return Math.max(1, count);
}

/**
 * Detects natural punctuation breath pauses (in seconds) after a word.
 *
 * @param {string} word
 * @returns {number} pause in seconds
 */
function getPunctuationPause(word) {
  if (!word) return 0;
  if (word.includes("...") || word.includes("…")) return 0.40;
  if (/[.!?]/.test(word)) return 0.30;
  if (/[,;:]/.test(word)) return 0.18;
  if (/[-–—]/.test(word)) return 0.12;
  return 0;
}

/**
 * Computes exact word segments [{ text, time, duration, end }] for a given line.
 *
 * @param {Array<{time: number, text: string, words?: Array<{text: string, time: number, duration?: number}>}>} lines
 * @param {number} lineIdx
 * @returns {Array<{text: string, time: number, duration: number, end: number}>}
 */
export function getWordDetails(lines, lineIdx) {
  const line = lines[lineIdx];
  if (!line) return [];

  // 1. If true audio-aligned word timestamps are provided by backend
  if (line.words && Array.isArray(line.words) && line.words.length > 0) {
    return line.words.map((w, i) => {
      const wTime = typeof w.time === "number" ? w.time : line.time;
      let wDur = typeof w.duration === "number" ? w.duration : 0.3;
      if (wDur <= 0) {
        if (i + 1 < line.words.length && typeof line.words[i + 1].time === "number") {
          wDur = Math.max(0.08, line.words[i + 1].time - wTime);
        } else {
          wDur = 0.35;
        }
      }
      return {
        text: w.text || "",
        time: wTime,
        duration: wDur,
        end: wTime + wDur,
      };
    });
  }

  // 2. Otherwise: Compute realistic Syllable-Aware Vocal Pacing
  const rawWords = line.text.split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return [];
  if (rawWords.length === 1) {
    const dur = lineIdx + 1 < lines.length ? Math.min(2.5, lines[lineIdx + 1].time - line.time) : 2.0;
    return [{ text: rawWords[0], time: line.time, duration: Math.max(0.3, dur), end: line.time + Math.max(0.3, dur) }];
  }

  const lineStart = line.time;
  const nextLineTime = lineIdx + 1 < lines.length ? lines[lineIdx + 1].time : lineStart + 4.5;
  const lineGap = Math.max(0.6, nextLineTime - lineStart);

  // Compute syllable weights and punctuation pauses
  const syllables = rawWords.map((w) => countSyllables(w));
  const pauses = rawWords.map((w) => getPunctuationPause(w));
  const totalSyllables = syllables.reduce((a, b) => a + b, 0);
  const totalPause = pauses.reduce((a, b) => a + b, 0);

  // Average natural vocal pace: ~0.30s per syllable in singing
  const estimatedVocalDuration = totalSyllables * 0.30 + totalPause;

  // Dead-Air Clamping:
  // If lineGap is small (e.g. 2s), use most of the gap (lineGap - 0.25s).
  // If lineGap is huge (e.g. 15s instrumental break), clamp vocal duration to realistic singing time!
  let vocalDuration;
  if (lineGap <= 3.5) {
    vocalDuration = Math.max(0.5, lineGap - 0.25);
  } else {
    // Clamp so the singer finishes naturally and words NEVER stretch into the instrumental break
    const maxBound = Math.min(lineGap - 0.5, Math.max(estimatedVocalDuration * 1.25, lineGap * 0.65));
    vocalDuration = Math.max(0.8, Math.min(estimatedVocalDuration, maxBound));
  }

  const activeSingingTime = Math.max(0.4, vocalDuration - totalPause);
  const wordDetails = [];
  let cursor = lineStart;

  for (let i = 0; i < rawWords.length; i++) {
    const sylRatio = syllables[i] / totalSyllables;
    const wDur = Math.max(0.12, sylRatio * activeSingingTime);
    const pauseAfter = pauses[i];

    wordDetails.push({
      text: rawWords[i],
      time: cursor,
      duration: wDur,
      end: cursor + wDur,
    });

    cursor += wDur + pauseAfter;
  }

  return wordDetails;
}

/**
 * Computes start timestamps for all words in a line (for backward compatibility).
 *
 * @param {Array<{time: number, text: string}>} lines
 * @param {number} lineIdx
 * @returns {number[]} start-times (seconds)
 */
export function computeWordTimings(lines, lineIdx) {
  const details = getWordDetails(lines, lineIdx);
  return details.map((d) => d.time);
}

/**
 * Returns smooth activation values for all words in the active line.
 *
 * Activation state:
 * - 0.0 → Upcoming word (faint, anticipated)
 * - 0.5 → Sung / past word on the active line (calm dimmed opacity, 100% finished)
 * - 0.7 to 1.0 → CURRENTLY singing word (bright, scaled, neon glow)
 *
 * @param {Array<{time: number, text: string}>} lines
 * @param {number} lineIdx  - index of the active line
 * @param {number} progress - current playback time in seconds
 * @returns {number[]} activation values per word
 */
export function getWordActivations(lines, lineIdx, progress) {
  const words = getWordDetails(lines, lineIdx);
  if (!words || words.length === 0) return [];

  return words.map((w) => {
    const wStart = w.time;
    const wEnd = w.end;
    const wDur = Math.max(0.1, w.duration);

    // Fast snappy anticipation window (60ms - 150ms)
    const fade = Math.min(0.15, Math.max(0.06, wDur * 0.25));

    if (progress < wStart - fade) {
      return 0.0; // Upcoming / cold
    } else if (progress < wStart) {
      // Anticipation fade-in: 0.0 → 0.7
      const t = (progress - (wStart - fade)) / fade;
      return smoothStep(t) * 0.7;
    } else if (progress <= wEnd) {
      // Currently singing: 0.7 → 1.0 → 0.85
      const wordProgress = (progress - wStart) / wDur;
      // Peak activation in the middle/early part of the word
      return 0.85 + 0.15 * Math.sin(wordProgress * Math.PI);
    } else if (progress < wEnd + fade) {
      // Smooth fade-down to sung state (0.50)
      const t = (progress - wEnd) / fade;
      return 0.85 - smoothStep(t) * 0.35; // 0.85 → 0.50
    } else {
      // Fully sung word on active line
      return 0.50;
    }
  });
}

/**
 * Finds the active line index given current playback progress.
 *
 * @param {Array<{time: number, text: string}>} lines
 * @param {number} progress
 * @returns {number} active line index (-1 if none)
 */
export function getActiveLineIdx(lines, progress) {
  if (!lines || lines.length === 0) return -1;
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= progress) idx = i;
    else break;
  }
  return idx;
}

/**
 * Smoothstep S-curve mapping for natural easing.
 */
function smoothStep(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}
