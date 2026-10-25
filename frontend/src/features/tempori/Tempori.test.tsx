// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, type ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tempori } from './Tempori';
import type OsmdViewer from './components/OsmdViewer';
import type TemporiMetronome from './components/TemporiMetronome';
import type { TemporiRenderSnapshot } from './components/OsmdViewer';
import { fetchTemporiMusicXml } from './utils/temporiLoader';
import { useTemporiPlaybackStore } from './store/temporiPlaybackStore';

const boundary = vi.hoisted(() => ({ resume: vi.fn() }));
vi.mock('./utils/temporiLoader', () => ({ fetchTemporiMusicXml: vi.fn() }));
vi.mock('./utils/scrollAnchor', () => ({ cancelScrollAnimation: vi.fn(), scrollToAnchoredMeasure: vi.fn() }));
vi.mock('./utils/metronomeAudio', () => ({ MetronomeAudio: class { resume = boundary.resume; dispose() {} playClick() {} } }));
vi.mock('./components/TemporiAutoScroller', () => ({ default: () => null }));
vi.mock('./components/TemporiMetronome', () => ({ default: (props: ComponentProps<typeof TemporiMetronome>) => <output data-testid="audio-context" data-bpm={props.bpm} data-counting={String(props.isCountingIn)} data-duration={props.windows?.[0]?.durationMs} /> }));
vi.mock('./components/OsmdViewer', () => ({
  default: function RenderBoundary(props: ComponentProps<typeof OsmdViewer>) {
    useEffect(() => { props.onRenderStatusChange?.('loading', props.renderRevision ?? 0); }, [props.renderRevision]);
    const snapshot: TemporiRenderSnapshot = {
      timings: Array.from({ length: 8 }, (_, measureIndex) => ({ measureIndex, measureNumber: measureIndex + 1, divisions: 1, durationSum: 4, expectedDurationDivisions: 4, beatsPerMeasure: 4, beatType: 4, tempoBpm: 120, fermataFactor: 1, isPickup: false })),
      playbackSequence: [0, 1, 2, 3, 4, 5, 6, 7], measureOffsets: [], measureLayoutsInContainer: [],
    };
    return <div>
      <button onClick={() => { props.onSnapshot?.(snapshot); props.onRenderStatusChange?.('ready', props.renderRevision ?? 0); }}>Finish render</button>
      <button onClick={() => props.onRenderStatusChange?.('error', props.renderRevision ?? 0)}>Fail render</button>
      {Array.from({ length: 8 }, (_, index) => <button key={index} disabled={!props.measureClickEnabled} onClick={() => props.onMeasureClick?.(index)}>Measure {index + 1}</button>)}
    </div>;
  },
}));

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  localStorage.setItem('tempori:guide:tempori-seen', '1');
  useTemporiPlaybackStore.setState({ bpm: 120, measuresPerLine: 4, beatsPerMeasure: 4, beatType: 4, isPlaying: false, elapsedMs: 0, currentMeasureIndex: 0 });
  vi.mocked(fetchTemporiMusicXml).mockResolvedValue('<score-partwise><part><measure><attributes><time><beats>4</beats><beat-type>4</beat-type></time></attributes></measure></part></score-partwise>');
});
afterEach(cleanup);
async function openTempori() {
  render(<MemoryRouter><Tempori temporiId="a" /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Finish render' });
}
function finishRender() { fireEvent.click(screen.getByRole('button', { name: 'Finish render' })); }
function openSettings() { fireEvent.click(screen.getByRole('button', { name: '설정 열기' })); }
function changeBpm(value: string) { fireEvent.change(screen.getByRole('spinbutton', { name: 'BPM' }), { target: { value } }); }

describe('score practice flow', () => {
  it('blocks playback until rendering is ready and allows retry after a rendering error', async () => {
    await openTempori();
    expect(screen.getByRole('button', { name: '재생' })).toBeDisabled();
    finishRender(); expect(screen.getByRole('button', { name: '재생' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Fail render' }));
    expect(screen.getByRole('button', { name: '재생' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(fetchTemporiMusicXml).toHaveBeenCalledTimes(1);
    finishRender(); expect(screen.getByRole('button', { name: '재생' })).toBeEnabled();
  });
  it('starts count-in only after committed BPM and timing are updated', async () => {
    await openTempori(); finishRender(); openSettings(); changeBpm('80');
    fireEvent.click(screen.getByRole('button', { name: '적용하고 재생' }));
    expect(boundary.resume).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByTestId('audio-context')).toHaveAttribute('data-counting', 'true'));
    expect(screen.getByTestId('audio-context')).toHaveAttribute('data-bpm', '80');
    expect(screen.getByTestId('audio-context')).toHaveAttribute('data-duration', '3000');
  });
  it('waits for a changed transpose/layout and cancels queued play on render error and retry', async () => {
    await openTempori(); finishRender(); openSettings();
    fireEvent.click(screen.getByRole('button', { name: '키 업 (반음 올림)' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: '줄당 마디 수' }), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: '적용하고 재생' }));
    expect(screen.getByTestId('audio-context')).toHaveAttribute('data-counting', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Fail render' }));
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' })); finishRender();
    expect(screen.getByTestId('audio-context')).toHaveAttribute('data-counting', 'false');
  });
  it('starts once at the new range with updated timing after a successful layout revision', async () => {
    await openTempori(); finishRender(); openSettings(); changeBpm('80');
    fireEvent.click(screen.getByRole('button', { name: '키 업 (반음 올림)' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: '줄당 마디 수' }), { target: { value: '2' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: '시작 마디' }), { target: { value: '3' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: '끝 마디' }), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('checkbox', { name: '반복 재생 (구간 반복)' }));
    fireEvent.click(screen.getByRole('button', { name: '적용하고 재생' }));
    expect(screen.getByTestId('audio-context')).toHaveAttribute('data-counting', 'false');
    finishRender();
    await waitFor(() => expect(screen.getByTestId('audio-context')).toHaveAttribute('data-counting', 'true'));
    expect(useTemporiPlaybackStore.getState().currentMeasureIndex).toBe(2);
    expect(screen.getByTestId('audio-context')).toHaveAttribute('data-duration', '3000');
    fireEvent.click(screen.getByRole('button', { name: '예비박 중지' }));
    openSettings(); expect(screen.getByRole('checkbox', { name: '반복 재생 (구간 반복)' })).toBeChecked();
    expect(boundary.resume).toHaveBeenCalledOnce();
  });
  it('discards edited BPM with Escape and the close button', async () => {
    await openTempori(); finishRender(); openSettings(); changeBpm('80');
    fireEvent.keyDown(window, { key: 'Escape' }); openSettings();
    expect(screen.getByRole('spinbutton', { name: 'BPM' })).toHaveValue(120);
    changeBpm('90');
    fireEvent.click(screen.getByRole('dialog').querySelector('.floating-settings-close')!); openSettings();
    expect(screen.getByRole('spinbutton', { name: 'BPM' })).toHaveValue(120);
  });
  it('retries a failed file fetch without needing a metadata reload', async () => {
    vi.mocked(fetchTemporiMusicXml).mockRejectedValueOnce(new Error('file failed'));
    render(<MemoryRouter><Tempori temporiId="a" /></MemoryRouter>);
    await screen.findByRole('alert'); fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await screen.findByRole('button', { name: 'Finish render' }); finishRender();
    expect(screen.getByRole('button', { name: '재생' })).toBeEnabled();
    expect(fetchTemporiMusicXml).toHaveBeenCalledTimes(2);
  });
  it('applies without playing, discards edits on cancel and saves defaults independently', async () => {
    await openTempori(); finishRender(); openSettings(); changeBpm('80');
    fireEvent.click(screen.getByRole('button', { name: '다음 악보의 기본값으로 저장' }));
    expect(localStorage.getItem('tempori:last-bpm')).toBe('80');
    expect(useTemporiPlaybackStore.getState().bpm).toBe(120);
    fireEvent.click(screen.getByRole('button', { name: '취소' })); openSettings();
    expect(screen.getByRole('spinbutton', { name: 'BPM' })).toHaveValue(120);
    changeBpm('90'); fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(useTemporiPlaybackStore.getState().bpm).toBe(90);
    expect(screen.getByTestId('audio-context')).toHaveAttribute('data-counting', 'false');
    expect(boundary.resume).not.toHaveBeenCalled();
  });
  it('ordinary taps keep the range; explicit reverse selection commits and cancel preserves it', async () => {
    await openTempori(); finishRender();
    fireEvent.click(screen.getByRole('button', { name: 'Measure 5' })); openSettings();
    expect(screen.getByRole('spinbutton', { name: '시작 마디' })).toHaveValue(1);
    expect(screen.getByRole('spinbutton', { name: '끝 마디' })).toHaveValue(8);
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    fireEvent.click(screen.getByRole('button', { name: '구간 선택' }));
    fireEvent.click(screen.getByRole('button', { name: 'Measure 8' }));
    expect(screen.getByRole('button', { name: '재생' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Measure 3' }));
    fireEvent.click(screen.getByRole('button', { name: '구간 선택' }));
    fireEvent.click(screen.getByRole('button', { name: 'Measure 2' }));
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    fireEvent.click(screen.getByRole('button', { name: 'Measure 1' }));
    fireEvent.click(screen.getByRole('button', { name: '재생' }));
    expect(useTemporiPlaybackStore.getState().currentMeasureIndex).toBe(2);
  });
  it('hides bypass playback and ignores body Space while settings are open', async () => {
    await openTempori(); finishRender(); openSettings();
    expect(screen.queryByRole('button', { name: '재생' })).toBeNull();
    fireEvent.keyDown(document.body, { code: 'Space' });
    expect(screen.getByTestId('audio-context')).toHaveAttribute('data-counting', 'false');
  });
  it('ignores an old file response after moving to another score', async () => {
    let resolveOld!: (xml: string) => void;
    vi.mocked(fetchTemporiMusicXml).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const { rerender } = render(<MemoryRouter><Tempori temporiId="a" /></MemoryRouter>);
    rerender(<MemoryRouter><Tempori temporiId="b" /></MemoryRouter>);
    await screen.findByRole('button', { name: 'Finish render' });
    finishRender();
    await act(async () => resolveOld('invalid old response'));
    expect(screen.getByRole('button', { name: '재생' })).toBeEnabled();
  });
});
