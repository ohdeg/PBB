export type GesturePhase = 'calibrating' | 'armed' | 'holding' | 'cooldown' | 'neutral';
export const normalizeHoldMs = (value: unknown): 300 | 450 | 700 => value === 300 || value === 450 || value === 700 ? value : 450;
export function createGestureState(initial: unknown = 450) {
  let holdMs = normalizeHoldMs(initial); let phase: GesturePhase = 'calibrating'; let baseline = 0;
  let calibration: { time: number; yaw: number }[] = []; let last = -Infinity; let heldAt: number | null = null; let direction: -1 | 1 | null = null;
  let neutralAt: number | null = null; let firedAt = -Infinity;
  const requireNeutral = () => { heldAt = null; direction = null; neutralAt = null; if (phase !== 'calibrating') phase = 'neutral'; };
  return {
    phase: () => phase,
    requireNeutral,
    configure(value: unknown) { holdMs = normalizeHoldMs(value); requireNeutral(); },
    recalibrate() { phase = 'calibrating'; calibration = []; heldAt = null; neutralAt = null; },
    sample({ timestamp, yaw, faces, confidence = 1 }: { timestamp: number; yaw: number; faces: number; confidence?: number }): -1 | 1 | null {
      if (timestamp <= last) return null;
      if (timestamp - last > 500 && Number.isFinite(last)) { requireNeutral(); calibration = []; }
      last = timestamp;
      if (faces !== 1 || confidence < .8 || !Number.isFinite(yaw)) { requireNeutral(); calibration = []; return null; }
      if (phase === 'calibrating') {
        if (calibration.length && Math.abs(yaw - calibration[0].yaw) > 8) calibration = [];
        calibration.push({ time: timestamp, yaw });
        if (timestamp - calibration[0].time >= 2000) { baseline = calibration.reduce((sum, frame) => sum + frame.yaw, 0) / calibration.length; phase = 'neutral'; neutralAt = timestamp; }
        return null;
      }
      const relative = yaw - baseline;
      if (phase === 'cooldown' || phase === 'neutral') {
        if (Math.abs(relative) <= 8) { neutralAt ??= timestamp; if (timestamp - neutralAt >= 300 && timestamp - firedAt >= 1500) phase = 'armed'; }
        else neutralAt = null;
        return null;
      }
      if (Math.abs(relative) < 25) { phase = 'armed'; heldAt = null; direction = null; return null; }
      const next: -1 | 1 = relative > 0 ? 1 : -1;
      if (direction !== next) { heldAt = timestamp; direction = next; }
      phase = 'holding';
      if (heldAt !== null && timestamp - heldAt >= holdMs) { firedAt = timestamp; phase = 'cooldown'; neutralAt = null; heldAt = null; direction = null; return next; }
      return null;
    },
  };
}
