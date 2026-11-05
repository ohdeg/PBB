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
const hint = '왼쪽 이전 · 가운데 메뉴 · 오른쪽 다음';
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
  Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 800 }); return viewport;
}
function tap(target: HTMLElement, x = 700) { const event = { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: 200 }; fireEvent.pointerDown(target, event); fireEvent.pointerUp(target, event); }

it('hides PDF controls by default, toggles them at the center, and turns from outer thirds', async () => {
  render(<Viewer />); const viewport = await ready();
  const counter = screen.getByText('1 / 2 페이지'); expect(counter.closest('.tempori-viewer-dock-pages')).not.toBeNull();
  expect(counter).not.toBeVisible();
  expect(screen.queryByRole('button', { name: '메뉴' })).toBeNull();
  const sheet = document.querySelector('.tempori-page-sheet')!;
  const annotations = document.querySelector('.tempori-page-annotations')!;
  const dimensions = sheet.getAttribute('style');
  tap(viewport, 400);
  expect(screen.getByRole('button', { name: '메뉴' })).toBeVisible();
  expect(document.querySelector('.tempori-page-sheet')).toBe(sheet);
  expect(document.querySelector('.tempori-page-annotations')).toBe(annotations);
  expect(sheet.getAttribute('style')).toBe(dimensions);
  expect(engine.render).toHaveBeenCalledTimes(1);
  tap(viewport, 400);
  expect(screen.queryByRole('button', { name: '메뉴' })).toBeNull();
  expect(screen.queryByRole('button', { name: '다음 페이지' })).toBeNull();
  expect(screen.getByRole('button', { name: '다음 페이지', hidden: true }).closest('.tempori-viewer-menu')).not.toBeNull();
  tap(viewport); await screen.findByText('Score page 2'); expect(screen.getByText('2 / 2 페이지')).toBeInTheDocument();
  tap(viewport, 400);
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
  view.rerender(<Viewer />); tap(viewport, 400); fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
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
  vi.spyOn(localStorage, 'getItem').mockImplementation((key) => { if (key === 'tempori:pdf-controls-hint-seen:v2') throw new Error('storage blocked'); return get(key); });
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => { if (key === 'tempori:pdf-controls-hint-seen:v2') throw new Error('storage blocked'); set(key, value); });
  render(<Viewer />); const viewport = await ready(); expect(await screen.findByText(hint)).toBeInTheDocument();
  tap(viewport); await screen.findByText('Score page 2');
});

it('keeps a keyboard and screen-reader control path with ink and zoom recovery', async () => {
  const view = render(<Viewer />); const viewport = await ready();
  fireEvent.click(screen.getByRole('button', { name: '악보 컨트롤 표시' }));
  expect(screen.getByRole('link', { name: '보관함으로' })).toBeVisible();
  expect(screen.getByRole('link', { name: '보관함으로' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: '컨트롤 숨기기' }));
  expect(screen.getByRole('button', { name: '악보 컨트롤 표시' })).toHaveFocus();
  fireEvent.keyDown(viewport, { key: 'c' });
  expect(screen.getByRole('button', { name: '메뉴' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
  fireEvent.keyDown(viewport, { key: 'Escape' });
  expect(screen.getByRole('button', { name: '메뉴' })).toHaveAttribute('aria-expanded', 'false');
  fireEvent.keyDown(viewport, { key: 'Escape' });
  expect(screen.queryByRole('button', { name: '메뉴' })).toBeNull();
  view.rerender(<Viewer tool="pen" />);
  expect(screen.getByRole('button', { name: '메뉴' })).toBeVisible();
  expect(screen.getByRole('button', { name: '컨트롤 숨기기' })).toBeDisabled();
  view.rerender(<Viewer />);
  fireEvent.keyDown(viewport, { key: 'c', ctrlKey: true });
  expect(screen.queryByRole('button', { name: '메뉴' })).toBeNull();
});

it('fits PDF paper to the full usable width and height and centers portrait letterboxing', async () => {
  render(<Viewer />); const viewport = await ready();
  Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 390 });
  fireEvent.resize(window);
  const sheet = document.querySelector<HTMLElement>('.tempori-page-sheet')!;
  expect(sheet.style.width).toBe('390px');
  expect(sheet.style.height).toBe('520px');
  expect(viewport.style.height).toBe(`${window.innerHeight}px`);
  expect(sheet.style.marginTop).toBe(`${(window.innerHeight - 520) / 2}px`);
});

it('allows center taps to hide zoom controls while drag and edge taps never turn enlarged pages', async () => {
  render(<Viewer />); const viewport = await ready();
  tap(viewport, 400); fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
  fireEvent.click(screen.getByRole('button', { name: '악보 확대' }));
  await waitFor(() => expect(engine.render).toHaveBeenCalledTimes(2));
  const scrollKey = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
  viewport.dispatchEvent(scrollKey); expect(scrollKey.defaultPrevented).toBe(false);
  const sheet = document.querySelector<HTMLElement>('.tempori-page-sheet')!;
  const dimensions = sheet.getAttribute('style');
  tap(viewport, 400); expect(screen.queryByRole('button', { name: '메뉴' })).toBeNull();
  tap(viewport, 700); expect(engine.render).toHaveBeenCalledTimes(2);
  fireEvent.pointerDown(viewport, { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: 400, clientY: 200 });
  fireEvent.pointerMove(viewport, { pointerId: 1, pointerType: 'touch', clientX: 430, clientY: 200 });
  fireEvent.pointerUp(viewport, { pointerId: 1, pointerType: 'touch', clientX: 430, clientY: 200 });
  expect(screen.queryByRole('button', { name: '메뉴' })).toBeNull();
  tap(viewport, 400); expect(screen.getByRole('button', { name: '메뉴' })).toBeVisible();
  expect(sheet.getAttribute('style')).toBe(dimensions);
});
