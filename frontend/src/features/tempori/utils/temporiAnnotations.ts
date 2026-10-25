import { TEMPORI_STORAGE } from '../constants/temporiStorage';
import type { TemporiAnnotationDocument } from '../types/temporiAnnotation';

const STORAGE_PREFIX = TEMPORI_STORAGE.annotationsPrefix;

export const createEmptyAnnotationDocument = (): TemporiAnnotationDocument => ({
  version: 1,
  strokes: [],
});

export const loadTemporiAnnotations = (temporiId: string): TemporiAnnotationDocument => {
  if (!temporiId) return createEmptyAnnotationDocument();

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
  localStorage.setItem(`${STORAGE_PREFIX}${temporiId}`, JSON.stringify(document));
};

export const clearTemporiAnnotations = (temporiId: string): void => {
  if (!temporiId) return;
  localStorage.removeItem(`${STORAGE_PREFIX}${temporiId}`);
};

export const clearAnnotationsForTemporiIds = (temporiIds: string[]): void => {
  temporiIds.forEach((temporiId) => clearTemporiAnnotations(temporiId));
};
