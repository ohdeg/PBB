import type { AnnotationPoint, AnnotationStroke } from '../types/scoreAnnotation';

export const ERASER_RADIUS_PX = 16;

function distancePointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;

  if (abLenSq === 0) {
    return Math.hypot(apx, apy);
  }

  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
  const closestX = ax + t * abx;
  const closestY = ay + t * aby;
  return Math.hypot(px - closestX, py - closestY);
}

function isSegmentErasedByPoint(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  eraserX: number,
  eraserY: number,
  radiusPx: number,
): boolean {
  return distancePointToSegment(eraserX, eraserY, ax, ay, bx, by) <= radiusPx;
}

function isPointErasedByPoint(
  px: number,
  py: number,
  eraserX: number,
  eraserY: number,
  radiusPx: number,
): boolean {
  return Math.hypot(px - eraserX, py - eraserY) <= radiusPx;
}

function splitStrokeByEraserPoint(
  stroke: AnnotationStroke,
  eraserX: number,
  eraserY: number,
  layerWidth: number,
  layerHeight: number,
  radiusPx: number,
): AnnotationStroke[] {
  const hitRadius = radiusPx + stroke.width * 0.45;
  const fragments: AnnotationStroke[] = [];
  let currentPoints: AnnotationPoint[] = [];

  const flush = () => {
    if (currentPoints.length >= 2) {
      fragments.push({
        ...stroke,
        id: `${stroke.id}-${fragments.length}-${Date.now()}`,
        points: [...currentPoints],
      });
    }
    currentPoints = [];
  };

  stroke.points.forEach((point, index) => {
    const px = point.x * layerWidth;
    const py = point.y * layerHeight;

    if (index > 0) {
      const previous = stroke.points[index - 1];
      const previousPx = previous.x * layerWidth;
      const previousPy = previous.y * layerHeight;

      if (isSegmentErasedByPoint(previousPx, previousPy, px, py, eraserX, eraserY, hitRadius)) {
        flush();
        if (!isPointErasedByPoint(px, py, eraserX, eraserY, hitRadius)) {
          currentPoints.push(point);
        }
        return;
      }
    }

    if (isPointErasedByPoint(px, py, eraserX, eraserY, hitRadius)) {
      flush();
      return;
    }

    currentPoints.push(point);
  });

  flush();
  return fragments;
}

export function applyEraserAtPoint(
  strokes: AnnotationStroke[],
  eraserX: number,
  eraserY: number,
  layerWidth: number,
  layerHeight: number,
  radiusPx: number = ERASER_RADIUS_PX,
): AnnotationStroke[] {
  return strokes.flatMap((stroke) =>
    splitStrokeByEraserPoint(stroke, eraserX, eraserY, layerWidth, layerHeight, radiusPx),
  );
}
