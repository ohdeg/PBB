import { expect, it } from 'vitest';
import { shiftDay } from './quickEntry';

it('uses calendar days across month, year and daylight-saving boundaries', () => {
  expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
  expect(shiftDay('2026-03-09', -1)).toBe('2026-03-08');
});
