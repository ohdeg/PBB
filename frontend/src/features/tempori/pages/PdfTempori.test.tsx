// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TemporiDockSlot, TemporiViewerFrame } from '../../../components/TemporiViewerDock';
import { PdfTempori } from './PdfTempori';
import { emptyDocument, type ScoreState } from '../services/temporiStateRepository';
const boundary = vi.hoisted(() => ({ context: null as unknown, click: vi.fn(), resume: vi.fn(), dispose: vi.fn() }));
vi.mock('../services/TemporiStateProvider', () => ({ useTemporiState: () => boundary.context }));
// PDF rendering and physical audio are external; dock, settings, accents and scheduling remain real.
vi.mock('./ScorePageViewer', () => ({ ScorePageViewer: () => null }));
vi.mock('../utils/metronomeAudio', () => ({ MetronomeAudio: class { playClick = boundary.click; resume = boundary.resume; dispose = boundary.dispose; } }));
const source = { kind: 'pdf' as const, id: 'saved-pdf', blob: new Blob(['pdf']) };
const legacy = { bpm: 120, tempoChanges: [{ id: 'retained', startMeasure: 2, endMeasure: 3, bpm: 80, beatsPerMeasure: 4, beatType: 4 }], startMeasure: 2, endMeasure: 8, isRepeatMode: true, futureSetting: 'retain' };
let context: { ready: boolean; identity: { accountId: string | null }; state: ScoreState; save: ReturnType<typeof vi.fn>; setBusy: ReturnType<typeof vi.fn>; reportError: ReturnType<typeof vi.fn> };
afterEach(() => vi.restoreAllMocks());
let frame: FrameRequestCallback | undefined;
let now = 0;
function Viewer() { return <MemoryRouter><TemporiViewerFrame><TemporiDockSlot slot="settings"><button>Page fit fixture</button></TemporiDockSlot><PdfTempori source={source} annotationId="saved-pdf" /></TemporiViewerFrame></MemoryRouter>; }
function change(name: string, value: string) { fireEvent.change(screen.getByRole('spinbutton', { name }), { target: { value } }); }
function tick(time: number) { now = time; act(() => { frame?.(time); }); }
beforeEach(() => {
  vi.clearAllMocks(); now = 0; frame = undefined;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => { frame = undefined; });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  context = { ready: true, identity: { accountId: 'A' }, state: { documents: { practice: { ...emptyDocument(), payload: legacy, generation: 5, serverKnown: true } } }, save: vi.fn(), setBusy: vi.fn(), reportError: vi.fn() };
  boundary.context = context;
});
it('opens PDF metronome settings from tempo shortcut, preserves full payload across rapid meter/accent edits', () => {
  render(<Viewer />);
  expect(boundary.resume).not.toHaveBeenCalled(); expect(boundary.click).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'PDF 메트로놈 설정' }));
  expect(screen.getByRole('spinbutton', { name: 'PDF 메트로놈 BPM' })).toHaveFocus();
  change('PDF 마디당 박자 수', '3');
  fireEvent.change(screen.getByRole('combobox', { name: 'PDF 기준 음표' }), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: '2박 중간' }));
  const [key, payload, generation] = context.save.mock.calls.at(-1)!;
  expect(key).toBe('practice'); expect(generation).toBe(7);
  expect(payload).toEqual({ ...legacy, pdfMetronome: { beatsPerMeasure: 3, beatType: 8, beatStrengths: ['strong', 'weak', 'medium'] } });
  expect(screen.queryByRole('button', { name: /리듬 선택/ })).toBeNull();
});
it('restores meter and accents without autostart and applies quarter BPM with silence', () => {
  context.state.documents.practice.payload = { ...legacy, pdfMetronome: { beatsPerMeasure: 3, beatType: 8, beatStrengths: ['strong', 'silent', 'weak'] } };
  render(<Viewer />); expect(boundary.click).not.toHaveBeenCalled(); expect(boundary.resume).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '메트로놈 시작' })); tick(0); tick(250); tick(500); tick(750);
  expect(boundary.click.mock.calls.map(call => call[0])).toEqual(['strong', 'weak', 'strong']);
  expect(screen.getByLabelText('메트로놈 박자')).toHaveTextContent('1');
  fireEvent.click(screen.getByRole('button', { name: 'PDF 메트로놈 설정' })); change('PDF 메트로놈 BPM', '60');
  tick(750); tick(1000); tick(1250); tick(1750);
  expect(boundary.click.mock.calls.map(call => call[0])).toEqual(['strong', 'weak', 'strong', 'strong', 'weak']);
  fireEvent.click(screen.getByRole('button', { name: '메트로놈 정지' })); tick(2250);
  expect(boundary.click).toHaveBeenCalledTimes(5);
});
it('defers remote settings during playback and refuses conflict documents', () => {
  const view = render(<Viewer />); fireEvent.click(screen.getByRole('button', { name: '메트로놈 시작' }));
  context = { ...context, state: { documents: { practice: { ...emptyDocument(), payload: { ...legacy, bpm: 90 }, generation: 6 } } } }; boundary.context = context; view.rerender(<Viewer />);
  expect(screen.getByRole('button', { name: 'PDF 메트로놈 설정' })).toHaveTextContent('120');
  fireEvent.click(screen.getByRole('button', { name: '메트로놈 정지' }));
  expect(screen.getByRole('button', { name: 'PDF 메트로놈 설정' })).toHaveTextContent('90');
  context = { ...context, state: { documents: { practice: { ...context.state.documents.practice, generation: 7, payload: { ...legacy, bpm: 100 }, conflict: { revision: 1, updatedAt: null, schemaVersion: 1, payload: legacy } } } } }; boundary.context = context; view.rerender(<Viewer />);
  expect(screen.getByRole('button', { name: 'PDF 메트로놈 설정' })).toHaveTextContent('90');
});
it('disables writes before account hydration and retains generation after save failure', () => {
  context.state.documents = {}; const view = render(<Viewer />); fireEvent.click(screen.getByRole('button', { name: 'PDF 메트로놈 설정' }));
  expect(screen.getByRole('spinbutton', { name: 'PDF 메트로놈 BPM' })).toBeDisabled(); expect(context.save).not.toHaveBeenCalled();
  context = { ...context, state: { documents: { practice: { ...emptyDocument(), payload: legacy, generation: 5 } } } }; boundary.context = context; view.rerender(<Viewer />);
  context.save.mockImplementationOnce(() => { throw new Error('storage blocked'); }); change('PDF 마디당 박자 수', '3');
  expect(context.reportError).toHaveBeenCalledWith('storage blocked');
  change('PDF 메트로놈 BPM', '100');
  expect(context.save.mock.calls.at(-1)).toEqual(['practice', { ...legacy, bpm: 100, pdfMetronome: { beatsPerMeasure: 4, beatType: 4, beatStrengths: ['strong', 'medium', 'medium', 'medium'] } }, 5]);
});

