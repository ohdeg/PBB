import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import OsmdViewer, { type ScoreRenderSnapshot } from './components/OsmdViewer';
import ScoreAutoScroller from './components/ScoreAutoScroller';
import ScoreMetronome from './components/ScoreMetronome';
import MetronomeBeatIndicator from './components/MetronomeBeatIndicator';
import FloatingPlaybackButton from './components/FloatingPlaybackButton';
import ScrollToTopTapZone from './components/ScrollToTopTapZone';
import ScoreAnnotationToolbar, {
  dispatchAnnotationClear,
  dispatchAnnotationUndo,
} from './components/ScoreAnnotationToolbar';
import FloatingSettingsPanel from './components/FloatingSettingsPanel';
import PlaybackControls from './components/PlaybackControls';
import { FirstUseGuide } from './ui/FirstUseGuide';
import { useTranslation } from './i18n/LanguageContext';
import {
  clampMeasureRange,
  getElapsedMsForMeasure,
  parseTimeSignatureFromMusicXml,
} from './utils/measureTiming';
import { collectMetronomeClickEvents } from './utils/metronomeBeatEvents';
import {
  DEFAULT_BEAT_SUBDIVISION,
  getSubdivisionPattern,
  type BeatSubdivisionId,
} from './utils/beatSubdivision';
import type { BeatStrengthLevel } from './utils/beatStrength';
import { resizeBeatStrengths } from './utils/beatStrength';
import type { MeasureWindow } from './utils/measureTiming';
import { resizeBeatSubdivisions } from './utils/beatSubdivision';
import { MetronomeAudio } from './utils/metronomeAudio';
import { cancelScrollAnimation, scrollToAnchoredMeasure } from './utils/scrollAnchor';
import { fetchScoreMusicXml } from './utils/scoreLoader';
import { resolveErrorMessage } from './utils/resolveErrorMessage';
import { clampTransposeSemitones } from './utils/transpose';
import { isIpadLikeDevice } from './utils/platform';
import {
  normalizeTempoChanges,
  type TempoChange,
} from './types/tempoChange';
import type { AnnotationBrushSizes, AnnotationToolMode } from './types/scoreAnnotation';
import {
  createPracticeSettingsDraft,
  type PracticeSettingsDraft,
} from './types/scorePractice';
import {
  loadAnnotationBrushSizes,
  normalizeAnnotationBrushSizes,
  saveAnnotationBrushSizes,
} from './constants/annotationBrush';
import { useScorePlaybackController } from './hooks/useScorePlaybackController';
import { useScorePlaybackDerived } from './hooks/useScorePlaybackDerived';

interface ScoreViewerProps {
  scoreId: string;
}

const BPM_STORAGE_KEY = 'music-viewer:last-bpm';
const MEASURES_PER_LINE_STORAGE_KEY = 'music-viewer:last-measures-per-line';
const SCORE_VIEWER_GUIDE_SEEN_KEY = 'music-viewer:guide:score-viewer-seen';
const USER_SCROLL_INTERRUPT_TOUCH_THRESHOLD_PX = 10;

