import type { BeatStrengthLevel } from './beatStrength';
import {
  DEFAULT_BEAT_SUBDIVISION,
  getSubdivisionPattern,
  type BeatSubdivisionId,
} from './beatSubdivision';
import {
  getWindowIndexByElapsed,
  type MeasureWindow,
} from './measureTiming';

export interface MetronomeClickEvent {
  timeMs: number;
  strength: BeatStrengthLevel;
  slotKey: string;
}

const TIME_EPSILON_MS = 0.001;

// After a suspended tab or a long render, play only onsets near the current beat.
export function getRealtimeClickRangeStart(previousMs: number, nowMs: number): number {
  return nowMs - previousMs > 250 ? nowMs - 75 : previousMs;
}

export function collectMetronomeClickEvents(
  windows: MeasureWindow[],
  fromMs: number,
  toMs: number,
  bpm: number,
  beatsPerMeasure: number,
  beatStrengths: BeatStrengthLevel[],
  beatSubdivisions: BeatSubdivisionId[],
): MetronomeClickEvent[] {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) return [];

  const events: MetronomeClickEvent[] = [];
  const rangeStart = Math.max(0, fromMs - TIME_EPSILON_MS);
  const rangeEnd = Math.max(0, toMs + TIME_EPSILON_MS);

  function collectWindow(window: MeasureWindow | null) {
    const origin = window?.startMs ?? 0;
    const end = window ? origin + window.durationMs : Infinity;
    const tempo = window && window.tempoBpm > 0 ? window.tempoBpm : bpm > 0 ? bpm : 120;
    const interval = Math.max(1, (60000 / tempo) * (4 / Math.max(1, window?.beatType ?? 4)));
    const beats = Math.max(1, window?.beatsPerMeasure ?? beatsPerMeasure);
    // Advance the integer ordinal, since (beatTime - origin) / interval can round down.
    const first = Math.max(0, Math.floor((rangeStart - origin) / interval));
    const last = Math.floor((Math.min(rangeEnd, end) - origin) / interval);
    for (let ordinal = first; ordinal <= last; ordinal++) {
      const beatStart = origin + ordinal * interval;
      if (beatStart >= end - TIME_EPSILON_MS) break;
      const beat = ordinal % beats;
      const pattern = getSubdivisionPattern(beatSubdivisions[beat] ?? DEFAULT_BEAT_SUBDIVISION);
      for (const slot of pattern.slots) {
        const timeMs = beatStart + slot.offset * interval;
        if (!slot.play || timeMs < rangeStart || timeMs > rangeEnd || timeMs >= end - TIME_EPSILON_MS) continue;
        const step = window?.playbackStepIndex ?? 'global';
        events.push({ timeMs, strength: beatStrengths[beat] ?? 'strong', slotKey: `${step}:${ordinal}:${slot.offset}` });
      }
    }
  }

  if (windows.length === 0) {
    collectWindow(null);
  } else {
    const firstWindow = getWindowIndexByElapsed(windows, rangeStart);
    for (let i = firstWindow; i < windows.length && windows[i].startMs <= rangeEnd; i++) {
      collectWindow(windows[i]);
    }
  }

  return events;
}
