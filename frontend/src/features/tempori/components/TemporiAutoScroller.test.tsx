// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import TemporiAutoScroller from './TemporiAutoScroller';
import { MetronomeAudio } from '../utils/metronomeAudio';
import type { BeatStrengthLevel } from '../utils/beatStrength';

afterEach(() => vi.unstubAllGlobals());

it('plays the last beat in the practice range and stops before the next downbeat', () => {
  let frame: FrameRequestCallback;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const windows = [0, 1].map(step => ({
    measureIndex: step, playbackStepIndex: step, startMs: step * 2000, durationMs: 2000,
    tempoBpm: 120, beatsPerMeasure: 4, beatType: 4,
  }));
  const audio = new MetronomeAudio();
  const click = vi.spyOn(audio, 'playClick').mockImplementation(() => {});
  const strengths: BeatStrengthLevel[] = ['strong', 'medium', 'medium', 'weak'];
  render(<TemporiAutoScroller isPlaying windows={windows} measureOffsets={[]} measureLayouts={[]}
    autoScrollEnabled={false} autoScrollMode="line" scrollBehavior="auto" playbackEndMs={2000}
    playbackAnchorMsRef={{ current: 0 }} metronomeRef={{ current: audio }}
    playbackMetronomeRef={{ current: { enabled: true, windows, bpm: 120, beatsPerMeasure: 4, beatStrengths: strengths, beatSubdivisions: [] } }}
  />);
  // The count-in has already sounded the initial downbeat.
  for (const now of [500, 1000, 1500, 2000]) act(() => frame(now));
  expect(click.mock.calls.flat()).toEqual(['medium', 'medium', 'weak']);
});

it('drops stale clicks after the tab stops delivering frames', () => {
  let frame: FrameRequestCallback;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const windows = [{ measureIndex: 0, playbackStepIndex: 0, startMs: 0, durationMs: 120000, tempoBpm: 120, beatsPerMeasure: 4, beatType: 4 }];
  const audio = new MetronomeAudio();
  const click = vi.spyOn(audio, 'playClick').mockImplementation(() => {});
  render(<TemporiAutoScroller isPlaying windows={windows} measureOffsets={[]} measureLayouts={[]}
    autoScrollEnabled={false} autoScrollMode="line" scrollBehavior="auto" playbackAnchorMsRef={{ current: 0 }}
    metronomeRef={{ current: audio }} playbackMetronomeRef={{ current: { enabled: true, windows, bpm: 120, beatsPerMeasure: 4, beatStrengths: [], beatSubdivisions: [] } }}
  />);
  act(() => frame(60520));
  expect(click).toHaveBeenCalledTimes(1);
  act(() => frame(61000));
  expect(click).toHaveBeenCalledTimes(2);
});
