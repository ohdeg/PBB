export const MIN_TRANSPOSE_SEMITONES = -11;
export const MAX_TRANSPOSE_SEMITONES = 11;

export function clampTransposeSemitones(semitones: number): number {
  if (!Number.isFinite(semitones)) return 0;
  return Math.max(MIN_TRANSPOSE_SEMITONES, Math.min(MAX_TRANSPOSE_SEMITONES, Math.trunc(semitones)));
}

export function formatTransposeLabel(semitones: number): string {
  if (semitones === 0) return '원조';
  const direction = semitones > 0 ? '↑' : '↓';
  return `${direction}${Math.abs(semitones)}반음`;
}
