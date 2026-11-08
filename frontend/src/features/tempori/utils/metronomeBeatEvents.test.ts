import { expect, it } from 'vitest';
import { collectMetronomeClickEvents } from './metronomeBeatEvents';
import type { MeasureWindow } from './measureTiming';

function measure(step: number, startMs: number, durationMs: number, tempoBpm = 120): MeasureWindow {
  return { playbackStepIndex: step, measureIndex: step, startMs, durationMs, tempoBpm, beatsPerMeasure: 4, beatType: 4 };
}

it.each([90, 110, 120])('emits every distinct onset through 20 measures at %i BPM', bpm => {
  const duration = 4 * 60000 / bpm;
  const windows = Array.from({ length: 20 }, (_, i) => measure(i, i * duration, duration, bpm));
  const keys = new Set<string>();
  for (let from = 0; from < 20 * duration; from += 1000 / 60) {
    for (const event of collectMetronomeClickEvents(windows, from, from + 1000 / 60, bpm, 4, [], [])) keys.add(event.slotKey);
  }
  expect(keys.size).toBe(80);
});

it('resets at a pickup boundary and retains distinct beats in a prolonged measure', () => {
  const windows = [measure(0, 0, 750), measure(1, 750, 3000)];
  const events = collectMetronomeClickEvents(windows, 0, 3750, 120, 4, [], []);
  expect(events.map(event => event.timeMs)).toEqual([0, 500, 750, 1250, 1750, 2250, 2750, 3250]);
  expect(new Set(events.map(event => event.slotKey)).size).toBe(events.length);
});

it('clips pickup subdivisions and applies the next meter, tempo, rests and accents', () => {
  const pickup = measure(0, 0, 750);
  const next = { ...measure(1, 750, 1500, 60), beatsPerMeasure: 3, beatType: 8 };
  const events = collectMetronomeClickEvents(
    [pickup, next], 0, 2250, 120, 4,
    ['strong', 'silent', 'weak'], ['eighth-rest-eighth', 'sixteenth-four', 'quarter'],
  );
  expect(events.map(({ timeMs, strength }) => [timeMs, strength])).toEqual([
    [250, 'strong'], [500, 'silent'], [625, 'silent'],
    [1000, 'strong'], [1250, 'silent'], [1375, 'silent'], [1500, 'silent'], [1625, 'silent'], [1750, 'weak'],
  ]);
});
