// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import PlaybackControls from './PlaybackControls';
afterEach(cleanup);
function props(): ComponentProps<typeof PlaybackControls> {
  return {
    bpm: 120, timeSignature: { beatsPerMeasure: 4, beatType: 4 }, isPlaying: false, isCountingIn: false,
    isAutoScroll: true, isMetronomeEnabled: true, isMeasureHighlightEnabled: true, elapsedMs: 0, currentMeasureIndex: 0,
    totalMeasures: 8, isSavingPrefs: false, startMeasure: 1, endMeasure: 8, isRepeatMode: false,
    transposeSemitones: 0, beatStrengths: ['strong', 'weak', 'weak', 'weak'], beatSubdivisions: [],
    onBpmChange: vi.fn(), onTimeSignatureChange: vi.fn(), onBeatsPerMeasureChange: vi.fn(), onBeatTypeChange: vi.fn(),
    onTogglePlay: vi.fn(), onAutoScrollChange: vi.fn(), onMetronomeChange: vi.fn(), onMeasureHighlightChange: vi.fn(),
    onStartMeasureChange: vi.fn(), onEndMeasureChange: vi.fn(), onRepeatModeChange: vi.fn(), onSeekToStartMeasure: vi.fn(),
    onResetPracticeRange: vi.fn(), onSavePrefs: vi.fn(), onTransposeDown: vi.fn(), onTransposeUp: vi.fn(), onTransposeReset: vi.fn(),
    onBeatStrengthChange: vi.fn(), onBeatSubdivisionChange: vi.fn(),
  };
}
it('collapses advanced score settings and exposes explicit apply/cancel paths without an old play button', () => {
  const values = { ...props(), savePrefsEnabled: false, onApplySettings: vi.fn(), onApplyAndPlay: vi.fn(), onCancelSettings: vi.fn() };
  render(<PlaybackControls {...values} />);
  expect(screen.getByText('고급 설정').closest('details')).not.toHaveAttribute('open');
  expect(screen.queryByRole('button', { name: '재생' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '적용' })); expect(values.onApplySettings).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '적용하고 재생' })); expect(values.onApplyAndPlay).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '취소' })); expect(values.onCancelSettings).toHaveBeenCalledOnce();
});
it('keeps independent metronome playback and saving immediate', () => {
  const values = props(); render(<PlaybackControls {...values} mode="metronome" />);
  fireEvent.click(screen.getByRole('button', { name: '재생' })); expect(values.onTogglePlay).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'BPM 설정 저장' })); expect(values.onSavePrefs).toHaveBeenCalledOnce();
  expect(screen.queryByText('고급 설정')).toBeNull();
  expect(screen.getByRole('spinbutton', { name: '한 마디 박 수' })).toBeVisible();
});
it('gives each BPM control a distinct clickable label', () => {
  render(<><PlaybackControls {...props()} /><PlaybackControls {...props()} /></>);
  const inputs = screen.getAllByRole('spinbutton', { name: 'BPM' });
  expect(inputs[0].id).not.toBe(inputs[1].id);
  expect(inputs.every((input) => (input as HTMLInputElement).labels?.length === 1)).toBe(true);
});
