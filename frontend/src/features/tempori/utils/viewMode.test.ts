import { describe, expect, it, vi } from 'vitest';
import { getInitialViewMode, getDeviceViewMode, getHorizontalScrollTarget, saveViewMode } from './viewMode';

describe('view mode preference and physical measure following', () => {
  it('defaults only clearly identified phones to horizontal', () => {
    expect(getDeviceViewMode({ userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5 })).toBe('horizontal');
    expect(getDeviceViewMode({ userAgent: 'Android Mobile', maxTouchPoints: 5 })).toBe('horizontal');
    for (const device of [{ userAgent: 'iPad' }, { userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5 }, { userAgent: 'Android', maxTouchPoints: 10 }, { userAgent: 'Windows', maxTouchPoints: 10 }, { userAgent: '' }]) {
      expect(getDeviceViewMode(device)).toBe('wrapped');
    }
  });
  it('honors both saved choices before device default, without using viewport size', () => {
    expect(getInitialViewMode({ getItem: () => 'wrapped' }, { userAgent: 'iPhone' })).toBe('wrapped');
    expect(getInitialViewMode({ getItem: () => 'horizontal' }, { userAgent: 'Windows' })).toBe('horizontal');
    expect(getInitialViewMode({ getItem: () => 'bogus' }, { userAgent: 'iPhone' })).toBe('horizontal');
    expect(getInitialViewMode({ getItem: () => { throw Error('blocked'); } }, { userAgent: 'Windows' })).toBe('wrapped');
  });
  it('reports preference persistence failure for an inline session-only notice', () => {
    expect(saveViewMode('horizontal', { setItem: () => { throw Error('quota'); } })).toBe(false);
    const writes: string[][] = [];
    expect(saveViewMode('wrapped', { setItem: (...args) => writes.push(args) })).toBe(true);
    expect(writes).toEqual([['tempori:view-mode', 'wrapped']]);
  });
  it('handles a denied browser storage getter before any storage method can be called', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('denied getter'); } });
    try {
      expect(getInitialViewMode(undefined, { userAgent: 'iPhone' })).toBe('horizontal');
      expect(saveViewMode('horizontal')).toBe(false);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
      else Reflect.deleteProperty(globalThis, 'localStorage');
      vi.restoreAllMocks();
    }
  });
  it('anchors at one third and clamps beginning/end, including backward repeats', () => {
    expect(getHorizontalScrollTarget(900, 600, 3000)).toBe(700);
    expect(getHorizontalScrollTarget(0, 600, 3000)).toBe(0);
    expect(getHorizontalScrollTarget(2900, 600, 3000)).toBe(2400);
    expect(getHorizontalScrollTarget(100, 600, 3000)).toBe(0);
    expect(getHorizontalScrollTarget(100, 600, 400)).toBe(0);
  });
});
