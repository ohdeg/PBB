export type AnnotationTool = 'pen' | 'highlighter';

export type AnnotationToolMode = 'none' | AnnotationTool | 'eraser';

export interface AnnotationBrushSizes {
  pen: number;
  highlighter: number;
  eraser: number;
}

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface AnnotationStroke {
  id: string;
  tool: AnnotationTool;
  points: AnnotationPoint[];
  width: number;
  color: string;
}

export interface TemporiAnnotationDocument {
  version: 1;
  strokes: AnnotationStroke[];
}

/** Physical measure anchors; y intentionally may extend outside the staff rectangle. */
export interface HorizontalAnnotationSegment {
  measureIndex: number;
  points: AnnotationPoint[];
}
export interface HorizontalAnnotationStroke {
  id: string;
  tool: AnnotationTool;
  color: string;
  widthStaffRatio: number;
  segments: HorizontalAnnotationSegment[];
}
export interface HorizontalAnnotationDocument {
  version: 2;
  strokes: HorizontalAnnotationStroke[];
}
/** A failed flush retains the current document and prevents view teardown. */
export interface AnnotationLayerHandle {
  flush: () => boolean;
  retryLoad?: () => boolean;
}
