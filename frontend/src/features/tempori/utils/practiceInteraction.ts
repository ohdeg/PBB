export type MeasureInteractionMode = 'seek' | 'range';
export type TemporiRenderStatus = 'loading' | 'ready' | 'error';
export interface PendingPlayback { temporiId: string; revision: number }

/** Measure indexes are physical positions, independent of repeated playback steps. */
export function selectPracticeMeasure(mode: MeasureInteractionMode, start: number | null, index: number) {
  if (mode === 'seek') return { seekIndex: index, selectionStart: null, range: null };
  if (start === null) return { seekIndex: index, selectionStart: index + 1, range: null };
  const startMeasure = Math.min(start, index + 1);
  return {
    seekIndex: startMeasure - 1,
    selectionStart: null,
    range: { startMeasure, endMeasure: Math.max(start, index + 1) },
  };
}

export function canStartPendingPlayback(
  pending: PendingPlayback | null, temporiId: string, readyRevision: number,
  status: TemporiRenderStatus, hasTiming: boolean,
): boolean {
  return Boolean(pending && pending.temporiId === temporiId && pending.revision === readyRevision && status === 'ready' && hasTiming);
}

export function getResumeMeasureIndex(current: number, start: number, end: number, ended: boolean): number {
  return ended || current < start || current > end ? start : current;
}
