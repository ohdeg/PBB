import { create } from 'zustand';
import {
  createDefaultBeatStrengths,
  resizeBeatStrengths,
  type BeatStrengthLevel,
} from '../utils/beatStrength';
import {
  createDefaultBeatSubdivisions,
  resizeBeatSubdivisions,
  type BeatSubdivisionId,
} from '../utils/beatSubdivision';
import { DEFAULT_TIME_SIGNATURE, type TimeSignature } from '../utils/measureTiming';

interface ScorePlaybackState {
  bpm: number;
  beatsPerMeasure: number;
  beatType: number;
  isPlaying: boolean;
  currentMeasureIndex: number;
  elapsedMs: number;
  isAutoScroll: boolean;
  isMetronomeEnabled: boolean;
  isMeasureHighlightEnabled: boolean;
  scrollSmoothing: ScrollBehavior;
  /** 0 = OSMD 자동 줄바꿈 */
  measuresPerLine: number;
  beatStrengths: BeatStrengthLevel[];
  beatSubdivisions: BeatSubdivisionId[];
  setBpm: (bpm: number) => void;
  setTimeSignature: (signature: TimeSignature) => void;
  setBeatsPerMeasure: (beatsPerMeasure: number) => void;
  setBeatType: (beatType: number) => void;
  togglePlaying: () => void;
  setPlaying: (isPlaying: boolean) => void;
  setCurrentMeasureIndex: (measureIndex: number) => void;
  setElapsedMs: (elapsedMs: number) => void;
  setAutoScroll: (enabled: boolean) => void;
  setMetronomeEnabled: (enabled: boolean) => void;
  setMeasureHighlightEnabled: (enabled: boolean) => void;
  setScrollSmoothing: (behavior: ScrollBehavior) => void;
  setMeasuresPerLine: (measuresPerLine: number) => void;
  setBeatStrengthAt: (beatIndex: number, strength: BeatStrengthLevel) => void;
  setBeatSubdivisionAt: (beatIndex: number, subdivisionId: BeatSubdivisionId) => void;
  resetPlayback: () => void;
}

const DEFAULT_BPM = 120;
const MEASURES_PER_LINE_STORAGE_KEY = 'music-viewer:measures-per-line';

const normalizeMeasuresPerLine = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(32, Math.trunc(value));
};

const readStoredMeasuresPerLine = (): number => {
  try {
    const saved = Number(localStorage.getItem(MEASURES_PER_LINE_STORAGE_KEY));
    return normalizeMeasuresPerLine(saved);
  } catch {
    return 0;
  }
};

const normalizeBeatsPerMeasure = (beatsPerMeasure: number): number =>
  Number.isFinite(beatsPerMeasure) && beatsPerMeasure > 0
    ? beatsPerMeasure
    : DEFAULT_TIME_SIGNATURE.beatsPerMeasure;

const normalizeBeatType = (beatType: number): number =>
  Number.isFinite(beatType) && beatType > 0 ? beatType : DEFAULT_TIME_SIGNATURE.beatType;

const resizeBeatSettings = (
  beatStrengths: BeatStrengthLevel[],
  beatSubdivisions: BeatSubdivisionId[],
  beatsPerMeasure: number,
) => ({
  beatStrengths: resizeBeatStrengths(beatStrengths, beatsPerMeasure),
  beatSubdivisions: resizeBeatSubdivisions(beatSubdivisions, beatsPerMeasure),
});

export const useScorePlaybackStore = create<ScorePlaybackState>((set) => ({
  bpm: DEFAULT_BPM,
  beatsPerMeasure: DEFAULT_TIME_SIGNATURE.beatsPerMeasure,
  beatType: DEFAULT_TIME_SIGNATURE.beatType,
  isPlaying: false,
  currentMeasureIndex: 0,
  elapsedMs: 0,
  isAutoScroll: true,
  isMetronomeEnabled: true,
  isMeasureHighlightEnabled: true,
  scrollSmoothing: 'smooth',
  measuresPerLine: readStoredMeasuresPerLine(),
  beatStrengths: createDefaultBeatStrengths(DEFAULT_TIME_SIGNATURE.beatsPerMeasure),
  beatSubdivisions: createDefaultBeatSubdivisions(DEFAULT_TIME_SIGNATURE.beatsPerMeasure),
  setBpm: (bpm) => set({ bpm: Number.isFinite(bpm) && bpm > 0 ? bpm : DEFAULT_BPM }),
  setTimeSignature: (signature) =>
    set((state) => {
      const beatsPerMeasure = normalizeBeatsPerMeasure(signature.beatsPerMeasure);
      const beatType = normalizeBeatType(signature.beatType);
      return {
        beatsPerMeasure,
        beatType,
        ...resizeBeatSettings(state.beatStrengths, state.beatSubdivisions, beatsPerMeasure),
      };
    }),
  setBeatsPerMeasure: (beatsPerMeasure) =>
    set((state) => {
      const normalized = normalizeBeatsPerMeasure(beatsPerMeasure);
      return {
        beatsPerMeasure: normalized,
        ...resizeBeatSettings(state.beatStrengths, state.beatSubdivisions, normalized),
      };
    }),
  setBeatType: (beatType) =>
    set({
      beatType: normalizeBeatType(beatType),
    }),
  togglePlaying: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentMeasureIndex: (currentMeasureIndex) => set({ currentMeasureIndex }),
  setElapsedMs: (elapsedMs) => set({ elapsedMs: Math.max(0, elapsedMs) }),
  setAutoScroll: (isAutoScroll) => set({ isAutoScroll }),
  setMetronomeEnabled: (isMetronomeEnabled) => set({ isMetronomeEnabled }),
  setMeasureHighlightEnabled: (isMeasureHighlightEnabled) => set({ isMeasureHighlightEnabled }),
  setScrollSmoothing: (scrollSmoothing) => set({ scrollSmoothing }),
  setMeasuresPerLine: (measuresPerLine) => {
    const normalized = normalizeMeasuresPerLine(measuresPerLine);
    try {
      localStorage.setItem(MEASURES_PER_LINE_STORAGE_KEY, String(normalized));
    } catch {
      // ignore quota / private mode
    }
    set({ measuresPerLine: normalized });
  },
  setBeatStrengthAt: (beatIndex, strength) =>
    set((state) => {
      const strengths = [...state.beatStrengths];
      if (beatIndex < 0 || beatIndex >= strengths.length) return state;
      strengths[beatIndex] = strength;
      return { beatStrengths: strengths };
    }),
  setBeatSubdivisionAt: (beatIndex, subdivisionId) =>
    set((state) => {
      const subdivisions = [...state.beatSubdivisions];
      if (beatIndex < 0 || beatIndex >= subdivisions.length) return state;
      subdivisions[beatIndex] = subdivisionId;
      return { beatSubdivisions: subdivisions };
    }),
  resetPlayback: () =>
    set({
      isPlaying: false,
      currentMeasureIndex: 0,
      elapsedMs: 0,
    }),
}));
