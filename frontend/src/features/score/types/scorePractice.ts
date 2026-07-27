import type { BeatStrengthLevel } from '../utils/beatStrength'
import type { BeatSubdivisionId } from '../utils/beatSubdivision'
import type { TempoChange } from './tempoChange'

export interface MeasureTiming {
  measureIndex: number;
  measureNumber: number | null;
  divisions: number;
  durationSum: number;
  expectedDurationDivisions: number;
  beatsPerMeasure: number;
  beatType: number;
  tempoBpm: number | null;
  fermataFactor: number;
  isPickup: boolean;
}

export interface ScoreMeta {
  title: string;
  composer?: string;
  defaultBpm: number;
}

export interface PracticeSettingsDraft {
  bpm: number
  beatsPerMeasure: number
  beatType: number
  measuresPerLine: number
  isAutoScroll: boolean
  isMetronomeEnabled: boolean
  isMeasureHighlightEnabled: boolean
  startMeasure: number
  endMeasure: number
  isRepeatMode: boolean
  transposeSemitones: number
  beatStrengths: BeatStrengthLevel[]
  beatSubdivisions: BeatSubdivisionId[]
  tempoChanges: TempoChange[]
}

export function createPracticeSettingsDraft(
  values: PracticeSettingsDraft,
): PracticeSettingsDraft {
  return {
    ...values,
    beatStrengths: [...values.beatStrengths],
    beatSubdivisions: [...values.beatSubdivisions],
    tempoChanges: [...values.tempoChanges],
  }
}
