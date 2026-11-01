// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { animateHorizontalScroll } from './horizontalScroll';

let frames: Map<number, FrameRequestCallback>;
let nextId: number;
beforeEach(() => {
  frames = new Map(); nextId = 0;
  vi.spyOn(performance, 'now').mockReturnValue(0);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextId, callback); return nextId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const tick = (time: number) => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); };

it('moves progressively and finishes exactly at the target', () => {
  const viewport = { scrollLeft: 0 };
  animateHorizontalScroll(viewport, 600);
  expect(viewport.scrollLeft).toBe(0);
  tick(150); expect(viewport.scrollLeft).toBeGreaterThan(0); expect(viewport.scrollLeft).toBeLessThan(300);
  tick(300); expect(viewport.scrollLeft).toBeCloseTo(300);
  tick(600); expect(viewport.scrollLeft).toBe(600); expect(frames.size).toBe(0);
});

it('cancels immediately for manual input and reverses from the visible position', () => {
  const viewport = { scrollLeft: 0 };
  const cancel = animateHorizontalScroll(viewport, 600);
  tick(300); cancel();
  const visible = viewport.scrollLeft;
  tick(600); expect(viewport.scrollLeft).toBe(visible);
  vi.spyOn(performance, 'now').mockReturnValue(600);
  animateHorizontalScroll(viewport, 0);
  tick(900); expect(viewport.scrollLeft).toBeCloseTo(visible / 2);
  tick(1200); expect(viewport.scrollLeft).toBe(0);
});

it('honors reduced motion and the immediate-scroll preference without scheduling frames', () => {
  const viewport = { scrollLeft: 0 };
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  animateHorizontalScroll(viewport, 600);
  expect(viewport.scrollLeft).toBe(600); expect(frames.size).toBe(0);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  animateHorizontalScroll(viewport, 20, 'auto');
  expect(viewport.scrollLeft).toBe(20); expect(frames.size).toBe(0);
});

it('finishes sooner at fast tempos instead of trailing subsequent measures', () => {
  const viewport = { scrollLeft: 0 };
  animateHorizontalScroll(viewport, 600, 'smooth', 120);
  tick(60); expect(viewport.scrollLeft).toBeCloseTo(300);
  tick(120); expect(viewport.scrollLeft).toBe(600); expect(frames.size).toBe(0);
});
