// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePageTurnInput } from './usePageTurnInput';

class TestPointerEvent extends MouseEvent {
  pointerId: number; pointerType: string; isPrimary: boolean;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? 'touch'; this.isPrimary = init.isPrimary ?? true;
  }
}
beforeEach(() => { vi.stubGlobal('PointerEvent', TestPointerEvent); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function Input({ enabled = true, tapEnabled = true }: { enabled?: boolean; tapEnabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [turns, setTurns] = useState<string[]>([]);
  const input = usePageTurnInput(ref, enabled, (turn) => setTurns((values) => [...values, `${turn.origin}:${turn.delta}`]), tapEnabled);
  return <><div ref={ref} data-testid="score" {...input}><button>control</button><span data-testid="paper" /></div><output data-testid="turns">{turns.join(',')}</output></>;
}
function setup(props: { enabled?: boolean; tapEnabled?: boolean } = {}) {
  const view = render(<Input {...props} />); const score = screen.getByTestId('score');
  vi.spyOn(score, 'getBoundingClientRect').mockReturnValue({ left: 100, right: 900, top: 50, bottom: 650, width: 800, height: 600, x: 100, y: 50, toJSON() {} });
  Object.defineProperty(score, 'clientWidth', { value: 800 });
  return { ...view, score };
}
const pointer = (x: number, y = 200, extra: PointerEventInit = {}) => ({ pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0, ...extra });
function tap(score: HTMLElement, x: number, extra: PointerEventInit = {}) { fireEvent.pointerDown(score, pointer(x, 200, extra)); fireEvent.pointerUp(score, pointer(x, 200, extra)); }
const turns = () => screen.getByTestId('turns').textContent;

it('turns from the viewport left and right halves with one request per tap or mouse click', () => {
  const { score } = setup(); tap(score, 200); tap(score, 800, { pointerType: 'mouse' });
  expect(turns()).toBe('tap:-1,tap:1');
});
it('leaves taps opt-in while preserving swipes and keyboard page turns', () => {
  const { score } = setup({ tapEnabled: false }); tap(score, 800);
  fireEvent.pointerDown(score, pointer(700)); fireEvent.pointerUp(score, pointer(400));
  fireEvent.keyDown(window, { key: 'ArrowRight' }); fireEvent.keyDown(window, { key: 'PageUp' });
  expect(turns()).toBe('swipe:1,keyboard:1,keyboard:-1');
});
it('does not turn a long press into a tap', () => {
  const time = vi.spyOn(performance, 'now'); time.mockReturnValue(0); const { score } = setup();
  fireEvent.pointerDown(score, pointer(800)); time.mockReturnValue(351); fireEvent.pointerUp(score, pointer(800));
  expect(turns()).toBe('');
});
it('does not convert drag, vertical motion, or out-and-return paths into taps', () => {
  const { score } = setup();
  fireEvent.pointerDown(score, pointer(800)); fireEvent.pointerMove(score, pointer(780)); fireEvent.pointerUp(score, pointer(800));
  fireEvent.pointerDown(score, pointer(800)); fireEvent.pointerMove(score, pointer(800, 230)); fireEvent.pointerUp(score, pointer(800));
  fireEvent.pointerDown(score, pointer(800)); fireEvent.pointerMove(score, pointer(805)); fireEvent.pointerMove(score, pointer(800)); fireEvent.pointerMove(score, pointer(805)); fireEvent.pointerUp(score, pointer(800));
  expect(turns()).toBe('');
});
it('does not duplicate a swipe with a tap', () => {
  const { score } = setup(); fireEvent.pointerDown(score, pointer(700)); fireEvent.pointerMove(score, pointer(400)); fireEvent.pointerUp(score, pointer(400));
  expect(turns()).toBe('swipe:1');
});
it('cancels a captured touch that leaves the viewport and returns within the movement tolerance', () => {
  const { score } = setup(); fireEvent.pointerDown(score, pointer(898));
  // Touch implicit capture may suppress pointerleave while coordinates move outside.
  fireEvent.pointerMove(score, pointer(903)); fireEvent.pointerMove(score, pointer(898)); fireEvent.pointerUp(score, pointer(898));
  expect(turns()).toBe('');
});
it('cancels on scrolling, pointer cancellation, or leaving the viewport', () => {
  const { score } = setup();
  fireEvent.pointerDown(score, pointer(800)); fireEvent.scroll(score); fireEvent.pointerUp(score, pointer(800));
  fireEvent.pointerDown(score, pointer(800)); fireEvent.pointerCancel(score, pointer(800)); fireEvent.pointerUp(score, pointer(800));
  fireEvent.pointerDown(score, pointer(800)); fireEvent.pointerLeave(score, pointer(800)); fireEvent.pointerUp(score, pointer(800));
  expect(turns()).toBe('');
});
it.each([
  { pointerType: 'pen' }, { pointerType: 'mouse', button: 2 }, { pointerType: 'mouse', button: 1 }, { isPrimary: false }, { ctrlKey: true, pointerType: 'mouse' },
])('ignores unsupported pointer input %j', (extra) => {
  const { score } = setup(); tap(score, 800, extra); expect(turns()).toBe('');
});
it('ignores controls and keyboard events from controls or dialogs', () => {
  const { score } = setup(); const control = screen.getByRole('button'); tap(control, 800);
  fireEvent.keyDown(control, { key: 'ArrowRight' });
  const dialog = document.createElement('div'); dialog.setAttribute('role', 'dialog'); document.body.append(dialog);
  tap(score, 800); fireEvent.keyDown(window, { key: 'PageDown' }); dialog.remove();
  expect(turns()).toBe('');
});
it('cancels multitouch even when the second touch starts outside, then allows a fresh tap', () => {
  const { score } = setup(); fireEvent.pointerDown(score, pointer(800));
  fireEvent.pointerDown(document.body, pointer(900, 200, { pointerId: 2, isPrimary: false }));
  fireEvent.pointerUp(document.body, pointer(900, 200, { pointerId: 2, isPrimary: false })); fireEvent.pointerUp(score, pointer(800));
  expect(turns()).toBe(''); tap(score, 800); expect(turns()).toBe('tap:1');
});
it('cleans up releases outside and never turns on an outside release', () => {
  const { score } = setup(); fireEvent.pointerDown(score, pointer(800)); fireEvent.pointerUp(document.body, pointer(950));
  tap(score, 800); expect(turns()).toBe('tap:1');
});
it('cancels when disabled midgesture, including a disable then re-enable', () => {
  const { score, rerender } = setup(); fireEvent.pointerDown(score, pointer(800));
  rerender(<Input enabled={false} />); rerender(<Input enabled />); fireEvent.pointerUp(score, pointer(800));
  expect(turns()).toBe(''); tap(score, 800); expect(turns()).toBe('tap:1');
});
it('rechecks native pinch zoom at release', () => {
  const { score } = setup(); fireEvent.pointerDown(score, pointer(800));
  vi.stubGlobal('visualViewport', { scale: 2 }); fireEvent.pointerUp(score, pointer(800));
  expect(turns()).toBe('');
});
