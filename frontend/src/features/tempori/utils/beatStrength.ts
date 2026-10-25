export type BeatStrengthLevel = 'silent' | 'weak' | 'medium' | 'strong';

export const BEAT_STRENGTH_LEVELS: BeatStrengthLevel[] = ['silent', 'weak', 'medium', 'strong'];

export const BEAT_STRENGTH_LABELS: Record<BeatStrengthLevel, string> = {
  silent: '무음',
  weak: '약',
  medium: '중간',
  strong: '강',
};

const BEAT_STRENGTH_CYCLE: BeatStrengthLevel[] = ['strong', 'medium', 'weak', 'silent'];

export function getActiveBeatInMeasure(
  elapsedMs: number,
  bpm: number,
  beatsPerMeasure: number,
): number {
  const safeBpm = bpm > 0 ? bpm : 120;
  const safeBeats = clampBeatCount(beatsPerMeasure);
  const beatIntervalMs = 60000 / safeBpm;
  const beatIndex = Math.floor(Math.max(0, elapsedMs) / beatIntervalMs);
  return beatIndex % safeBeats;
}

export function cycleBeatStrength(current: BeatStrengthLevel): BeatStrengthLevel {
  const currentIndex = BEAT_STRENGTH_CYCLE.indexOf(current);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % BEAT_STRENGTH_CYCLE.length : 0;
  return BEAT_STRENGTH_CYCLE[nextIndex];
}

export interface BeatClickProfile {
  frequency: number;
  harmonicFrequency: number | null;
  oscillatorType: OscillatorType;
  harmonicGainRatio: number;
  peakGain: number;
  durationSec: number;
}

const BEAT_CLICK_PROFILES: Record<Exclude<BeatStrengthLevel, 'silent'>, BeatClickProfile> = {
  weak: {
    frequency: 392,
    harmonicFrequency: null,
    oscillatorType: 'sine',
    harmonicGainRatio: 0,
    peakGain: 0.14,
    durationSec: 0.032,
  },
  medium: {
    frequency: 740,
    harmonicFrequency: null,
    oscillatorType: 'triangle',
    harmonicGainRatio: 0,
    peakGain: 0.16,
    durationSec: 0.048,
  },
  strong: {
    frequency: 1244,
    harmonicFrequency: 1866,
    oscillatorType: 'square',
    harmonicGainRatio: 0.35,
    peakGain: 0.11,
    durationSec: 0.062,
  },
};

export function parseBeatStrengthLevel(value: string | null): BeatStrengthLevel | null {
  if (value === 'silent' || value === 'weak' || value === 'medium' || value === 'strong') {
    return value;
  }
  return null;
}

export function getBeatClickProfile(strength: BeatStrengthLevel): BeatClickProfile | null {
  if (strength === 'silent') return null;
  return BEAT_CLICK_PROFILES[strength];
}

export function createDefaultBeatStrengths(beatsPerMeasure: number): BeatStrengthLevel[] {
  const count = clampBeatCount(beatsPerMeasure);
  return Array.from({ length: count }, () => 'strong');
}

export function clampBeatCount(beatsPerMeasure: number): number {
  if (!Number.isFinite(beatsPerMeasure)) return 4;
  return Math.max(1, Math.min(16, Math.trunc(beatsPerMeasure)));
}

export function resizeBeatStrengths(
  current: BeatStrengthLevel[],
  beatsPerMeasure: number,
): BeatStrengthLevel[] {
  const count = clampBeatCount(beatsPerMeasure);
  return Array.from({ length: count }, (_, index) => current[index] ?? 'strong');
}
