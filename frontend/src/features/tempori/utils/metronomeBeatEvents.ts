import type { BeatStrengthLevel } from './beatStrength';
import {
  DEFAULT_BEAT_SUBDIVISION,
  getSubdivisionPattern,
  type BeatSubdivisionId,
} from './beatSubdivision';
import {
  getActiveMeasureWindow,
  getMetronomeBeatContext,
  type MeasureWindow,
} from './measureTiming';

export interface MetronomeClickEvent {
  timeMs: number;
  strength: BeatStrengthLevel;
  slotKey: string;
}

function getBeatStartMs(
  windows: MeasureWindow[],
  timeMs: number,
  bpm: number,
  beatsPerMeasure: number,
): {
  beatStartMs: number;
  beatInMeasure: number;
  beatIntervalMs: number;
  activeWindow: MeasureWindow | null;
} {
  const ctx = getMetronomeBeatContext(windows, timeMs, bpm, beatsPerMeasure);
  const beatIntervalMs = Math.max(ctx.beatIntervalMs, 1);
  const activeWindow = getActiveMeasureWindow(windows, timeMs);
  const positionInWindow = activeWindow ? timeMs - activeWindow.startMs : timeMs;
  const beats = Math.max(ctx.beatsPerMeasure, 1);
  const beatInMeasure =
    activeWindow !== null
      ? Math.floor(positionInWindow / beatIntervalMs) % beats
      : ctx.beatInMeasure;
  const beatStartMs =
    activeWindow !== null
      ? activeWindow.startMs + beatInMeasure * beatIntervalMs
      : Math.floor(Math.max(0, timeMs) / beatIntervalMs) * beatIntervalMs;

  return { beatStartMs, beatInMeasure, beatIntervalMs, activeWindow };
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
  if (toMs < fromMs) {
    return [];
  }

  const events: MetronomeClickEvent[] = [];
  const rangeStart = Math.max(0, fromMs);
  const rangeEnd = Math.max(0, toMs);
  let cursor = rangeStart;
  let guard = 0;

  while (cursor <= rangeEnd + 0.001 && guard < 512) {
    guard += 1;
    const { beatStartMs, beatInMeasure, beatIntervalMs, activeWindow } = getBeatStartMs(
      windows,
      cursor,
      bpm,
      beatsPerMeasure,
    );
    const pattern = getSubdivisionPattern(beatSubdivisions[beatInMeasure] ?? DEFAULT_BEAT_SUBDIVISION);
    const strength = beatStrengths[beatInMeasure] ?? 'strong';

    for (const slot of pattern.slots) {
      if (!slot.play) continue;

      const eventMs = beatStartMs + slot.offset * beatIntervalMs;
      if (eventMs + 0.001 < rangeStart || eventMs > rangeEnd + 0.001) continue;

      const slotKey = activeWindow
        ? `${activeWindow.playbackStepIndex}:${beatInMeasure}:${slot.offset}`
        : `global:${Math.floor(beatStartMs / beatIntervalMs)}:${slot.offset}`;

      events.push({ timeMs: eventMs, strength, slotKey });
    }

    const nextCursor = beatStartMs + beatIntervalMs;
    if (nextCursor <= cursor) {
      cursor += beatIntervalMs;
    } else {
      cursor = nextCursor;
    }
  }

  return events;
}
