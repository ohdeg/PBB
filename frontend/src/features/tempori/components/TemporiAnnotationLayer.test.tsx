// @vitest-environment jsdom
import { createRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TemporiAnnotationLayer from './TemporiAnnotationLayer';
import type { AnnotationLayerHandle } from '../types/temporiAnnotation';
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return { canvas: this, setTransform() {}, clearRect() {}, drawImage() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, save() {}, restore() {} } as unknown as CanvasRenderingContext2D;
  });
});
function setup() {
  const content = document.createElement('div');
  Object.defineProperties(content, { scrollWidth: { value: 200 }, scrollHeight: { value: 100 }, clientWidth: { value: 200 }, clientHeight: { value: 100 } });
  content.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 } as DOMRect);
  const ref = createRef<AnnotationLayerHandle>();
  const { container } = render(<TemporiAnnotationLayer ref={ref} temporiId="wrapped-test" containerRef={{ current: content }} tool="pen" brushSizes={{ pen: 4, highlighter: 12, eraser: 10 }} enabled />);
  return { ref, canvas: container.querySelector('canvas')! };
}
describe('wrapped annotation compatibility during view transitions', () => {
  it('commits valid pending points as v1 on cancellation and flushes failures without duplicating them', () => {
    const { ref, canvas } = setup();
    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20, button: 0 });
    fireEvent.pointerMove(canvas, { clientX: 180, clientY: 40, buttons: 1 });
    const save = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw Error('quota'); });
    fireEvent.pointerCancel(canvas);
    act(() => expect(ref.current?.flush()).toBe(false));
    save.mockRestore();
    act(() => expect(ref.current?.flush()).toBe(true));
    const saved = JSON.parse(localStorage.getItem('tempori:annotations:wrapped-test')!);
    expect(saved.version).toBe(1); expect(saved.strokes).toHaveLength(1);
    expect(saved.strokes[0].points).toEqual([{ x: .1, y: .2 }, { x: .9, y: .4 }]);
    expect(localStorage.getItem('tempori:annotations:horizontal:wrapped-test')).toBeNull();
  });
});
