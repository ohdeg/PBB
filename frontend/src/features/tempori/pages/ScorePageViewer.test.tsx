// @vitest-environment jsdom
import { Blob as NodeBlob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TemporiViewerFrame } from '../../../components/TemporiViewerDock';
import { ScorePageViewer } from './ScorePageViewer';
import type { PageDocument, ScoreSource } from './types';
import type { AnnotationToolMode } from '../types/temporiAnnotation';

// Replace only external render engines; exercise real viewer/input/controller/dock/annotations.
const engine = vi.hoisted(() => ({ create: vi.fn(), render: vi.fn() }));
vi.mock('./PdfPageRenderer', () => ({ createPdfPageDocument: engine.create }));
vi.mock('./MusicXmlPageRenderer', () => ({ createMusicXmlPageDocument: engine.create }));
class TestPointerEvent extends MouseEvent {
  pointerId: number; pointerType: string; isPrimary: boolean;
  constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? 'touch'; this.isPrimary = init.isPrimary ?? true; }
}
const pdf: ScoreSource = { kind: 'pdf', id: 'tap-test', blob: new NodeBlob(['test PDF']) as unknown as Blob };
const xml: ScoreSource = { kind: 'musicxml', id: 'tap-xml', xml: '<score-partwise />' };
const sizes = { pen: 2, highlighter: 8, eraser: 12 };
const hint = '왼쪽은 이전 · 오른쪽은 다음';
const storage = window.localStorage;
function Viewer({ source = pdf, tool = 'none', settingsOpen = false }: { source?: ScoreSource; tool?: AnnotationToolMode; settingsOpen?: boolean }) {
  return <MemoryRouter><TemporiViewerFrame><ScorePageViewer source={source} annotationId="tap-test" annotationTool={tool} annotationBrushSizes={sizes} settingsOpen={settingsOpen} /></TemporiViewerFrame></MemoryRouter>;
}
beforeEach(() => {
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('PointerEvent', TestPointerEvent); vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  engine.render.mockReset().mockImplementation(async (index: number, target: HTMLElement) => { target.textContent = `Score page ${index + 1}`; });
  engine.create.mockReset().mockImplementation(async (): Promise<PageDocument> => ({ pages: [{ index: 0, width: 600, height: 800 }, { index: 1, width: 600, height: 800 }], render: engine.render, dispose() {} }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function ready() {
  await screen.findByText('Score page 1'); const viewport = document.querySelector<HTMLElement>('.tempori-page-viewport')!;
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 800, top: 0, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON() {} });
  Object.defineProperty(viewport, 'clientWidth', { value: 800 }); return viewport;
}
function tap(target: HTMLElement, x = 700) { const event = { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: 200 }; fireEvent.pointerDown(target, event); fireEvent.pointerUp(target, event); }

it('turns PDF pages by half tap, keeps the counter, and exposes buttons through the menu', async () => {
  render(<Viewer />); const viewport = await ready();
  const counter = screen.getByText('1 / 2 페이지'); expect(counter.closest('.tempori-viewer-dock-pages')).not.toBeNull();
  expect(screen.queryByRole('button', { name: '다음 페이지' })).toBeNull();
  expect(screen.getByRole('button', { name: '다음 페이지', hidden: true }).closest('.tempori-viewer-menu')).not.toBeNull();
  tap(viewport); await screen.findByText('Score page 2'); expect(screen.getByText('2 / 2 페이지')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
  expect(screen.getByRole('button', { name: '다음 페이지' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '이전 페이지' })).toBeEnabled();
});
it('preserves persistent MusicXML buttons and ignores MusicXML taps', async () => {
  render(<Viewer source={xml} />); const viewport = await ready();
  const next = screen.getByRole('button', { name: '다음 페이지' }); expect(next.closest('.tempori-viewer-dock-pages')).not.toBeNull();
  tap(viewport); expect(screen.getByText('Score page 1')).toBeInTheDocument();
  expect(screen.queryByText(hint)).toBeNull(); fireEvent.click(next); await screen.findByText('Score page 2');
});
it.each(['pen', 'eraser', 'highlighter'] as const)('suspends taps and the hint during %s annotation', async (tool) => {
  render(<Viewer tool={tool} />); const viewport = await ready(); tap(viewport);
  expect(screen.getByText('Score page 1')).toBeInTheDocument(); expect(screen.queryByText(hint)).toBeNull();
});
it('suspends taps during settings, camera dialog, application zoom, and native zoom', async () => {
  const view = render(<Viewer settingsOpen />); const viewport = await ready(); tap(viewport);
  expect(screen.queryByText(hint)).toBeNull(); expect(engine.render).toHaveBeenCalledTimes(1);
  view.rerender(<Viewer />); fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
  fireEvent.click(screen.getByRole('button', { name: /카메라 넘김 ·/ })); tap(viewport); expect(engine.render).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '설정 닫기' }));
  fireEvent.click(screen.getByRole('button', { name: '악보 확대' })); tap(viewport);
  expect(screen.getByText('Score page 1')).toBeInTheDocument(); await waitFor(() => expect(engine.render).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole('button', { name: '페이지 맞춤' }));
  vi.stubGlobal('visualViewport', { scale: 2 }); fireEvent.resize(window); tap(viewport);
  expect(engine.render).toHaveBeenCalledTimes(2);
});
it('does not start another page turn while busy or after a render error', async () => {
  render(<Viewer />); const viewport = await ready();
  let fail!: (error: Error) => void;
  engine.render.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { fail = reject; }));
  tap(viewport); tap(viewport); expect(engine.render).toHaveBeenCalledTimes(2);
  await act(async () => fail(new Error('Page unavailable'))); tap(viewport);
  expect(engine.render).toHaveBeenCalledTimes(2); expect(screen.getByRole('alert')).toHaveTextContent('Page unavailable');
});
it('shows the hint once after eligibility, then expires it without repeating on reopening', async () => {
  const view = render(<Viewer settingsOpen />); await ready(); expect(screen.queryByText(hint)).toBeNull();
  vi.useFakeTimers(); view.rerender(<Viewer />); expect(screen.getByText(hint)).toBeInTheDocument();
  await act(async () => { vi.advanceTimersByTime(5000); }); expect(screen.queryByText(hint)).toBeNull();
  vi.useRealTimers(); view.unmount(); render(<Viewer />); await ready(); expect(screen.queryByText(hint)).toBeNull();
});
it('keeps the viewer usable if the hint preference cannot be read or written', async () => {
  const get = localStorage.getItem.bind(localStorage); const set = localStorage.setItem.bind(localStorage);
  vi.spyOn(localStorage, 'getItem').mockImplementation((key) => { if (key === 'tempori:pdf-tap-hint-seen') throw new Error('storage blocked'); return get(key); });
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => { if (key === 'tempori:pdf-tap-hint-seen') throw new Error('storage blocked'); set(key, value); });
  render(<Viewer />); const viewport = await ready(); expect(await screen.findByText(hint)).toBeInTheDocument();
  tap(viewport); await screen.findByText('Score page 2');
});
