import { TEMPORI_STORAGE } from '../constants/temporiStorage';
import type { TemporiAnnotationDocument, HorizontalAnnotationDocument } from '../types/temporiAnnotation';

const STORAGE_PREFIX = TEMPORI_STORAGE.annotationsPrefix;
// Failed synchronous saves survive SPA history/programmatic unmounts. Successful writes/clears remove them.
const pendingWrapped = new Map<string, TemporiAnnotationDocument>();
const pendingHorizontal = new Map<string, HorizontalAnnotationDocument>();
export const hasPendingAnnotationDraft = (id: string, mode: 'wrapped' | 'horizontal'): boolean =>
  (mode === 'wrapped' ? pendingWrapped : pendingHorizontal).has(id);

export const createEmptyAnnotationDocument = (): TemporiAnnotationDocument => ({
  version: 1,
  strokes: [],
});

export const loadTemporiAnnotations = (temporiId: string): TemporiAnnotationDocument => {
  if (!temporiId) return createEmptyAnnotationDocument();
  const pending = pendingWrapped.get(temporiId);
  if (pending) return pending;

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${temporiId}`);
    if (!raw) return createEmptyAnnotationDocument();

    const parsed = JSON.parse(raw) as TemporiAnnotationDocument;
    if (parsed.version !== 1 || !Array.isArray(parsed.strokes)) {
      return createEmptyAnnotationDocument();
    }

    return parsed;
  } catch {
    return createEmptyAnnotationDocument();
  }
};

export const saveTemporiAnnotations = (temporiId: string, document: TemporiAnnotationDocument): void => {
  if (!temporiId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${temporiId}`, JSON.stringify(document));
    pendingWrapped.delete(temporiId);
  } catch (error) { pendingWrapped.set(temporiId, document); throw error; }
};

export const clearTemporiAnnotations = (temporiId: string): void => {
  if (!temporiId) return;
  // Cleanup is idempotent; a caller can retry after the score record was already deleted.
  localStorage.removeItem(`${STORAGE_PREFIX}${temporiId}`);
  localStorage.removeItem(`${TEMPORI_STORAGE.horizontalAnnotationsPrefix}${temporiId}`);
  pendingWrapped.delete(temporiId); pendingHorizontal.delete(temporiId);
};

export const clearAnnotationsForTemporiIds = (temporiIds: string[]): void => {
  temporiIds.forEach((temporiId) => clearTemporiAnnotations(temporiId));
};


function isHorizontalDocument(value: unknown): value is HorizontalAnnotationDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as HorizontalAnnotationDocument;
  return document.version === 2 && Array.isArray(document.strokes) && document.strokes.every((stroke) =>
    stroke && typeof stroke.id === 'string' && (stroke.tool === 'pen' || stroke.tool === 'highlighter') &&
    typeof stroke.color === 'string' && Number.isFinite(stroke.widthStaffRatio) && stroke.widthStaffRatio > 0 &&
    Array.isArray(stroke.segments) && stroke.segments.length > 0 && stroke.segments.every((segment) =>
      segment && Number.isInteger(segment.measureIndex) && segment.measureIndex >= 0 &&
      Array.isArray(segment.points) && segment.points.length >= 2 && segment.points.every((point) =>
        point && Number.isFinite(point.x) && Number.isFinite(point.y))));
}

export function loadHorizontalAnnotations(temporiId: string): { ok: true; document: HorizontalAnnotationDocument } | { ok: false } {
  const pending = pendingHorizontal.get(temporiId);
  if (pending) return { ok: true, document: pending };
  try {
    const raw = temporiId ? localStorage.getItem(`${TEMPORI_STORAGE.horizontalAnnotationsPrefix}${temporiId}`) : null;
    if (!raw) return { ok: true, document: { version: 2, strokes: [] } };
    const parsed: unknown = JSON.parse(raw);
    return isHorizontalDocument(parsed) ? { ok: true, document: parsed } : { ok: false };
  } catch { return { ok: false }; }
}

export function saveHorizontalAnnotations(temporiId: string, document: HorizontalAnnotationDocument): void {
  if (!temporiId) return;
  try {
    localStorage.setItem(`${TEMPORI_STORAGE.horizontalAnnotationsPrefix}${temporiId}`, JSON.stringify(document));
    pendingHorizontal.delete(temporiId);
  } catch (error) { pendingHorizontal.set(temporiId, document); throw error; }
}


export class AnnotationCleanupError extends Error {
  readonly temporiIds: string[];
  constructor(temporiIds: string[]) { super('Annotation cleanup failed after score deletion'); this.name = 'AnnotationCleanupError'; this.temporiIds = temporiIds; }
}

/** Retry this operation directly; the corresponding score records have already been deleted. */
export function cleanupDeletedTemporiAnnotations(temporiIds: string[]): void {
  const failed: string[] = [];
  for (const id of temporiIds) {
    try { clearTemporiAnnotations(id); } catch { failed.push(id); }
  }
  if (failed.length) throw new AnnotationCleanupError(failed);
}
