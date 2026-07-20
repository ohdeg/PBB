import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { AutoScrollMode } from '../constants/userPreferences';
import type { BeatStrengthLevel } from '../utils/beatStrength';
import type { BeatSubdivisionId } from '../utils/beatSubdivision';
import { collectMetronomeClickEvents } from '../utils/metronomeBeatEvents';
import type { MetronomeAudio } from '../utils/metronomeAudio';
import type { MeasureLayoutInContainer, MeasureWindow } from '../utils/measureTiming';
import {
  getLineIndexForMeasure,
  getMeasureIndexByElapsed,
  getTotalDurationMs,
  groupMeasureLayoutsByLine,
} from '../utils/measureTiming';
import {
  cancelScrollAnimation,
  resetScrollAnchorCache,
  scrollToAnchoredMeasure,
} from '../utils/scrollAnchor';

interface PlaybackMetronomeParams {
  enabled: boolean;
  windows: MeasureWindow[];
  bpm: number;
  beatsPerMeasure: number;
  beatStrengths: BeatStrengthLevel[];
  beatSubdivisions: BeatSubdivisionId[];
}

interface ScoreAutoScrollerProps {
  isPlaying: boolean;
  windows: MeasureWindow[];
  measureOffsets: number[];
  measureLayouts: MeasureLayoutInContainer[];
  autoScrollEnabled: boolean;
  autoScrollMode: AutoScrollMode;
  scrollBehavior: ScrollBehavior;
  initialElapsedMs?: number;
  playbackEndMs?: number;
  syncKey?: number;
  playbackAnchorMsRef?: RefObject<number | null>;
  playbackMetronomeRef?: RefObject<PlaybackMetronomeParams>;
  metronomeRef?: RefObject<MetronomeAudio | null>;
  onElapsedMsChange?: (elapsedMs: number) => void;
  onMeasureIndexChange?: (measureIndex: number) => void;
}

interface ScrollDecision {
  shouldScroll: boolean;
  unitIndex: number;
  targetY?: number;
}

const PLAYBACK_STATE_PUBLISH_INTERVAL_MS = 50;

function getViewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}

function getLineScrollTargetY(
  lineIndex: number,
  measureLayouts: MeasureLayoutInContainer[],
  measureOffsets: number[],
  fallbackMeasureIndex: number,
): number | undefined {
  const lines = groupMeasureLayoutsByLine(measureLayouts);
  const lineLayouts = lines[lineIndex];

  if (!lineLayouts || lineLayouts.length === 0) {
    return measureOffsets[fallbackMeasureIndex];
  }

  const lineStartMeasureIndex = lineLayouts.reduce(
    (earliest, layout) => (layout.measureIndex < earliest ? layout.measureIndex : earliest),
    lineLayouts[0].measureIndex,
  );

  return measureOffsets[lineStartMeasureIndex] ?? measureOffsets[fallbackMeasureIndex];
}

function shouldScrollByLine(
  measureIndex: number,
  measureLayouts: MeasureLayoutInContainer[],
  measureOffsets: number[],
  lastScrolledUnitIndex: number,
): ScrollDecision {
  if (measureLayouts.length === 0) {
    const targetY = measureOffsets[measureIndex];
    if (targetY === undefined) {
      return { shouldScroll: false, unitIndex: -1 };
    }

    const previousY =
      lastScrolledUnitIndex >= 0 ? measureOffsets[lastScrolledUnitIndex] : null;
    if (previousY !== null && targetY === previousY) {
      return { shouldScroll: false, unitIndex: lastScrolledUnitIndex };
    }

    return { shouldScroll: true, unitIndex: measureIndex, targetY };
  }

  const lineIndex = getLineIndexForMeasure(measureIndex, measureLayouts);
  if (lineIndex < 0) {
    return { shouldScroll: false, unitIndex: -1 };
  }

  if (lineIndex === lastScrolledUnitIndex) {
    return { shouldScroll: false, unitIndex: lineIndex };
  }

  const targetY = getLineScrollTargetY(lineIndex, measureLayouts, measureOffsets, measureIndex);
  if (targetY === undefined) {
    return { shouldScroll: false, unitIndex: lineIndex };
  }

  return { shouldScroll: true, unitIndex: lineIndex, targetY };
}

