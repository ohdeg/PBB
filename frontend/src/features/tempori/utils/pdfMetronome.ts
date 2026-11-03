import { clampBeatCount, type BeatStrengthLevel } from './beatStrength';

export const PDF_BEAT_TYPES = [1, 2, 4, 8, 16] as const;
export interface PdfMetronomeSettings {
  beatsPerMeasure: number;
  beatType: number;
  beatStrengths: readonly BeatStrengthLevel[];
}
export const defaultPdfMetronome = (): PdfMetronomeSettings => ({ beatsPerMeasure: 4, beatType: 4, beatStrengths: ['strong', 'medium', 'medium', 'medium'] });
export function resizePdfBeatStrengths(current: readonly BeatStrengthLevel[], count: number): BeatStrengthLevel[] {
  return Array.from({ length: clampBeatCount(count) }, (_, index) => current[index] ?? (index === 0 ? 'strong' : 'medium'));
}
/** BPM denotes quarter notes, matching MusicXML practice playback. */
export const pdfMetronomeIntervalMs = (bpm: number, beatType: number): number => 60000 / bpm * 4 / beatType;
export function pdfMetronomeBeat(elapsedMs: number, bpm: number, settings: PdfMetronomeSettings) {
  const index = Math.floor(Math.max(0, elapsedMs) / pdfMetronomeIntervalMs(bpm, settings.beatType)) % settings.beatsPerMeasure;
  return { index, strength: settings.beatStrengths[index] ?? (index === 0 ? 'strong' : 'medium') };
}
export function isPdfMetronomeSettings(value: unknown): value is PdfMetronomeSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const settings = value as Record<string, unknown>;
  return typeof settings.beatsPerMeasure === 'number' && Number.isInteger(settings.beatsPerMeasure) && settings.beatsPerMeasure >= 1 && settings.beatsPerMeasure <= 16 && PDF_BEAT_TYPES.some(type => type === settings.beatType) && Array.isArray(settings.beatStrengths) && settings.beatStrengths.length === settings.beatsPerMeasure && settings.beatStrengths.every(strength => ['strong', 'medium', 'weak', 'silent'].includes(strength));
}
