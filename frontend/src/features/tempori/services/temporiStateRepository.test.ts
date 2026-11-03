// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { validateStatePayload } from './temporiStateRepository';
const practice = { bpm: 120, startMeasure: 1, endMeasure: 2, isRepeatMode: false, tempoChanges: [] };
it('accepts legacy and complete PDF metronome practice documents', () => {
  expect(() => validateStatePayload('practice', practice)).not.toThrow();
  for (const beatType of [1, 2, 4, 8, 16]) {
    expect(() => validateStatePayload('practice', { ...practice, pdfMetronome: { beatsPerMeasure: 1, beatType, beatStrengths: ['silent'] } })).not.toThrow();
  }
  expect(() => validateStatePayload('practice', { ...practice, pdfMetronome: { beatsPerMeasure: 16, beatType: 16, beatStrengths: Array(16).fill('weak') } })).not.toThrow();
});
it.each([null, {}, { beatsPerMeasure: 0, beatType: 4, beatStrengths: [] }, { beatsPerMeasure: 17, beatType: 4, beatStrengths: Array(17).fill('strong') }, { beatsPerMeasure: 1.5, beatType: 4, beatStrengths: ['strong'] }, { beatsPerMeasure: 1, beatType: 3, beatStrengths: ['strong'] }, { beatsPerMeasure: 2, beatType: 4, beatStrengths: ['strong'] }, { beatsPerMeasure: 1, beatType: 4, beatStrengths: ['loud'] }, { beatsPerMeasure: 1, beatType: 4, beatStrengths: ['strong', 'silent'] }])('rejects malformed optional PDF settings: %j', (pdfMetronome) => {
  expect(() => validateStatePayload('practice', { ...practice, pdfMetronome })).toThrow('유효하지');
});
