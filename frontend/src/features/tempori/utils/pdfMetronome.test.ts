import { expect, it } from 'vitest';
import { defaultPdfMetronome, pdfMetronomeBeat, pdfMetronomeIntervalMs, resizePdfBeatStrengths } from './pdfMetronome';
it('retains the legacy first-accent pattern and preserves accents when growing a meter', () => {
  expect(defaultPdfMetronome()).toEqual({ beatsPerMeasure: 4, beatType: 4, beatStrengths: ['strong', 'medium', 'medium', 'medium'] });
  expect(resizePdfBeatStrengths(['silent', 'weak'], 4)).toEqual(['silent', 'weak', 'medium', 'medium']);
  expect(resizePdfBeatStrengths(['strong', 'weak', 'silent'], 1)).toEqual(['strong']);
});
it('uses quarter-note BPM for denominator timing and wraps silent beats without skipping', () => {
  const settings = { beatsPerMeasure: 3, beatType: 8, beatStrengths: ['strong', 'silent', 'weak'] as const };
  expect(pdfMetronomeIntervalMs(120, 8)).toBe(250);
  expect(pdfMetronomeIntervalMs(60, 2)).toBe(2000);
  expect(pdfMetronomeBeat(250, 120, settings)).toEqual({ index: 1, strength: 'silent' });
  expect(pdfMetronomeBeat(500, 120, settings)).toEqual({ index: 2, strength: 'weak' });
  expect(pdfMetronomeBeat(750, 120, settings)).toEqual({ index: 0, strength: 'strong' });
});