export function ScoreViewer({ scoreId }: ScoreViewerProps) {
  const t = useTranslation();
  const [musicXml, setMusicXml] = useState<string>('');
  const [snapshot, setSnapshot] = useState<ScoreRenderSnapshot>({
    timings: [],
    playbackSequence: [],
    measureOffsets: [],
    measureLayoutsInContainer: [],
  });
  const [startMeasure, setStartMeasure] = useState<number>(1);
  const [endMeasure, setEndMeasure] = useState<number>(1);
  const [isRepeatMode, setIsRepeatMode] = useState<boolean>(false);
  const [playbackSyncKey, setPlaybackSyncKey] = useState<number>(0);
  const [isCountingIn, setIsCountingIn] = useState<boolean>(false);
  const [countInElapsedMs, setCountInElapsedMs] = useState<number>(0);
  const [hasPlaybackEnded, setHasPlaybackEnded] = useState<boolean>(false);
  const countInFrameRef = useRef<number | null>(null);
  const playbackStartIndexRef = useRef<number>(0);
  const metronomeRef = useRef<MetronomeAudio | null>(null);
  const countInFiredKeysRef = useRef<Set<string>>(new Set());
  const playbackAnchorMsRef = useRef<number | null>(null);
  const playbackMetronomeRef = useRef<{
    enabled: boolean;
    windows: MeasureWindow[];
    bpm: number;
    beatsPerMeasure: number;
    beatStrengths: BeatStrengthLevel[];
    beatSubdivisions: BeatSubdivisionId[];
  }>({
    enabled: false,
    windows: [],
    bpm: 120,
    beatsPerMeasure: 4,
    beatStrengths: [],
    beatSubdivisions: [],
  });
  const countInAudioRef = useRef<{
    enabled: boolean;
    windows: MeasureWindow[];
    bpm: number;
    beatsPerMeasure: number;
    beatStrengths: BeatStrengthLevel[];
    beatSubdivisions: BeatSubdivisionId[];
    countInDurationMs: number;
    downbeatStrength: BeatStrengthLevel;
    downbeatSubdivision: BeatSubdivisionId;
  }>({
    enabled: false,
    windows: [],
    bpm: 120,
    beatsPerMeasure: 4,
    beatStrengths: [],
    beatSubdivisions: [],
    countInDurationMs: 0,
    downbeatStrength: 'strong',
    downbeatSubdivision: DEFAULT_BEAT_SUBDIVISION,
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingPrefs, setIsSavingPrefs] = useState<boolean>(false);
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null);
  const [transposeSemitones, setTransposeSemitones] = useState<number>(0);
  const [tempoChanges, setTempoChanges] = useState<TempoChange[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsDraft, setSettingsDraft] = useState<PracticeSettingsDraft>(() =>
    createPracticeSettingsDraft({
      bpm: 120,
      beatsPerMeasure: 4,
      beatType: 4,
      measuresPerLine: 4,
      isAutoScroll: true,
      isMetronomeEnabled: true,
      isMeasureHighlightEnabled: true,
      startMeasure: 1,
      endMeasure: 1,
      isRepeatMode: false,
      transposeSemitones: 0,
      beatStrengths: [],
      beatSubdivisions: [],
      tempoChanges: [],
    }),
  );
  const [rangeSelectionStartMeasure, setRangeSelectionStartMeasure] = useState<number | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [annotationTool, setAnnotationTool] = useState<AnnotationToolMode>('none');
  const [annotationBrushSizes, setAnnotationBrushSizes] = useState<AnnotationBrushSizes>(() =>
    loadAnnotationBrushSizes(),
  );

  const isIpad = isIpadLikeDevice();
  const isAnnotationToolActive = annotationTool !== 'none';

  const {
    bpm,
    beatsPerMeasure,
    beatType,
    isPlaying,
    elapsedMs,
    currentMeasureIndex,
    isAutoScroll,
    isMetronomeEnabled,
    isMeasureHighlightEnabled,
    measuresPerLine,
    scrollSmoothing,
    autoScrollMode,
    beatStrengths,
    beatSubdivisions,
    setBpm,
    setTimeSignature,
    setPlaying,
    setElapsedMs,
    setCurrentMeasureIndex,
    setAutoScroll,
    setMetronomeEnabled,
    setMeasureHighlightEnabled,
    setMeasuresPerLine,
    setBeatStrengthAt,
    setBeatSubdivisionAt,
    resetPlayback,
  } = useScorePlaybackController();

  const timeSignature = useMemo(
    () => ({ beatsPerMeasure, beatType }),
    [beatsPerMeasure, beatType],
  );

  const draftTimeSignature = useMemo(
    () => ({
      beatsPerMeasure: settingsDraft.beatsPerMeasure,
      beatType: settingsDraft.beatType,
    }),
    [settingsDraft.beatsPerMeasure, settingsDraft.beatType],
  );

  useEffect(() => {
    if (!isSettingsOpen) return;
    setRangeSelectionStartMeasure(null);
    setSettingsDraft(
      createPracticeSettingsDraft({
        bpm,
        beatsPerMeasure,
        beatType,
        measuresPerLine,
        isAutoScroll,
        isMetronomeEnabled,
        isMeasureHighlightEnabled,
        startMeasure,
        endMeasure,
        isRepeatMode,
        transposeSemitones,
        beatStrengths,
        beatSubdivisions,
        tempoChanges,
      }),
    );
  }, [
    isSettingsOpen,
    bpm,
    beatsPerMeasure,
    beatType,
    measuresPerLine,
    isAutoScroll,
    isMetronomeEnabled,
    isMeasureHighlightEnabled,
    startMeasure,
    endMeasure,
    isRepeatMode,
    transposeSemitones,
    beatStrengths,
    beatSubdivisions,
    tempoChanges,
  ]);

  const applyMusicXml = useCallback(
    (xmlText: string) => {
      setMusicXml(xmlText);
      resetPlayback();
      setIsCountingIn(false);
      setHasPlaybackEnded(false);
      setStartMeasure(1);
      setEndMeasure(1);
      setIsRepeatMode(false);
      setPlaybackSyncKey(0);
      setTransposeSemitones(0);
      setTempoChanges([]);
      setRangeSelectionStartMeasure(null);
      setError(null);
    },
    [resetPlayback],
  );

  useEffect(() => {
    if (!localStorage.getItem(SCORE_VIEWER_GUIDE_SEEN_KEY)) {
      setIsGuideOpen(true);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const savedBpm = Number(localStorage.getItem(BPM_STORAGE_KEY));
        const savedMeasuresPerLine = Number(localStorage.getItem(MEASURES_PER_LINE_STORAGE_KEY));
        const xmlText = await fetchScoreMusicXml(scoreId);
        applyMusicXml(xmlText);
        if (Number.isFinite(savedBpm) && savedBpm > 0) {
          setBpm(savedBpm);
        }
        if (Number.isFinite(savedMeasuresPerLine) && savedMeasuresPerLine > 0) {
          setMeasuresPerLine(savedMeasuresPerLine);
        }
      } catch (loadError) {
        console.error('악보 로드 실패:', loadError);
        setError(resolveErrorMessage(t, loadError, 'viewer.loadFailed'));
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [scoreId, applyMusicXml, setBpm, setMeasuresPerLine]);

  const handleCloseGuide = useCallback(() => {
    localStorage.setItem(SCORE_VIEWER_GUIDE_SEEN_KEY, '1');
    setIsGuideOpen(false);
  }, []);

  useEffect(() => {
    if (!musicXml.trim()) return;
    setTimeSignature(parseTimeSignatureFromMusicXml(musicXml));
  }, [musicXml, setTimeSignature]);

  const {
    windows,
    totalMeasures,
    practiceRange,
    sectionStartIndex,
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
  } = useScorePlaybackDerived({
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
  });

  useEffect(() => {
    if (totalMeasures <= 0) return;
    setEndMeasure((previous) => {
      if (previous <= 1 || previous > totalMeasures) {
        return totalMeasures;
      }
      return previous;
    });
  }, [totalMeasures, scoreId]);

  countInAudioRef.current = {
    enabled: isMetronomeEnabled,
    windows: countInMetronomeWindows,
    bpm,
    beatsPerMeasure: Math.max(countInWindow?.beatsPerMeasure ?? beatsPerMeasure, 1),
    beatStrengths,
    beatSubdivisions,
    countInDurationMs,
    downbeatStrength: beatStrengths[0] ?? 'strong',
    downbeatSubdivision: beatSubdivisions[0] ?? DEFAULT_BEAT_SUBDIVISION,
  };

  playbackMetronomeRef.current = {
    enabled: isMetronomeEnabled,
    windows,
    bpm,
    beatsPerMeasure,
    beatStrengths,
    beatSubdivisions,
  };

  useEffect(() => {
    metronomeRef.current = new MetronomeAudio();
    return () => {
      metronomeRef.current?.dispose();
      metronomeRef.current = null;
    };
  }, [scoreId]);

  useEffect(() => {
    if (!isCountingIn) {
      if (countInFrameRef.current !== null) {
        cancelAnimationFrame(countInFrameRef.current);
        countInFrameRef.current = null;
      }
      setCountInElapsedMs(0);
      return;
    }

    countInFiredKeysRef.current.clear();
    let prevProgress = 0;

    const countInStartTime = performance.now();
    const tick = (now: number) => {
      const countInProgress = now - countInStartTime;
      setCountInElapsedMs(countInProgress);

      // Fire the count-in clicks directly on the animation-frame clock so they
      // are not subject to React render latency (which varies, especially at
      // the count-in → playback transition).
      const params = countInAudioRef.current;
      const metronome = metronomeRef.current;
      if (params.enabled && metronome && params.windows.length > 0) {
        const rangeEnd = Math.min(countInProgress, params.countInDurationMs - 0.5);
        if (rangeEnd > prevProgress) {
          const events = collectMetronomeClickEvents(
            params.windows,
            prevProgress,
            rangeEnd,
            params.bpm,
            params.beatsPerMeasure,
            params.beatStrengths,
            params.beatSubdivisions,
          );
          for (const event of events) {
            if (countInFiredKeysRef.current.has(event.slotKey)) continue;
            metronome.playClick(event.strength);
            countInFiredKeysRef.current.add(event.slotKey);
          }
        }
      }
      prevProgress = countInProgress;

      if (countInProgress >= countInDurationMs) {
        const measureStartMs = getElapsedMsForMeasure(windows, currentMeasureIndex);
        const playbackAnchorMs = performance.now();
        playbackAnchorMsRef.current = playbackAnchorMs;

        // Play the first downbeat onset on the same clock as the count-in so
        // the last prep beat → downbeat → second beat spacing stays even.
        if (params.enabled && metronome) {
          const downbeatPattern = getSubdivisionPattern(params.downbeatSubdivision);
          const onsetSlot = downbeatPattern.slots.find((slot) => slot.offset === 0);
          if (onsetSlot?.play) {
            metronome.playClick(params.downbeatStrength);
          }
        }

        setIsCountingIn(false);
        setCountInElapsedMs(0);
        setElapsedMs(measureStartMs);
        setPlaying(true);
        setPlaybackSyncKey((previous) => previous + 1);
        return;
      }

      countInFrameRef.current = requestAnimationFrame(tick);
    };

    countInFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (countInFrameRef.current !== null) {
        cancelAnimationFrame(countInFrameRef.current);
        countInFrameRef.current = null;
      }
    };
  }, [isCountingIn, countInDurationMs, windows, currentMeasureIndex, setElapsedMs, setPlaying]);

  const beginCountInAtMeasure = useCallback(
    (measureIndex: number) => {
      setHasPlaybackEnded(false);
      const maxMeasureIndex = Math.max(snapshot.timings.length - 1, 0);
      const clampedIndex = Math.max(0, Math.min(measureIndex, maxMeasureIndex));
      const measureStartMs = getElapsedMsForMeasure(windows, clampedIndex);

      setCurrentMeasureIndex(clampedIndex);
      setElapsedMs(measureStartMs);
      setPlaybackSyncKey((previous) => previous + 1);
      playbackStartIndexRef.current = clampedIndex;

      const measureOffset = snapshot.measureOffsets[clampedIndex];
      if (measureOffset !== undefined) {
        scrollToAnchoredMeasure(measureOffset, scrollSmoothing);
      }
      setIsCountingIn(true);
    },
    [
      windows,
      snapshot.measureOffsets,
      snapshot.timings.length,
      scrollSmoothing,
      setCurrentMeasureIndex,
      setElapsedMs,
    ],
  );

  const beginCountInAtSectionStart = useCallback(() => {
    beginCountInAtMeasure(sectionStartIndex);
  }, [beginCountInAtMeasure, sectionStartIndex]);

  const handlePlayPause = useCallback(() => {
    if (isCountingIn) {
      setIsCountingIn(false);
      playbackAnchorMsRef.current = null;
      return;
    }
    if (isPlaying) {
      setPlaying(false);
      playbackAnchorMsRef.current = null;
      return;
    }
    if (windows.length === 0) return;

    metronomeRef.current?.resume();

    const canCountInFromCurrentMeasure =
      !hasPlaybackEnded &&
      elapsedMs > sectionStartMs + 1 &&
      elapsedMs < sectionEndMs - 1;

    if (canCountInFromCurrentMeasure) {
      beginCountInAtMeasure(currentMeasureIndex);
      return;
    }

    beginCountInAtSectionStart();
  }, [
    isCountingIn,
    isPlaying,
    windows.length,
    hasPlaybackEnded,
    elapsedMs,
    sectionStartMs,
    sectionEndMs,
    currentMeasureIndex,
    beginCountInAtMeasure,
    beginCountInAtSectionStart,
    setPlaying,
  ]);

  const seekToMeasureIndex = useCallback(
    (measureIndex: number) => {
      if (windows.length === 0) return;

      setIsCountingIn(false);
      setHasPlaybackEnded(false);
      const maxMeasureIndex = Math.max(snapshot.timings.length - 1, 0);
      const clampedIndex = Math.max(0, Math.min(measureIndex, maxMeasureIndex));
      const nextElapsedMs = getElapsedMsForMeasure(windows, clampedIndex);

      setPlaying(false);
      setElapsedMs(nextElapsedMs);
      setCurrentMeasureIndex(clampedIndex);
      setPlaybackSyncKey((previous) => previous + 1);

      const measureOffset = snapshot.measureOffsets[clampedIndex];
      if (measureOffset !== undefined) {
        scrollToAnchoredMeasure(measureOffset, scrollSmoothing);
      }
    },
    [
      windows,
      setPlaying,
      setElapsedMs,
      setCurrentMeasureIndex,
      snapshot.measureOffsets,
      snapshot.timings.length,
      scrollSmoothing,
    ],
  );

  const handleMeasureClick = useCallback(
    (measureIndex: number) => {
      if (isPlaying || isCountingIn || isAnnotationToolActive) return;

      const clickedMeasure = measureIndex + 1;
      const isCompletingRangeSelection = rangeSelectionStartMeasure !== null;
      let range: { startMeasure: number; endMeasure: number };

      if (isCompletingRangeSelection) {
        range = clampMeasureRange(
          Math.min(rangeSelectionStartMeasure, clickedMeasure),
          Math.max(rangeSelectionStartMeasure, clickedMeasure),
          totalMeasures,
        );
        setRangeSelectionStartMeasure(null);
      } else {
        range = clampMeasureRange(clickedMeasure, totalMeasures, totalMeasures);
        setRangeSelectionStartMeasure(clickedMeasure);
      }

      setSettingsDraft((previous) => ({
        ...previous,
        startMeasure: range.startMeasure,
        endMeasure: range.endMeasure,
      }));

      if (!isSettingsOpen) {
        setStartMeasure(range.startMeasure);
        setEndMeasure(range.endMeasure);
      }

      const seekIndex = isCompletingRangeSelection ? range.startMeasure - 1 : measureIndex;
      seekToMeasureIndex(seekIndex);
    },
    [
      isPlaying,
      isCountingIn,
      isAnnotationToolActive,
      isSettingsOpen,
      rangeSelectionStartMeasure,
      totalMeasures,
      seekToMeasureIndex,
    ],
  );

  const handleSeekToStartMeasure = useCallback(() => {
    const { startMeasure: clampedStart } = clampMeasureRange(
      settingsDraft.startMeasure,
      settingsDraft.endMeasure,
      totalMeasures,
    );
    setSettingsDraft((previous) => ({ ...previous, startMeasure: clampedStart }));
    seekToMeasureIndex(clampedStart - 1);
  }, [seekToMeasureIndex, totalMeasures, settingsDraft.startMeasure, settingsDraft.endMeasure]);

  const handleResetPracticeRange = useCallback(() => {
    setRangeSelectionStartMeasure(null);
    setSettingsDraft((previous) => ({
      ...previous,
      startMeasure: 1,
      endMeasure: totalMeasures,
    }));
    seekToMeasureIndex(0);
  }, [seekToMeasureIndex, totalMeasures]);

  const handleApplySettings = useCallback(() => {
    const range = clampMeasureRange(
      settingsDraft.startMeasure,
      settingsDraft.endMeasure,
      totalMeasures,
    );

    setBpm(settingsDraft.bpm);
    setTimeSignature({
      beatsPerMeasure: settingsDraft.beatsPerMeasure,
      beatType: settingsDraft.beatType,
    });
    setMeasuresPerLine(settingsDraft.measuresPerLine);
    setAutoScroll(settingsDraft.isAutoScroll);
    setMetronomeEnabled(settingsDraft.isMetronomeEnabled);
    setMeasureHighlightEnabled(settingsDraft.isMeasureHighlightEnabled);
    setStartMeasure(range.startMeasure);
    setEndMeasure(range.endMeasure);
    setIsRepeatMode(settingsDraft.isRepeatMode);
    setTransposeSemitones(settingsDraft.transposeSemitones);
    setTempoChanges(normalizeTempoChanges(settingsDraft.tempoChanges, totalMeasures));

    settingsDraft.beatStrengths.forEach((strength, index) => {
      setBeatStrengthAt(index, strength);
    });
    settingsDraft.beatSubdivisions.forEach((subdivision, index) => {
      setBeatSubdivisionAt(index, subdivision);
    });

    setPlaybackSyncKey((previous) => previous + 1);
    setPrefsMessage(null);
    setRangeSelectionStartMeasure(null);
    setIsSettingsOpen(false);
  }, [
    settingsDraft,
    totalMeasures,
    setBpm,
    setTimeSignature,
    setMeasuresPerLine,
    setAutoScroll,
    setMetronomeEnabled,
    setMeasureHighlightEnabled,
    setBeatStrengthAt,
    setBeatSubdivisionAt,
  ]);

  const handleOsmdSnapshot = useCallback((nextSnapshot: ScoreRenderSnapshot) => {
    setSnapshot(nextSnapshot);
  }, []);

  const handleDraftTransposeDown = useCallback(() => {
    setSettingsDraft((previous) => ({
      ...previous,
      transposeSemitones: clampTransposeSemitones(previous.transposeSemitones - 1),
    }));
  }, []);

  const handleDraftTransposeUp = useCallback(() => {
    setSettingsDraft((previous) => ({
      ...previous,
      transposeSemitones: clampTransposeSemitones(previous.transposeSemitones + 1),
    }));
  }, []);

  const handleDraftTransposeReset = useCallback(() => {
    setSettingsDraft((previous) => ({ ...previous, transposeSemitones: 0 }));
  }, []);

  const handleSavePrefs = async () => {
    setIsSavingPrefs(true);
    setPrefsMessage(null);
    try {
      localStorage.setItem(BPM_STORAGE_KEY, String(settingsDraft.bpm));
      localStorage.setItem(MEASURES_PER_LINE_STORAGE_KEY, String(settingsDraft.measuresPerLine));
      setPrefsMessage(t('viewer.prefsSaved'));
    } catch (saveError) {
      console.error('BPM settings save failed:', saveError);
      setPrefsMessage(t('viewer.prefsSaveFailed'));
    } finally {
      setIsSavingPrefs(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && event.target === document.body) {
        event.preventDefault();
        handlePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause]);

  useEffect(() => {
    if (isPlaying || isCountingIn) {
      setIsSettingsOpen(false);
    }
  }, [isPlaying, isCountingIn]);

  useEffect(() => {
    if (!isPlaying || sectionEndMs <= sectionStartMs) return;
    if (elapsedMs < sectionEndMs - 0.5) return;

    setPlaying(false);
    playbackAnchorMsRef.current = null;

    if (isRepeatMode) {
      metronomeRef.current?.resume();
      beginCountInAtSectionStart();
      return;
    }

    setHasPlaybackEnded(true);
  }, [
    isPlaying,
    elapsedMs,
    sectionStartMs,
    sectionEndMs,
    isRepeatMode,
    beginCountInAtSectionStart,
    setPlaying,
  ]);

  useEffect(() => {
    if (!isImmersive) return;
    document.body.classList.add('score-immersive');
    return () => {
      document.body.classList.remove('score-immersive');
    };
  }, [isImmersive]);

  const stopPlaybackForUserScroll = useCallback(() => {
    cancelScrollAnimation();
    playbackAnchorMsRef.current = null;

    if (countInFrameRef.current !== null) {
      cancelAnimationFrame(countInFrameRef.current);
      countInFrameRef.current = null;
    }

    setIsCountingIn(false);
    setPlaying(false);
  }, [setPlaying]);

  useEffect(() => {
    if (!isPlaying && !isCountingIn) return;

    let touchStartY: number | null = null;
    let touchStartX: number | null = null;

    const onWheel = () => {
      stopPlaybackForUserScroll();
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      touchStartY = touch.clientY;
      touchStartX = touch.clientX;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (touchStartY === null || touchStartX === null) return;

      const touch = event.touches[0];
      if (!touch) return;

      const deltaY = Math.abs(touch.clientY - touchStartY);
      const deltaX = Math.abs(touch.clientX - touchStartX);

      if (deltaY >= USER_SCROLL_INTERRUPT_TOUCH_THRESHOLD_PX && deltaY > deltaX) {
        touchStartY = null;
        touchStartX = null;
        stopPlaybackForUserScroll();
      }
    };

    const resetTouch = () => {
      touchStartY = null;
      touchStartX = null;
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', resetTouch, { passive: true });
    window.addEventListener('touchcancel', resetTouch, { passive: true });

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', resetTouch);
      window.removeEventListener('touchcancel', resetTouch);
    };
  }, [isCountingIn, isPlaying, stopPlaybackForUserScroll]);

  useEffect(() => {
    if (!isPlaying && !isCountingIn) return;
    setAnnotationTool('none');
  }, [isPlaying, isCountingIn]);

  useEffect(() => {
    setAnnotationTool('none');
  }, [scoreId]);

  useEffect(() => {
    if (!isIpad || !isAnnotationToolActive) return;

    document.body.classList.add('score-annotation-active');

    const preventDefaultInteraction = (event: Event) => {
      event.preventDefault();
    };

    document.addEventListener('selectstart', preventDefaultInteraction);
    document.addEventListener('contextmenu', preventDefaultInteraction);
    document.addEventListener('dragstart', preventDefaultInteraction);

    return () => {
      document.body.classList.remove('score-annotation-active');
      document.removeEventListener('selectstart', preventDefaultInteraction);
      document.removeEventListener('contextmenu', preventDefaultInteraction);
      document.removeEventListener('dragstart', preventDefaultInteraction);
    };
  }, [isIpad, isAnnotationToolActive]);

  const handleAnnotationClear = useCallback(() => {
    if (!window.confirm(t('viewer.clearAnnotationConfirm'))) return;
    dispatchAnnotationClear(scoreId);
  }, [scoreId, t]);

  const handleAnnotationUndo = useCallback(() => {
    dispatchAnnotationUndo(scoreId);
  }, [scoreId]);

  const handleAnnotationBrushSizeChange = useCallback(
    (toolKey: keyof AnnotationBrushSizes, size: number) => {
      setAnnotationBrushSizes((previous) => {
        const next = normalizeAnnotationBrushSizes({ ...previous, [toolKey]: size });
        saveAnnotationBrushSizes(next);
        return next;
      });
    },
    [],
  );

  return (
    <div className={`score-viewer${isImmersive ? ' score-viewer--immersive' : ''}`}>
      <ScrollToTopTapZone />
      <ScoreAnnotationToolbar
        visible={isIpad && !isLoading && !error && Boolean(musicXml)}
        tool={annotationTool}
        brushSizes={annotationBrushSizes}
        onToolChange={setAnnotationTool}
        onBrushSizeChange={handleAnnotationBrushSizeChange}
        onClear={handleAnnotationClear}
        onUndo={handleAnnotationUndo}
      />
      <FirstUseGuide
        isOpen={isGuideOpen}
        title={t('viewer.guideTitle')}
        description={t('viewer.guideDesc')}
        tips={[
          t('viewer.guideTip1'),
          t('viewer.guideTip2'),
          t('viewer.guideTip3'),
          t('viewer.guideTip4'),
        ]}
        closeLabel={t('viewer.guideClose')}
        onClose={handleCloseGuide}
      />
      {isLoading && <p className="score-viewer-status">{t('viewer.loadingScore')}</p>}
      {error && <p className="score-viewer-error">{error}</p>}

      {!isLoading && !error && musicXml && (
        <>
          <ScoreMetronome
            metronome={metronomeRef.current}
            isPlaying={isPlaying || isCountingIn}
            isCountingIn={isCountingIn}
            usePlaybackClock={isPlaying && !isCountingIn}
            enabled={isMetronomeEnabled}
            bpm={bpm}
            elapsedMs={isCountingIn ? countInElapsedMs : elapsedMs}
            beatsPerMeasure={
              isCountingIn
                ? (countInWindow?.beatsPerMeasure ?? beatsPerMeasure)
                : beatsPerMeasure
            }
            beatStrengths={beatStrengths}
            beatSubdivisions={beatSubdivisions}
            windows={isCountingIn ? countInMetronomeWindows : windows}
          />
          <ScoreAutoScroller
            isPlaying={isPlaying && !isCountingIn}
            windows={windows}
            measureOffsets={snapshot.measureOffsets}
            measureLayouts={snapshot.measureLayoutsInContainer}
            autoScrollEnabled={isAutoScroll}
            autoScrollMode={autoScrollMode}
            scrollBehavior={scrollSmoothing}
            initialElapsedMs={elapsedMs}
            syncKey={playbackSyncKey}
            playbackAnchorMsRef={playbackAnchorMsRef}
            playbackMetronomeRef={playbackMetronomeRef}
            metronomeRef={metronomeRef}
            playbackEndMs={sectionEndMs}
            onElapsedMsChange={setElapsedMs}
            onMeasureIndexChange={setCurrentMeasureIndex}
          />
          <MetronomeBeatIndicator
            visible={isPlaying || isCountingIn}
            beatsPerMeasure={
              isCountingIn
                ? (countInWindow?.beatsPerMeasure ?? activePlaybackSignature.beatsPerMeasure)
                : activePlaybackSignature.beatsPerMeasure
            }
            activeBeatIndex={activeBeatIndex}
            beatStrengths={beatStrengths}
            isCountingIn={isCountingIn}
          />
          {!isImmersive && (
          <>
          <div className="viewer-quick-stats">
            <div className="viewer-quick-stat">
              <span>{t('viewer.statCurrentMeasure')}</span>
              <strong>{displayMeasureNumber}</strong>
            </div>
            <div className="viewer-quick-stat">
              <span>{t('viewer.statProgress')}</span>
              <strong>
                {playbackStepIndex + 1}/{totalPlaybackSteps}
              </strong>
            </div>
            <div className="viewer-quick-stat">
              <span>{t('viewer.statTimeSignature')}</span>
              <strong>
                {activePlaybackSignature.beatsPerMeasure}/{activePlaybackSignature.beatType}
              </strong>
            </div>
            <div className="viewer-quick-stat">
              <span>{t('viewer.statMeasuresPerLine')}</span>
              <strong>{measuresPerLine}</strong>
            </div>
          </div>
          <div className="score-viewer-toolbar">
            <FloatingSettingsPanel
              isOpen={isSettingsOpen}
              onOpen={() => setIsSettingsOpen(true)}
              onClose={() => setIsSettingsOpen(false)}
            >
              <p className="practice-status">
                {t('viewer.statusCurrentMeasure')}: {displayMeasureNumber} · {t('viewer.statusProgress')}{' '}
                {playbackStepIndex + 1}/{totalPlaybackSteps}
                {' · '}
                {t('viewer.statusTimeSignature')}: {activePlaybackSignature.beatsPerMeasure}/
                {activePlaybackSignature.beatType}
                {' · '}
                {t('viewer.statusMeasuresPerLine')}: {measuresPerLine}
                {snapshot.playbackSequence.length > snapshot.timings.length && (
                  <> · {t('viewer.statusWithRepeats')}</>
                )}
                {!isPlaying && !isCountingIn && snapshot.timings.length > 0 && (
                  <>
                    {' '}
                    ·{' '}
                    {t('viewer.statusPracticeRange', {
                      start: practiceRange.startMeasure,
                      end: practiceRange.endMeasure,
                    })}
                    {isRepeatMode ? t('viewer.statusRepeatOn') : ''}
                  </>
                )}
              </p>
              <p className="practice-settings-hint">{t('viewer.settingsApplyHint')}</p>

              <PlaybackControls
                bpm={settingsDraft.bpm}
                timeSignature={draftTimeSignature}
                isPlaying={isPlaying}
                isCountingIn={isCountingIn}
                isAutoScroll={settingsDraft.isAutoScroll}
                isMetronomeEnabled={settingsDraft.isMetronomeEnabled}
                isMeasureHighlightEnabled={settingsDraft.isMeasureHighlightEnabled}
                elapsedMs={elapsedMs}
                currentMeasureIndex={currentMeasureIndex}
                totalMeasures={snapshot.timings.length}
                isSavingPrefs={isSavingPrefs}
                onBpmChange={(value) =>
                  setSettingsDraft((previous) => ({ ...previous, bpm: value }))
                }
                onTimeSignatureChange={(signature) =>
                  setSettingsDraft((previous) => ({
                    ...previous,
                    beatsPerMeasure: signature.beatsPerMeasure,
                    beatType: signature.beatType,
                    beatStrengths: resizeBeatStrengths(
                      previous.beatStrengths,
                      signature.beatsPerMeasure,
                    ),
                    beatSubdivisions: resizeBeatSubdivisions(
                      previous.beatSubdivisions,
                      signature.beatsPerMeasure,
                    ),
                  }))
                }
                onBeatsPerMeasureChange={(beats) =>
                  setSettingsDraft((previous) => ({
                    ...previous,
                    beatsPerMeasure: beats,
                    beatStrengths: resizeBeatStrengths(previous.beatStrengths, beats),
                    beatSubdivisions: resizeBeatSubdivisions(previous.beatSubdivisions, beats),
                  }))
                }
                onBeatTypeChange={(beatTypeValue) =>
                  setSettingsDraft((previous) => ({ ...previous, beatType: beatTypeValue }))
                }
                onTogglePlay={handlePlayPause}
                onAutoScrollChange={(enabled) =>
                  setSettingsDraft((previous) => ({ ...previous, isAutoScroll: enabled }))
                }
                onMetronomeChange={(enabled) =>
                  setSettingsDraft((previous) => ({ ...previous, isMetronomeEnabled: enabled }))
                }
                onMeasureHighlightChange={(enabled) =>
                  setSettingsDraft((previous) => ({
                    ...previous,
                    isMeasureHighlightEnabled: enabled,
                  }))
                }
                measuresPerLine={settingsDraft.measuresPerLine}
                onMeasuresPerLineChange={(value) =>
                  setSettingsDraft((previous) => ({ ...previous, measuresPerLine: value }))
                }
                startMeasure={draftPracticeRange.startMeasure}
                endMeasure={draftPracticeRange.endMeasure}
                isRepeatMode={settingsDraft.isRepeatMode}
                onStartMeasureChange={(measure) =>
                  setSettingsDraft((previous) => ({ ...previous, startMeasure: measure }))
                }
                onEndMeasureChange={(measure) =>
                  setSettingsDraft((previous) => ({ ...previous, endMeasure: measure }))
                }
                onRepeatModeChange={(enabled) =>
                  setSettingsDraft((previous) => ({ ...previous, isRepeatMode: enabled }))
                }
                onSeekToStartMeasure={handleSeekToStartMeasure}
                onResetPracticeRange={handleResetPracticeRange}
                onSavePrefs={() => void handleSavePrefs()}
                onApplySettings={handleApplySettings}
                tempoChanges={settingsDraft.tempoChanges}
                onTempoChangesChange={(changes) =>
                  setSettingsDraft((previous) => ({ ...previous, tempoChanges: changes }))
                }
                transposeSemitones={settingsDraft.transposeSemitones}
                onTransposeDown={handleDraftTransposeDown}
                onTransposeUp={handleDraftTransposeUp}
                onTransposeReset={handleDraftTransposeReset}
                beatStrengths={settingsDraft.beatStrengths}
                beatSubdivisions={settingsDraft.beatSubdivisions}
                onBeatStrengthChange={(beatIndex, strength) =>
                  setSettingsDraft((previous) => {
                    const beatStrengths = [...previous.beatStrengths];
                    if (beatIndex < 0 || beatIndex >= beatStrengths.length) return previous;
                    beatStrengths[beatIndex] = strength;
                    return { ...previous, beatStrengths };
                  })
                }
                onBeatSubdivisionChange={(beatIndex, subdivisionId) =>
                  setSettingsDraft((previous) => {
                    const beatSubdivisions = [...previous.beatSubdivisions];
                    if (beatIndex < 0 || beatIndex >= beatSubdivisions.length) return previous;
                    beatSubdivisions[beatIndex] = subdivisionId;
                    return { ...previous, beatSubdivisions };
                  })
                }
                isBeatHighlightActive={isPlaying || isCountingIn}
                beatHighlightElapsedMs={isCountingIn ? countInElapsedMs : elapsedMs}
                activeBeatIndexOverride={activeBeatIndex}
              />

              {prefsMessage && <p className="practice-message">{prefsMessage}</p>}
            </FloatingSettingsPanel>
          </div>
          </>
          )}

          <div className="score-viewer-canvas-wrap">
            <OsmdViewer
              musicXml={musicXml}
              scoreId={scoreId}
              measuresPerLine={measuresPerLine}
              transposeSemitones={transposeSemitones}
              positionHighlight={positionHighlight}
              selectionHighlight={selectionHighlight}
              showMeasureHighlight={isMeasureHighlightEnabled}
              measureClickEnabled={!isPlaying && !isCountingIn && !isAnnotationToolActive}
              annotationTool={annotationTool}
              annotationBrushSizes={annotationBrushSizes}
              annotationsEnabled={isIpad}
              freezeLayout={isPlaying || isCountingIn}
              onMeasureClick={handleMeasureClick}
              onSnapshot={handleOsmdSnapshot}
            />
          </div>
          <FloatingPlaybackButton
            visible
            isPlaying={isPlaying}
            isCountingIn={isCountingIn}
            currentMeasureIndex={playbackStepIndex}
            totalMeasures={totalPlaybackSteps}
            onTogglePlay={handlePlayPause}
          />
        </>
      )}
    </div>
  );
}
