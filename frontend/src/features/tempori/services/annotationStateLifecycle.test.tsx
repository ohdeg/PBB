// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
const boundary = vi.hoisted(() => ({ cache: new Map<string, unknown>() }));
vi.mock('./cloudCache', () => ({ cloudCache: async (key: string) => structuredClone(boundary.cache.get(key)), updateCloudCache: async (key: string, change: (value: unknown) => unknown) => { const next = change(structuredClone(boundary.cache.get(key))); boundary.cache.set(key, structuredClone(next)); return next; } }));
vi.mock('./temporiCloudApi', () => ({ captureCloudSession: () => ({ account: null, assert() {}, signal: new AbortController().signal }) }));
vi.mock('./temporiStateSync', () => ({ syncScoreState: vi.fn(async () => {}), resolveConflict: vi.fn() }));
import { TemporiStateProvider, persistStateRecovery, recoveryEntries, writeStateRecovery } from './TemporiStateProvider';
import { PageAnnotationLayer } from '../pages/PageAnnotationLayer';
import { annotationDocumentKey } from './annotationStateBridge';
import { syncScoreState } from './temporiStateSync';
import { loadState, saveLocalState } from './temporiStateRepository';
const identity = { owner: 'guest-test', accountId: null, scoreId: 'tempori-test', originalHash: 'a'.repeat(64) };
const layout = `pdf-${'b'.repeat(64)}-intrinsic-rotation`;
beforeEach(() => { vi.clearAllMocks(); vi.mocked(syncScoreState).mockResolvedValue(undefined); boundary.cache.clear(); localStorage.clear(); vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { cleanup(); });
function pointer(target: Element, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }); Object.assign(event, { pointerId: 1, pointerType: 'pen', isPrimary: true }); fireEvent(target, event);
}
it('journals an unfinished pen stroke when the annotation wrapper/provider unmounts', async () => {
  const view = render(<TemporiStateProvider identity={identity}><PageAnnotationLayer id="tempori-test" layout={layout} page={0} width={100} height={100} tool="pen" sizes={{ pen: 2, highlighter: 8, eraser: 10 }} /></TemporiStateProvider>);
  const svg = await screen.findByLabelText('페이지 필기'); Object.assign(svg, { setPointerCapture: vi.fn(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) });
  pointer(svg, 'pointerdown', 10, 10); pointer(svg, 'pointermove', 30, 30);
  view.unmount(); const key = await annotationDocumentKey('pages', layout);
  await vi.waitFor(async () => expect((await loadState(identity.owner, identity.scoreId, key)).payload).toMatchObject({ document: { pages: [{ strokes: [{ points: [{ x: .1, y: .1 }, { x: .3, y: .3 }] }] }] } }));
});
it('uses separate journal records for concurrent edits and preserves stale recovery as a conflict', async () => {
  const practice = (bpm: number) => ({ bpm, tempoChanges: [], startMeasure: 1, endMeasure: 2, isRepeatMode: false });
  const first = writeStateRecovery(identity, 'practice', practice(120), 0);
  const second = writeStateRecovery(identity, 'position', { kind: 'pdf', pageIndex: 2, y: .5 }, 0);
  expect(first).not.toBe(second); expect(recoveryEntries(identity)).toHaveLength(2);
  await saveLocalState(identity.owner, identity.scoreId, 'practice', practice(160), 0);
  await act(async () => persistStateRecovery(identity, 'practice', practice(120), 0, first));
  expect((await loadState(identity.owner, identity.scoreId, 'practice')).conflict?.payload).toEqual(practice(160));
  expect(recoveryEntries(identity).map(([key]) => key)).toEqual([second]);
});
it('keeps an oversized recovered drawing visible, then retires its ancestor after a valid clear', async () => {
  const key = await annotationDocumentKey('pages', layout);
  const stroke = (id: string) => ({ id, tool: 'pen', color: '#ff0000', widthPageRatio: .01, points: [{ x: .1, y: .1 }, { x: .3, y: .3 }] });
  const old = { originalHash: identity.originalHash, layout: key, document: { version: 1, pages: [{ pageIndex: 0, strokes: [stroke('old')] }] } };
  await saveLocalState(identity.owner, identity.scoreId, key, old);
  const recovered = { ...old, document: { ...old.document, padding: 'x'.repeat(2 * 1024 * 1024), pages: [{ pageIndex: 0, strokes: [stroke('old'), stroke('recovered')] }] } };
  writeStateRecovery(identity, key, recovered, 1);
  const content = <TemporiStateProvider identity={identity}><PageAnnotationLayer id="tempori-test" layout={layout} page={0} width={100} height={100} tool="none" sizes={{ pen: 2, highlighter: 8, eraser: 10 }} /></TemporiStateProvider>;
  const view = render(content); const svg = await screen.findByLabelText('페이지 필기');
  await act(async () => {}); expect(svg.querySelectorAll('polyline')).toHaveLength(2);
  act(() => window.dispatchEvent(new CustomEvent('tempori-annotations-clear', { detail: { temporiId: 'tempori-test', viewMode: 'pages' } })));
  await vi.waitFor(() => expect(recoveryEntries(identity)).toHaveLength(0)); view.unmount();
  render(content); const restored = await screen.findByLabelText('페이지 필기'); expect(restored.querySelectorAll('polyline')).toHaveLength(0);
});
it('retiring one repaired recovery branch preserves a competing tab draft', async () => {
  const practice = (bpm: number) => ({ bpm, tempoChanges: [], startMeasure: 1, endMeasure: 2, isRepeatMode: false });
  const a = writeStateRecovery(identity, 'practice', { ...practice(120), padding: 'x'.repeat(65536) }, 0);
  const b = writeStateRecovery(identity, 'practice', { ...practice(140), padding: 'x'.repeat(65536) }, 0);
  const repaired = writeStateRecovery(identity, 'practice', practice(140), 0, [b]);
  await persistStateRecovery(identity, 'practice', practice(140), 0, repaired);
  expect(recoveryEntries(identity).map(([key]) => key)).toEqual([a]);
});

it('adopts the exact recovery branch displayed when another tab writes after the startup scan', async () => {
  const key = await annotationDocumentKey('pages', layout);
  const stroke = (id: string) => ({ id, tool: 'pen', color: '#ff0000', widthPageRatio: .01, points: [{ x: .1, y: .1 }, { x: .3, y: .3 }] });
  const draft = (ids: string[]) => ({ originalHash: identity.originalHash, layout: key, document: { version: 1, padding: 'x'.repeat(2 * 1024 * 1024), pages: [{ pageIndex: 0, strokes: ids.map(stroke) }] } });
  const first = writeStateRecovery(identity, key, draft(['tab-a']), 0); let second = '';
  vi.mocked(syncScoreState).mockImplementationOnce(async () => { second = writeStateRecovery(identity, key, draft(['tab-b-1', 'tab-b-2']), 0); });
  render(<TemporiStateProvider identity={identity}><PageAnnotationLayer id="tempori-test" layout={layout} page={0} width={100} height={100} tool="none" sizes={{ pen: 2, highlighter: 8, eraser: 10 }} /></TemporiStateProvider>);
  const svg = await screen.findByLabelText('페이지 필기'); expect(svg.querySelectorAll('polyline')).toHaveLength(2); expect(second).not.toBe('');
  act(() => window.dispatchEvent(new CustomEvent('tempori-annotations-clear', { detail: { temporiId: 'tempori-test', viewMode: 'pages' } })));
  await vi.waitFor(() => expect(recoveryEntries(identity).map(([id]) => id)).toEqual([first]));
});
