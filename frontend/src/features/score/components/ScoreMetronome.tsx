import { useEffect, useRef } from 'react';
import type { BeatStrengthLevel } from '../utils/beatStrength';
import type { BeatSubdivisionId } from '../utils/beatSubdivision';
import type { MeasureWindow } from '../utils/measureTiming';
import { collectMetronomeClickEvents } from '../utils/metronomeBeatEvents';
import { MetronomeAudio } from '../utils/metronomeAudio';

interface ScoreMetronomeProps {
  isPlaying: boolean;
  isCountingIn: boolean;
  enabled: boolean;
  bpm: number;
  elapsedMs: number;
  beatsPerMeasure: number;
  beatStrengths: BeatStrengthLevel[];
  beatSubdivisions: BeatSubdivisionId[];
  windows?: MeasureWindow[];
  metronome?: MetronomeAudio | null;
  usePlaybackClock?: boolean;
}

const fireMetronomeEvents = (
  metronome: MetronomeAudio | null,
  firedSlotKeys: Set<string>,
  events: ReturnType<typeof collectMetronomeClickEvents>,
): void => {
  for (const event of events) {
    if (firedSlotKeys.has(event.slotKey)) continue;
    void metronome?.playClick(event.strength);
    firedSlotKeys.add(event.slotKey);
  }
};

export default function ScoreMetronome({
  isPlaying,
  isCountingIn,
  enabled,
  bpm,
  elapsedMs,
  beatsPerMeasure,
  beatStrengths,
  beatSubdivisions,
  windows = [],
  metronome: sharedMetronome = null,
  usePlaybackClock = false,
}: ScoreMetronomeProps) {
  const internalMetronomeRef = useRef<MetronomeAudio | null>(null);
  const prevElapsedRef = useRef(0);
  const firedSlotKeysRef = useRef<Set<string>>(new Set());
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    if (sharedMetronome) return;
    internalMetronomeRef.current = new MetronomeAudio();
    return () => {
      internalMetronomeRef.current?.dispose();
      internalMetronomeRef.current = null;
    };
  }, [sharedMetronome]);

  useEffect(() => {
    const metronome = sharedMetronome ?? internalMetronomeRef.current;

    // Count-in and playback clicks are scheduled on the animation-frame clock
    // in ScoreViewer / ScoreAutoScroller for tighter timing.
    if (isCountingIn || usePlaybackClock) {
      wasPlayingRef.current = false;
      prevElapsedRef.current = elapsedMs;
      firedSlotKeysRef.current.clear();
      return;
    }

    if (!isPlaying || !enabled) {
      wasPlayingRef.current = false;
      prevElapsedRef.current = elapsedMs;
      firedSlotKeysRef.current.clear();
      return;
    }

    const justStarted = !wasPlayingRef.current;
    wasPlayingRef.current = true;

    const previousElapsed = justStarted ? Math.max(0, elapsedMs) - 0.001 : prevElapsedRef.current;
    const nextElapsed = elapsedMs;

    if (nextElapsed + 0.001 < previousElapsed) {
      firedSlotKeysRef.current.clear();
      const seekFrom = Math.max(0, nextElapsed - 0.001);
      const seekEvents = collectMetronomeClickEvents(
        windows,
        seekFrom,
        nextElapsed,
        bpm,
        beatsPerMeasure,
        beatStrengths,
        beatSubdivisions,
      );
      fireMetronomeEvents(metronome, firedSlotKeysRef.current, seekEvents);
      prevElapsedRef.current = nextElapsed;
      return;
    }

    const events = collectMetronomeClickEvents(
      windows,
      previousElapsed,
      nextElapsed,
      bpm,
      beatsPerMeasure,
      beatStrengths,
      beatSubdivisions,
    );

    fireMetronomeEvents(metronome, firedSlotKeysRef.current, events);
    prevElapsedRef.current = nextElapsed;
  }, [
    sharedMetronome,
    isPlaying,
    isCountingIn,
    usePlaybackClock,
    enabled,
    bpm,
    elapsedMs,
    beatsPerMeasure,
    beatStrengths,
    beatSubdivisions,
    windows,
  ]);

  return null;
}
