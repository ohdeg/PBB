import type { TimeSignature } from '../utils/measureTiming';

export interface TempoChange {
  id: string;
  startMeasure: number;
  endMeasure: number;
  bpm: number;
  beatsPerMeasure: number;
  beatType: number;
}

export const createTempoChange = (
  startMeasure: number,
  endMeasure: number,
  bpm: number,
  timeSignature: TimeSignature,
  id: string = crypto.randomUUID(),
): TempoChange => ({
  id,
  startMeasure,
  endMeasure,
  bpm,
  beatsPerMeasure: timeSignature.beatsPerMeasure,
  beatType: timeSignature.beatType,
});

const clampMeasure = (value: number, totalMeasures: number): number =>
  Math.max(1, Math.min(Math.trunc(value) || 1, totalMeasures));

const clampTimeSignatureValue = (value: number, fallback: number): number => {
  const parsed = Math.trunc(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 16);
};

export const normalizeTempoChanges = (
  changes: TempoChange[],
  totalMeasures: number,
): TempoChange[] => {
  const total = Math.max(totalMeasures, 1);

  return [...changes]
    .map((change) => {
      const legacyMeasure = (change as { measureNumber?: number }).measureNumber;
      let startMeasure = clampMeasure(change.startMeasure ?? legacyMeasure ?? 1, total);
      let endMeasure = clampMeasure(change.endMeasure ?? legacyMeasure ?? startMeasure, total);
      if (startMeasure > endMeasure) {
        [startMeasure, endMeasure] = [endMeasure, startMeasure];
      }

      return {
        ...change,
        startMeasure,
        endMeasure,
        bpm: Number.isFinite(change.bpm) && change.bpm > 0 ? Math.trunc(change.bpm) : 120,
        beatsPerMeasure: clampTimeSignatureValue(change.beatsPerMeasure, 4),
        beatType: clampTimeSignatureValue(change.beatType, 4),
      };
    })
    .sort(
      (left, right) =>
        left.startMeasure - right.startMeasure || left.endMeasure - right.endMeasure,
    );
};

export const getActiveTempoChangeForMeasure = (
  changes: TempoChange[],
  measureNumber: number,
): TempoChange | null => {
  let resolved: TempoChange | null = null;

  for (const change of changes) {
    if (measureNumber < change.startMeasure) break;
    if (measureNumber <= change.endMeasure) {
      resolved = change;
    }
  }

  return resolved;
};
