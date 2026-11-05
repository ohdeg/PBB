import { afterEach, expect, it, vi } from 'vitest';
import { getScoreViewport, setScoreDockBounds } from './scoreViewport';

afterEach(() => { setScoreDockBounds(null); vi.unstubAllGlobals(); });
it('reclaims the overlay dock for PDF while preserving top and bottom safe insets', () => {
  vi.stubGlobal('window', { innerHeight: 800 });
  setScoreDockBounds({ top: 700, bottom: 760, safeTop: 12, safeBottom: 34 });
  expect(getScoreViewport()).toEqual({ top: 12, height: 688 });
  expect(getScoreViewport(false)).toEqual({ top: 12, height: 754 });
});
