import { useMemo } from 'react';
import type { ScoreRenderSnapshot } from '../components/OsmdViewer';
import type { PracticeSettingsDraft } from '../types/scorePractice';
import type { TempoChange } from '../types/tempoChange';
import {
  buildMeasureWindows,
  clampMeasureRange,
  computePlayheadHighlight,
  createPlayheadHighlightLookup,
  getCountInDurationMs,
  getElapsedMsForMeasure,
  getMetronomeBeatContext,
  getPlaybackStepByElapsed,
  getSectionPlaybackBounds,
  type MeasureWindow,
  type PlayheadHighlight,
  type TimeSignature,
} from '../utils/measureTiming';

interface UseScorePlaybackDerivedParams {
  snapshot: ScoreRenderSnapshot;
  bpm: number;
  tempoChanges: TempoChange[];
  startMeasure: number;
  endMeasure: number;
  settingsDraft: PracticeSettingsDraft;
  currentMeasureIndex: number;
  rangeSelectionStartMeasure: number | null;
  isPlaying: boolean;
  isCountingIn: boolean;
  elapsedMs: number;
  countInElapsedMs: number;
  timeSignature: TimeSignature;
}

interface MeasureRange {
  startMeasure: number;
  endMeasure: number;
}

interface UseScorePlaybackDerivedResult {
  windows: MeasureWindow[];
  totalMeasures: number;
  practiceRange: MeasureRange;
  sectionStartIndex: number;
  sectionEndIndex: number;
  sectionStartMs: number;
  sectionEndMs: number;
  isImmersive: boolean;
  draftPracticeRange: MeasureRange;
  totalPlaybackSteps: number;
  countInWindow: MeasureWindow | null;
  countInMetronomeWindows: MeasureWindow[];
  countInDurationMs: number;
  positionHighlight: PlayheadHighlight | null;
  selectionHighlight: PlayheadHighlight | null;
  playbackStepIndex: number;
  activePlaybackSignature: TimeSignature;
  activeBeatIndex: number | null;
  displayMeasureNumber: number;
}

