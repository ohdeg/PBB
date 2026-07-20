import type { ScoreAnnotationDocument } from '../types/scoreAnnotation';

const STORAGE_PREFIX = 'music-viewer:annotations:';

export const createEmptyAnnotationDocument = (): ScoreAnnotationDocument => ({
  version: 1,
  strokes: [],
});

export const loadScoreAnnotations = (scoreId: string): ScoreAnnotationDocument => {
  if (!scoreId) return createEmptyAnnotationDocument();

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${scoreId}`);
    if (!raw) return createEmptyAnnotationDocument();

    const parsed = JSON.parse(raw) as ScoreAnnotationDocument;
    if (parsed.version !== 1 || !Array.isArray(parsed.strokes)) {
      return createEmptyAnnotationDocument();
    }

    return parsed;
  } catch {
    return createEmptyAnnotationDocument();
  }
};

export const saveScoreAnnotations = (scoreId: string, document: ScoreAnnotationDocument): void => {
  if (!scoreId) return;
  localStorage.setItem(`${STORAGE_PREFIX}${scoreId}`, JSON.stringify(document));
};

export const clearScoreAnnotations = (scoreId: string): void => {
  if (!scoreId) return;
  localStorage.removeItem(`${STORAGE_PREFIX}${scoreId}`);
};

export const clearAnnotationsForScoreIds = (scoreIds: string[]): void => {
  scoreIds.forEach((scoreId) => clearScoreAnnotations(scoreId));
};
