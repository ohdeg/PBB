// @vitest-environment jsdom

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ScoreRenderSnapshot } from '../components/OsmdViewer'
import type { PracticeSettingsDraft } from '../types/scorePractice'
import { useScorePlaybackDerived } from './useScorePlaybackDerived'

const snapshot: ScoreRenderSnapshot = {
  timings: [
    {
      measureIndex: 0,
      measureNumber: 7,
      divisions: 1,
      durationSum: 4,
      expectedDurationDivisions: 4,
      beatsPerMeasure: 4,
      beatType: 4,
      tempoBpm: 120,
      fermataFactor: 1,
      isPickup: false,
    },
    {
      measureIndex: 1,
      measureNumber: 8,
      divisions: 1,
      durationSum: 3,
      expectedDurationDivisions: 3,
      beatsPerMeasure: 3,
      beatType: 4,
      tempoBpm: 90,
      fermataFactor: 1,
      isPickup: false,
    },
  ],
  playbackSequence: [0, 1],
  measureOffsets: [],
  measureLayoutsInContainer: [],
}

const settingsDraft: PracticeSettingsDraft = {
  bpm: 120,
  beatsPerMeasure: 4,
  beatType: 4,
  measuresPerLine: 4,
  isAutoScroll: true,
  isMetronomeEnabled: true,
  isMeasureHighlightEnabled: true,
  startMeasure: 2,
  endMeasure: 99,
  isRepeatMode: false,
  transposeSemitones: 0,
  beatStrengths: [],
  beatSubdivisions: [],
  tempoChanges: [],
}

describe('useScorePlaybackDerived', () => {
  it('clamps committed and draft ranges to rendered measures', () => {
    const { result } = renderHook(() =>
      useScorePlaybackDerived({
        snapshot,
        bpm: 120,
        tempoChanges: [],
        startMeasure: 0,
        endMeasure: 99,
        settingsDraft,
        currentMeasureIndex: 1,
        rangeSelectionStartMeasure: null,
        isPlaying: false,
        isCountingIn: false,
        elapsedMs: 0,
        countInElapsedMs: 0,
        timeSignature: { beatsPerMeasure: 4, beatType: 4 },
      }),
    )

    expect(result.current.totalMeasures).toBe(2)
    expect(result.current.practiceRange).toEqual({
      startMeasure: 1,
      endMeasure: 2,
    })
    expect(result.current.draftPracticeRange).toEqual({
      startMeasure: 2,
      endMeasure: 2,
    })
    expect(result.current.displayMeasureNumber).toBe(8)
    expect(result.current.activeBeatIndex).toBeNull()
    expect(result.current.countInWindow?.measureIndex).toBe(1)
  })

  it('falls back safely when a score has no rendered measures', () => {
    const emptySnapshot: ScoreRenderSnapshot = {
      timings: [],
      playbackSequence: [],
      measureOffsets: [],
      measureLayoutsInContainer: [],
    }
    const { result } = renderHook(() =>
      useScorePlaybackDerived({
        snapshot: emptySnapshot,
        bpm: 120,
        tempoChanges: [],
        startMeasure: 1,
        endMeasure: 1,
        settingsDraft: { ...settingsDraft, startMeasure: 1, endMeasure: 1 },
        currentMeasureIndex: 0,
        rangeSelectionStartMeasure: 1,
        isPlaying: false,
        isCountingIn: false,
        elapsedMs: 0,
        countInElapsedMs: 0,
        timeSignature: { beatsPerMeasure: 4, beatType: 4 },
      }),
    )

    expect(result.current.totalMeasures).toBe(1)
    expect(result.current.totalPlaybackSteps).toBe(1)
    expect(result.current.windows).toEqual([])
    expect(result.current.countInWindow).toBeNull()
    expect(result.current.countInDurationMs).toBe(0)
    expect(result.current.positionHighlight).toBeNull()
    expect(result.current.selectionHighlight).toBeNull()
  })
})
