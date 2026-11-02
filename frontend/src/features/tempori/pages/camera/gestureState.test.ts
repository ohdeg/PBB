import { describe, expect, it } from 'vitest';
import { createGestureState, normalizeHoldMs } from './gestureState';
function calibrated(holdMs: number) { const state = createGestureState(holdMs); for (let t = 0; t <= 2400; t += 100) state.sample({ timestamp: t, yaw: 0, faces: 1 }); return state; }
describe('camera gesture timing', () => {
  for (const duration of [300, 450, 700]) it(`requires ${duration}ms continuous hold, cooldown and neutral return`, () => {
    const state = calibrated(duration);
    expect(state.sample({ timestamp: 2500, yaw: 30, faces: 1 })).toBe(null);
    for (let time = 2600; time < 2500 + duration; time += 100) expect(state.sample({ timestamp: time, yaw: 30, faces: 1 })).toBe(null);
    expect(state.sample({ timestamp: 2500 + duration, yaw: 30, faces: 1 })).toBe(1);
    for (let time = 3300; time < 6000; time += 100) expect(state.sample({ timestamp: time, yaw: 30, faces: 1 })).toBe(null);
    for (let time = 6000; time <= 6400; time += 100) state.sample({ timestamp: time, yaw: 0, faces: 1 });
    state.sample({ timestamp: 6500, yaw: -30, faces: 1 });
    for (let time = 6600; time < 6500 + duration; time += 100) state.sample({ timestamp: time, yaw: -30, faces: 1 });
    expect(state.sample({ timestamp: 6500 + duration, yaw: -30, faces: 1 })).toBe(-1);
  });
  it('discards holding on multiple faces, gaps, manual turns and speed changes', () => {
    const state = calibrated(450); state.sample({ timestamp: 2500, yaw: 30, faces: 1 });
    state.sample({ timestamp: 2600, yaw: 30, faces: 2 });
    expect(state.sample({ timestamp: 3000, yaw: 30, faces: 1 })).toBe(null);
    state.configure(300); expect(state.sample({ timestamp: 3400, yaw: 30, faces: 1 })).toBe(null);
    state.requireNeutral(); expect(state.sample({ timestamp: 6000, yaw: 30, faces: 1 })).toBe(null);
    expect(normalizeHoldMs('bad')).toBe(450); expect(normalizeHoldMs(700)).toBe(700);
  });
});