function shouldScrollByPage(
  measureIndex: number,
  measureOffsets: number[],
  lastScrolledUnitIndex: number,
): ScrollDecision {
  const measureY = measureOffsets[measureIndex];
  if (measureY === undefined) {
    return { shouldScroll: false, unitIndex: -1 };
  }

  const pageHeight = Math.max(getViewportHeight(), 1);
  const pageIndex = Math.floor(measureY / pageHeight);

  if (pageIndex === lastScrolledUnitIndex) {
    return { shouldScroll: false, unitIndex: pageIndex };
  }

  const pageTopY = pageIndex * pageHeight;
  return {
    shouldScroll: true,
    unitIndex: pageIndex,
    targetY: pageTopY,
  };
}

function shouldAutoScroll(
  measureIndex: number,
  measureLayouts: MeasureLayoutInContainer[],
  measureOffsets: number[],
  lastScrolledUnitIndex: number,
  autoScrollMode: AutoScrollMode,
): ScrollDecision {
  if (autoScrollMode === 'page') {
    return shouldScrollByPage(measureIndex, measureOffsets, lastScrolledUnitIndex);
  }

  return shouldScrollByLine(measureIndex, measureLayouts, measureOffsets, lastScrolledUnitIndex);
}

function fireMetronomeRange(
  params: PlaybackMetronomeParams,
  metronome: MetronomeAudio | null,
  firedKeys: Set<string>,
  fromMs: number,
  toMs: number,
): number {
  if (!params.enabled || !metronome || toMs <= fromMs) {
    return toMs;
  }

  const events = collectMetronomeClickEvents(
    params.windows,
    fromMs,
    toMs,
    params.bpm,
    params.beatsPerMeasure,
    params.beatStrengths,
    params.beatSubdivisions,
  );

  for (const event of events) {
    if (firedKeys.has(event.slotKey)) continue;
    metronome.playClick(event.strength);
    firedKeys.add(event.slotKey);
  }

  return toMs;
}

