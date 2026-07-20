import type { AnnotationBrushSizes } from '../types/scoreAnnotation';

export const ANNOTATION_BRUSH_SIZES_STORAGE_KEY = 'music-viewer:annotation-brush-sizes';

export const DEFAULT_ANNOTATION_BRUSH_SIZES: AnnotationBrushSizes = {
  pen: 2.5,
  highlighter: 20,
  eraser: 16,
};

export const ANNOTATION_BRUSH_SIZE_LIMITS = {
  pen: { min: 1, max: 8, step: 0.5 },
  highlighter: { min: 8, max: 44, step: 2 },
  eraser: { min: 8, max: 48, step: 2 },
} as const;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const normalizeAnnotationBrushSizes = (
  sizes: Partial<AnnotationBrushSizes> | null | undefined,
): AnnotationBrushSizes => ({
  pen: clamp(
    sizes?.pen ?? DEFAULT_ANNOTATION_BRUSH_SIZES.pen,
    ANNOTATION_BRUSH_SIZE_LIMITS.pen.min,
    ANNOTATION_BRUSH_SIZE_LIMITS.pen.max,
  ),
  highlighter: clamp(
    sizes?.highlighter ?? DEFAULT_ANNOTATION_BRUSH_SIZES.highlighter,
    ANNOTATION_BRUSH_SIZE_LIMITS.highlighter.min,
    ANNOTATION_BRUSH_SIZE_LIMITS.highlighter.max,
  ),
  eraser: clamp(
    sizes?.eraser ?? DEFAULT_ANNOTATION_BRUSH_SIZES.eraser,
    ANNOTATION_BRUSH_SIZE_LIMITS.eraser.min,
    ANNOTATION_BRUSH_SIZE_LIMITS.eraser.max,
  ),
});

export const loadAnnotationBrushSizes = (): AnnotationBrushSizes => {
  try {
    const raw = localStorage.getItem(ANNOTATION_BRUSH_SIZES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ANNOTATION_BRUSH_SIZES };
    return normalizeAnnotationBrushSizes(JSON.parse(raw) as Partial<AnnotationBrushSizes>);
  } catch {
    return { ...DEFAULT_ANNOTATION_BRUSH_SIZES };
  }
};

export const saveAnnotationBrushSizes = (sizes: AnnotationBrushSizes): void => {
  localStorage.setItem(ANNOTATION_BRUSH_SIZES_STORAGE_KEY, JSON.stringify(sizes));
};