export function useScorePlaybackDerived({
  snapshot,
  bpm,
  tempoChanges,
  startMeasure,
  endMeasure,
  settingsDraft,
  currentMeasureIndex,
  rangeSelectionStartMeasure,
  isPlaying,
  isCountingIn,
  elapsedMs,
  countInElapsedMs,
  timeSignature,
}: UseScorePlaybackDerivedParams): UseScorePlaybackDerivedResult {
  const windows = useMemo(
    () => buildMeasureWindows(snapshot.timings, snapshot.playbackSequence, bpm, tempoChanges),
    [snapshot.timings, snapshot.playbackSequence, bpm, tempoChanges],
  );

  const totalMeasures = Math.max(snapshot.timings.length, 1);

  const practiceRange = useMemo(
    () => clampMeasureRange(startMeasure, endMeasure, totalMeasures),
    [startMeasure, endMeasure, totalMeasures],
  );

  const sectionStartIndex = practiceRange.startMeasure - 1;
  const sectionEndIndex = practiceRange.endMeasure - 1;

  const { startMs: sectionStartMs, endMs: sectionEndMs } = useMemo(
    () => getSectionPlaybackBounds(windows, sectionStartIndex, sectionEndIndex),
    [windows, sectionStartIndex, sectionEndIndex],
  );

  const isImmersive = isPlaying || isCountingIn;

  const draftPracticeRange = useMemo(
    () =>
      clampMeasureRange(settingsDraft.startMeasure, settingsDraft.endMeasure, totalMeasures),
    [settingsDraft.startMeasure, settingsDraft.endMeasure, totalMeasures],
  );

  const totalPlaybackSteps = Math.max(snapshot.playbackSequence.length, 1);

  const countInWindow = useMemo(() => {
    if (windows.length === 0) return null;
    return (
      windows.find((window) => window.measureIndex === currentMeasureIndex) ?? windows[0]
    );
  }, [windows, currentMeasureIndex]);

  const countInMetronomeWindows = useMemo(() => {
    if (!countInWindow) return [];
    return [{ ...countInWindow, startMs: 0, playbackStepIndex: 0 }];
  }, [countInWindow]);

  const countInDurationMs = countInWindow ? getCountInDurationMs(countInWindow) : 0;

  const highlightElapsedMs = useMemo(() => {
    if (isCountingIn) {
      return getElapsedMsForMeasure(windows, currentMeasureIndex);
    }
    return elapsedMs;
  }, [isCountingIn, windows, currentMeasureIndex, elapsedMs]);

  const playheadHighlightLookup = useMemo(
    () => createPlayheadHighlightLookup(snapshot.measureLayoutsInContainer, windows),
    [snapshot.measureLayoutsInContainer, windows],
  );

  const positionHighlight = useMemo(
    () =>
      computePlayheadHighlight(
        snapshot.measureLayoutsInContainer,
        windows,
        highlightElapsedMs,
        playheadHighlightLookup,
      ),
    [snapshot.measureLayoutsInContainer, windows, highlightElapsedMs, playheadHighlightLookup],
  );

  const selectionHighlight = useMemo(() => {
    if (rangeSelectionStartMeasure === null) return null;
    if (snapshot.measureLayoutsInContainer.length === 0 || windows.length === 0) return null;

    const measureIndex = rangeSelectionStartMeasure - 1;
    const selectionElapsedMs = getElapsedMsForMeasure(windows, measureIndex);
    return computePlayheadHighlight(
      snapshot.measureLayoutsInContainer,
      windows,
      selectionElapsedMs,
      playheadHighlightLookup,
    );
  }, [rangeSelectionStartMeasure, snapshot.measureLayoutsInContainer, windows, playheadHighlightLookup]);

  const playbackStepIndex = useMemo(
    () => getPlaybackStepByElapsed(windows, highlightElapsedMs),
    [windows, highlightElapsedMs],
  );

  const activePlaybackSignature = useMemo(() => {
    const activeWindow = windows[playbackStepIndex];
    if (!activeWindow) return timeSignature;
    return {
      beatsPerMeasure: activeWindow.beatsPerMeasure,
      beatType: activeWindow.beatType,
    };
  }, [windows, playbackStepIndex, timeSignature]);

  const activeBeatIndex = useMemo(() => {
    if (!(isPlaying || isCountingIn)) return null;
    const metronomeContext = getMetronomeBeatContext(
      isCountingIn ? countInMetronomeWindows : windows,
      isCountingIn ? countInElapsedMs : elapsedMs,
      bpm,
      isCountingIn
        ? (countInWindow?.beatsPerMeasure ?? activePlaybackSignature.beatsPerMeasure)
        : activePlaybackSignature.beatsPerMeasure,
    );
    return metronomeContext.beatInMeasure;
  }, [
    windows,
    countInMetronomeWindows,
    countInWindow,
    isPlaying,
    isCountingIn,
    countInElapsedMs,
    elapsedMs,
    bpm,
    activePlaybackSignature.beatsPerMeasure,
  ]);

  const displayMeasureNumber = useMemo(() => {
    const timing = snapshot.timings[currentMeasureIndex];
    return timing?.measureNumber ?? currentMeasureIndex + 1;
  }, [snapshot.timings, currentMeasureIndex]);

  return {
    windows,
    totalMeasures,
    practiceRange,
    sectionStartIndex,
    sectionEndIndex,
    sectionStartMs,
    sectionEndMs,
    isImmersive,
    draftPracticeRange,
    totalPlaybackSteps,
    countInWindow,
    countInMetronomeWindows,
    countInDurationMs,
    positionHighlight,
    selectionHighlight,
    playbackStepIndex,
    activePlaybackSignature,
    activeBeatIndex,
    displayMeasureNumber,
  };
}