export default function ScoreAutoScroller({
  isPlaying,
  windows,
  measureOffsets,
  measureLayouts,
  autoScrollEnabled,
  autoScrollMode,
  scrollBehavior,
  initialElapsedMs = 0,
  playbackEndMs,
  syncKey = 0,
  playbackAnchorMsRef,
  playbackMetronomeRef,
  metronomeRef,
  onElapsedMsChange,
  onMeasureIndexChange,
}: ScoreAutoScrollerProps) {
  const frameIdRef = useRef<number | null>(null);
  const lastScrolledUnitIndexRef = useRef<number>(-1);
  const initialElapsedMsRef = useRef(initialElapsedMs);
  const metronomeCursorRef = useRef(initialElapsedMs + 1);
  const metronomeFiredKeysRef = useRef<Set<string>>(new Set());
  const lastPublishedElapsedMsRef = useRef<number>(initialElapsedMs);
  const lastPublishedMeasureIndexRef = useRef<number>(-1);

  initialElapsedMsRef.current = initialElapsedMs;

  const totalDurationMs = useMemo(() => getTotalDurationMs(windows), [windows]);
  const playbackLimitMs = playbackEndMs ?? totalDurationMs;

  useEffect(() => {
    if (!isPlaying) {
      cancelScrollAnimation();
      resetScrollAnchorCache();
    }
  }, [isPlaying]);

  useEffect(() => {
    lastScrolledUnitIndexRef.current = -1;
    resetScrollAnchorCache();
    metronomeFiredKeysRef.current.clear();
    metronomeCursorRef.current = initialElapsedMsRef.current + 1;
    lastPublishedElapsedMsRef.current = initialElapsedMsRef.current;
    lastPublishedMeasureIndexRef.current = -1;
  }, [syncKey]);

  useEffect(() => {
    if (!autoScrollEnabled || measureOffsets.length === 0 || !isPlaying) return;

    const measureIndex = getMeasureIndexByElapsed(windows, initialElapsedMsRef.current);
    const scrollDecision = shouldAutoScroll(
      measureIndex,
      measureLayouts,
      measureOffsets,
      -1,
      autoScrollMode,
    );

    if (scrollDecision.shouldScroll && scrollDecision.targetY !== undefined) {
      lastScrolledUnitIndexRef.current = scrollDecision.unitIndex;
      scrollToAnchoredMeasure(scrollDecision.targetY, scrollBehavior, {
        lockAnchor: true,
        anchorRatio: autoScrollMode === 'page' ? 0 : undefined,
      });
      return;
    }

    if (scrollDecision.unitIndex >= 0) {
      lastScrolledUnitIndexRef.current = scrollDecision.unitIndex;
    }
  }, [syncKey, isPlaying, autoScrollEnabled, autoScrollMode, scrollBehavior]);

  useEffect(() => {
    if (!isPlaying) {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
      return;
    }

    const playbackStartElapsedMs = initialElapsedMsRef.current;
    const playbackAnchorMs = playbackAnchorMsRef?.current ?? performance.now();
    const publishPlaybackState = (elapsedMs: number, measureIndex: number, force = false) => {
      if (
        force ||
        elapsedMs - lastPublishedElapsedMsRef.current >= PLAYBACK_STATE_PUBLISH_INTERVAL_MS
      ) {
        onElapsedMsChange?.(elapsedMs);
        lastPublishedElapsedMsRef.current = elapsedMs;
      }

      if (force || measureIndex !== lastPublishedMeasureIndexRef.current) {
        onMeasureIndexChange?.(measureIndex);
        lastPublishedMeasureIndexRef.current = measureIndex;
      }
    };

    const tick = (time: number) => {
      const elapsedMs = Math.min(
        playbackLimitMs,
        playbackStartElapsedMs + Math.max(0, time - playbackAnchorMs),
      );

      const metronomeParams = playbackMetronomeRef?.current;
      if (metronomeParams) {
        metronomeCursorRef.current = fireMetronomeRange(
          metronomeParams,
          metronomeRef?.current ?? null,
          metronomeFiredKeysRef.current,
          metronomeCursorRef.current,
          elapsedMs,
        );
      }

      const measureIndex = getMeasureIndexByElapsed(windows, elapsedMs);
      publishPlaybackState(elapsedMs, measureIndex, elapsedMs >= playbackLimitMs);

      if (autoScrollEnabled) {
        const scrollDecision = shouldAutoScroll(
          measureIndex,
          measureLayouts,
          measureOffsets,
          lastScrolledUnitIndexRef.current,
          autoScrollMode,
        );

        if (scrollDecision.shouldScroll && scrollDecision.targetY !== undefined) {
          lastScrolledUnitIndexRef.current = scrollDecision.unitIndex;
          requestAnimationFrame(() => {
            scrollToAnchoredMeasure(scrollDecision.targetY!, scrollBehavior, {
              lockAnchor: true,
              anchorRatio: autoScrollMode === 'page' ? 0 : undefined,
            });
          });
        }
      }

      if (elapsedMs < playbackLimitMs) {
        frameIdRef.current = requestAnimationFrame(tick);
      }
    };

    frameIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
    };
  }, [
    isPlaying,
    syncKey,
    windows,
    totalDurationMs,
    playbackLimitMs,
    onElapsedMsChange,
    onMeasureIndexChange,
    autoScrollEnabled,
    autoScrollMode,
    scrollBehavior,
    measureOffsets,
    measureLayouts,
    playbackAnchorMsRef,
    playbackMetronomeRef,
    metronomeRef,
  ]);

  return null;
}
