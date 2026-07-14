import { useEffect, useMemo, useRef } from 'react';
import type { MeasureWindow } from '../utils/measureTiming';
import {
  MEASURE_LINE_THRESHOLD_PX,
  getMeasureIndexByElapsed,
  getTotalDurationMs,
} from '../utils/measureTiming';
import { scrollToAnchoredMeasure } from '../utils/scrollAnchor';

interface ScoreAutoScrollerProps {
  isPlaying: boolean;
  windows: MeasureWindow[];
  measureOffsets: number[];
  autoScrollEnabled: boolean;
  scrollBehavior: ScrollBehavior;
  initialElapsedMs?: number;
  syncKey?: number;
  onElapsedMsChange?: (elapsedMs: number) => void;
  onMeasureIndexChange?: (measureIndex: number) => void;
}

const USER_SCROLL_LOCK_MS = 2500;

function shouldScrollToMeasure(
  measureIndex: number,
  measureOffsets: number[],
  lastScrolledMeasureIndex: number,
  lastScrolledY: number | null,
): boolean {
  const targetY = measureOffsets[measureIndex];
  if (targetY === undefined) return false;
  if (lastScrolledMeasureIndex === measureIndex) return false;

  if (lastScrolledY === null) return true;

  const previousY = measureOffsets[lastScrolledMeasureIndex];
  if (previousY !== undefined && Math.abs(targetY - previousY) <= MEASURE_LINE_THRESHOLD_PX) {
    return false;
  }

  return Math.abs(targetY - lastScrolledY) > MEASURE_LINE_THRESHOLD_PX;
}

export default function ScoreAutoScroller({
  isPlaying,
  windows,
  measureOffsets,
  autoScrollEnabled,
  scrollBehavior,
  initialElapsedMs = 0,
  syncKey = 0,
  onElapsedMsChange,
  onMeasureIndexChange,
}: ScoreAutoScrollerProps) {
  const frameIdRef = useRef<number | null>(null);
  const virtualElapsedRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const lastScrolledMeasureRef = useRef<number>(-1);
  const lastScrolledYRef = useRef<number | null>(null);
  const userScrollLockedRef = useRef(false);
  const userScrollTimerRef = useRef<number | null>(null);

  const totalDurationMs = useMemo(() => getTotalDurationMs(windows), [windows]);

  useEffect(() => {
    if (!isPlaying) return;

    const lockAutoScroll = () => {
      userScrollLockedRef.current = true;
      if (userScrollTimerRef.current !== null) {
        window.clearTimeout(userScrollTimerRef.current);
      }
      userScrollTimerRef.current = window.setTimeout(() => {
        userScrollLockedRef.current = false;
        userScrollTimerRef.current = null;
      }, USER_SCROLL_LOCK_MS);
    };

    window.addEventListener('wheel', lockAutoScroll, { passive: true });
    window.addEventListener('touchmove', lockAutoScroll, { passive: true });

    return () => {
      window.removeEventListener('wheel', lockAutoScroll);
      window.removeEventListener('touchmove', lockAutoScroll);
      if (userScrollTimerRef.current !== null) {
        window.clearTimeout(userScrollTimerRef.current);
        userScrollTimerRef.current = null;
      }
      userScrollLockedRef.current = false;
    };
  }, [isPlaying]);

  useEffect(() => {
    virtualElapsedRef.current = initialElapsedMs;
    lastScrolledMeasureRef.current = -1;
    lastScrolledYRef.current = null;

    if (!autoScrollEnabled || measureOffsets.length === 0) return;

    const measureIndex = getMeasureIndexByElapsed(windows, initialElapsedMs);
    const targetY = measureOffsets[measureIndex];
    if (targetY !== undefined) {
      lastScrolledMeasureRef.current = measureIndex;
      lastScrolledYRef.current = targetY;
      scrollToAnchoredMeasure(targetY, scrollBehavior);
    }
  }, [syncKey, initialElapsedMs, windows, measureOffsets, autoScrollEnabled, scrollBehavior]);

  useEffect(() => {
    if (isPlaying) {
      virtualElapsedRef.current = initialElapsedMs;
    }
  }, [isPlaying, initialElapsedMs]);

  useEffect(() => {
    if (!isPlaying) {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
      lastTickRef.current = null;
      return;
    }

    const tick = (time: number) => {
      const previousTick = lastTickRef.current ?? time;
      const deltaMs = Math.max(0, time - previousTick);
      lastTickRef.current = time;

      const elapsedMs = Math.min(totalDurationMs, virtualElapsedRef.current + deltaMs);
      virtualElapsedRef.current = elapsedMs;

      const measureIndex = getMeasureIndexByElapsed(windows, elapsedMs);
      onElapsedMsChange?.(elapsedMs);
      onMeasureIndexChange?.(measureIndex);

      if (
        autoScrollEnabled &&
        !userScrollLockedRef.current &&
        shouldScrollToMeasure(
          measureIndex,
          measureOffsets,
          lastScrolledMeasureRef.current,
          lastScrolledYRef.current,
        )
      ) {
        const targetY = measureOffsets[measureIndex];
        if (targetY !== undefined) {
          lastScrolledMeasureRef.current = measureIndex;
          lastScrolledYRef.current = targetY;
          scrollToAnchoredMeasure(targetY, scrollBehavior);
        }
      } else if (lastScrolledMeasureRef.current !== measureIndex) {
        lastScrolledMeasureRef.current = measureIndex;
      }

      if (elapsedMs < totalDurationMs) {
        frameIdRef.current = requestAnimationFrame(tick);
      }
    };

    frameIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
      lastTickRef.current = null;
    };
  }, [
    isPlaying,
    windows,
    totalDurationMs,
    onElapsedMsChange,
    onMeasureIndexChange,
    autoScrollEnabled,
    scrollBehavior,
    measureOffsets,
  ]);

  return null;
}