it('allows clearing and typing a lower valid BPM without persisting partial invalid values', () => {
  render(<Viewer />); fireEvent.click(screen.getByRole('button', { name: 'PDF 메트로놈 설정' }));
  const input = screen.getByRole('spinbutton', { name: 'PDF 메트로놈 BPM' }); fireEvent.focus(input);
  fireEvent.change(input, { target: { value: '' } }); fireEvent.change(input, { target: { value: '6' } });
  expect(context.save).not.toHaveBeenCalled(); expect(input).toHaveValue(6);
  fireEvent.change(input, { target: { value: '60' } }); fireEvent.blur(input);
  expect(context.save.mock.calls.at(-1)?.[1].bpm).toBe(60);
  expect(input).toHaveValue(60);
});

it('defers remote restore while a settings draft is focused and never writes an untouched stale draft', () => {
  const view = render(<Viewer />); fireEvent.click(screen.getByRole('button', { name: 'PDF 메트로놈 설정' }));
  const input = screen.getByRole('spinbutton', { name: 'PDF 메트로놈 BPM' });
  context = { ...context, state: { documents: { practice: { ...emptyDocument(), payload: { ...legacy, bpm: 90 }, generation: 6 } } } }; boundary.context = context; view.rerender(<Viewer />);
  expect(screen.getByRole('button', { name: 'PDF 메트로놈 설정' })).toHaveTextContent('120');
  fireEvent.blur(input, { relatedTarget: screen.getByRole('button', { name: '메뉴' }) });
  expect(context.save).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'PDF 메트로놈 설정' })).toHaveTextContent('90');
});
it('adopts an explicit conflict resolution below optimistic generations after queued storage failures', () => {
  const view = render(<Viewer />); fireEvent.click(screen.getByRole('button', { name: 'PDF 메트로놈 설정' }));
  change('PDF 메트로놈 BPM', '90'); change('PDF 메트로놈 BPM', '100'); change('PDF 메트로놈 BPM', '110');
  const chosen = { ...legacy, bpm: 80 };
  context = { ...context, state: { documents: { practice: { ...emptyDocument(), payload: { ...legacy, bpm: 110 }, generation: 6, conflict: { revision: 2, schemaVersion: 1, updatedAt: null, payload: chosen } } } } }; boundary.context = context; view.rerender(<Viewer />);
  fireEvent.blur(screen.getByRole('spinbutton', { name: 'PDF 메트로놈 BPM' }), { relatedTarget: screen.getByRole('button', { name: '메뉴' }) });
  context = { ...context, state: { documents: { practice: { ...emptyDocument(), payload: chosen, generation: 7 } } } }; boundary.context = context; view.rerender(<Viewer />);
  expect(screen.getByRole('button', { name: 'PDF 메트로놈 설정' })).toHaveTextContent('80');
  change('PDF 메트로놈 BPM', '85');
  expect(context.save.mock.calls.at(-1)?.[2]).toBe(7);
});
