import { useEffect, useRef } from 'react';
import type { BeatStrengthLevel } from '../utils/beatStrength';
import {
  DEFAULT_BEAT_SUBDIVISION,
  getSubdivisionPattern,
  type BeatSubdivisionId,
} from '../utils/beatSubdivision';
import { MetronomeAudio } from '../utils/metronomeAudio';

interface ScoreMetronomeProps {
  isPlaying: boolean;
  enabled: boolean;
  bpm: number;
  elapsedMs: number;
  beatsPerMeasure: number;
  beatStrengths: BeatStrengthLevel[];
  beatSubdivisions: BeatSubdivisionId[];
}

export default function ScoreMetronome({
  isPlaying,
  enabled,
  bpm,
  elapsedMs,
  beatsPerMeasure,
  beatStrengths,
  beatSubdivisions,
}: ScoreMetronomeProps) {
  const metronomeRef = useRef<MetronomeAudio | null>(null);
  const firedSlotsRef = useRef<{ beatIndex: number; maxSlot: number }>({
    beatIndex: -1,
    maxSlot: -1,
  });

  useEffect(() => {
    metronomeRef.current = new MetronomeAudio();
    return () => {
      metronomeRef.current?.dispose();
      metronomeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isPlaying || !enabled) {
      firedSlotsRef.current = { beatIndex: -1, maxSlot: -1 };
      return;
    }

    const safeBpm = bpm > 0 ? bpm : 120;
    const safeBeatsPerMeasure = Math.max(beatsPerMeasure, 1);
    const beatIntervalMs = 60000 / safeBpm;
    const globalBeatIndex = Math.floor(Math.max(0, elapsedMs) / beatIntervalMs);
    const beatInMeasure = globalBeatIndex % safeBeatsPerMeasure;
    const positionInBeat = (elapsedMs % beatIntervalMs) / beatIntervalMs;

    if (firedSlotsRef.current.beatIndex !== globalBeatIndex) {
      firedSlotsRef.current = { beatIndex: globalBeatIndex, maxSlot: -1 };
    }

    const subdivisionId = beatSubdivisions[beatInMeasure] ?? DEFAULT_BEAT_SUBDIVISION;
    const pattern = getSubdivisionPattern(subdivisionId);
    const strength = beatStrengths[beatInMeasure] ?? 'strong';

    for (
      let slotIndex = firedSlotsRef.current.maxSlot + 1;
      slotIndex < pattern.slots.length;
      slotIndex += 1
    ) {
      const slot = pattern.slots[slotIndex];
      if (!slot.play) {
        firedSlotsRef.current.maxSlot = slotIndex;
        continue;
      }

      if (positionInBeat + 0.02 < slot.offset) {
        break;
      }

      metronomeRef.current?.playClick(strength);
      firedSlotsRef.current.maxSlot = slotIndex;
    }
  }, [
    isPlaying,
    enabled,
    bpm,
    elapsedMs,
    beatsPerMeasure,
    beatStrengths,
    beatSubdivisions,
  ]);

  return null;
}
