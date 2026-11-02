import { describe, expect, it, vi } from 'vitest';
import { createPageTurnController, swipeDirection } from './pageTurnController';
describe('shared page turn controller', () => {
  it('keeps old page on failed flush/render and ignores simultaneous inputs', async () => {
    let index = 0; let allow = false; let finish!: () => void;
    const commit = vi.fn((next: number) => { index = next; });
    const controller = createPageTurnController({ count: () => 3, current: () => index, ready: () => true, flush: () => allow, prepare: () => new Promise<void>((resolve) => { finish = resolve; }), commit, transition: async () => {}, fail: vi.fn() });
    expect(await controller.request({ delta: 1, origin: 'bottom', timestamp: 0 })).toBe(false);
    allow = true;
    const first = controller.request({ delta: 1, origin: 'swipe', timestamp: 1000 });
    expect(await controller.request({ delta: 1, origin: 'camera', timestamp: 1010 })).toBe(false);
    expect(index).toBe(0); finish(); expect(await first).toBe(true); expect(index).toBe(1); expect(commit).toHaveBeenCalledOnce();
  });
  it('clamps boundaries and rejects vertical, long and short drags', () => {
    expect(swipeDirection(-80, 10, 250, 500)).toBe(1);
    expect(swipeDirection(80, 10, 250, 500)).toBe(-1);
    expect(swipeDirection(40, 0, 250, 500)).toBe(null);
    expect(swipeDirection(80, 60, 250, 500)).toBe(null);
    expect(swipeDirection(80, 0, 801, 500)).toBe(null);
  });
});
