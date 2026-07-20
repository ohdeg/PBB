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

export interface ScoreAnnotationDocument {
  version: 1;
  strokes: AnnotationStroke[];
}
