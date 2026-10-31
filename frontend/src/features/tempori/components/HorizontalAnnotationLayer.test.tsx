// @vitest-environment jsdom
import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HorizontalAnnotationLayer from './HorizontalAnnotationLayer';
import type { AnnotationLayerHandle } from '../types/temporiAnnotation';
const layouts = [{ measureIndex: 0, leftPx: 0, topPx: 0, widthPx: 100, heightPx: 100 }, { measureIndex: 1, leftPx: 100, topPx: 0, widthPx: 100, heightPx: 100 }];
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return { canvas: this, setTransform() {}, clearRect() {}, drawImage() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, save() {}, restore() {} } as unknown as CanvasRenderingContext2D;
  });
});
function setup(onError = vi.fn()) {
  const content = document.createElement('div'); const viewport = document.createElement('div');
  Object.defineProperties(content, { scrollWidth: { value: 200 }, scrollHeight: { value: 100 }, clientWidth: { value: 200 }, clientHeight: { value: 100 } });
  Object.defineProperties(viewport, { clientWidth: { value: 100 }, clientHeight: { value: 100 } });
  const ref = createRef<AnnotationLayerHandle>();
  render(<HorizontalAnnotationLayer ref={ref} temporiId="a" containerRef={{ current: content }} viewportRef={{ current: viewport }} layouts={layouts} tool="pen" brushSizes={{ pen: 4, highlighter: 12, eraser: 10 }} onError={onError} />);
  return { ref, canvas: screen.getByTestId('horizontal-annotation-canvas'), onError };
}
function draw(canvas: HTMLElement, finish = true) {
  fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20, button: 0 });
  fireEvent.pointerMove(canvas, { clientX: 180, clientY: 40, buttons: 1 });
  if (finish) fireEvent.pointerUp(canvas, { clientX: 180, clientY: 40 });
}
describe('horizontal annotation lifecycle', () => {
  it('flushes a pending cross-bar stroke once and preserves it across a failed save and retry', () => {
    const { ref, canvas, onError } = setup();
    const save = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw Error('quota'); });
    draw(canvas, false);
    act(() => expect(ref.current?.flush()).toBe(false));
    expect(onError).toHaveBeenLastCalledWith('save');
    save.mockRestore();
    act(() => expect(ref.current?.flush()).toBe(true));
    const saved = JSON.parse(localStorage.getItem('tempori:annotations:horizontal:a')!);
    expect(saved.strokes).toHaveLength(1);
    expect(saved.strokes[0].segments.map((s: { measureIndex: number }) => s.measureIndex)).toEqual([0, 1]);
    expect(localStorage.getItem('tempori:annotations:a')).toBeNull();
  });
  it('commits valid points on pointercancel and clears only the active view without resurrecting them', () => {
    const { canvas, ref } = setup(); draw(canvas, false); fireEvent.pointerCancel(canvas);
    expect(JSON.parse(localStorage.getItem('tempori:annotations:horizontal:a')!).strokes).toHaveLength(1);
    act(() => window.dispatchEvent(new CustomEvent('tempori-annotations-clear', { detail: { temporiId: 'a', viewMode: 'horizontal' } })));
    act(() => ref.current?.flush());
    expect(JSON.parse(localStorage.getItem('tempori:annotations:horizontal:a')!).strokes).toHaveLength(0);
  });
  it('refreshes the visible crop when settings move the score without resizing it', () => {
    const content = document.createElement('div'); const viewport = document.createElement('div');
    Object.defineProperties(content, { scrollWidth: { value: 200 }, scrollHeight: { value: 100 }, clientWidth: { value: 200 }, clientHeight: { value: 100 } });
    Object.defineProperties(viewport, { clientWidth: { value: 100 }, clientHeight: { value: 100 } });
    let top = 2000;
    content.getBoundingClientRect = () => ({ left: 0, top, width: 200, height: 100, right: 200, bottom: top + 100, x: 0, y: top, toJSON() {} });
    const props = { temporiId: 'a', containerRef: { current: content }, viewportRef: { current: viewport }, layouts, tool: 'none' as const, brushSizes: { pen: 4, highlighter: 12, eraser: 10 } };
    const { rerender } = render(<HorizontalAnnotationLayer {...props} layoutKey="settings-open" />);
    expect(screen.getByTestId('horizontal-annotation-canvas')).toHaveStyle({ height: '1px' });
    top = 100;
    rerender(<HorizontalAnnotationLayer {...props} layoutKey="settings-closed" />);
    expect(screen.getByTestId('horizontal-annotation-canvas')).toHaveStyle({ height: '100px' });
  });
  it('keeps invalid stored v2 locked and does not overwrite its raw bytes', () => {
    localStorage.setItem('tempori:annotations:horizontal:a', '{invalid');
    const { canvas, onError, ref } = setup(); draw(canvas);
    act(() => expect(ref.current?.flush()).toBe(true));
    expect(onError).toHaveBeenCalledWith('load');
    expect(localStorage.getItem('tempori:annotations:horizontal:a')).toBe('{invalid');
  });
});
