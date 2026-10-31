import type { AnnotationPoint, AnnotationStroke, HorizontalAnnotationSegment, HorizontalAnnotationStroke } from '../types/temporiAnnotation';
import type { MeasureLayoutInContainer } from './measureTiming';

const containingMeasure = (x: number, layouts: MeasureLayoutInContainer[]) => {
  let low = 0;
  let high = layouts.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (layouts[mid].leftPx <= x) low = mid; else high = mid - 1;
  }
  return layouts[low];
};
const relativePoint = (point: AnnotationPoint, layout: MeasureLayoutInContainer): AnnotationPoint => ({
  x: (point.x - layout.leftPx) / Math.max(layout.widthPx, 1),
  y: (point.y - layout.topPx) / Math.max(layout.heightPx, 1),
});

/** Interpolating boundaries also handles a coalesced pointer event spanning several bars. */
export function anchorHorizontalStroke(stroke: AnnotationStroke, inputLayouts: MeasureLayoutInContainer[]): HorizontalAnnotationStroke {
  const layouts = [...inputLayouts].sort((a, b) => a.leftPx - b.leftPx);
  const segments: HorizontalAnnotationSegment[] = [];
  if (layouts.length === 0) return { id: stroke.id, tool: stroke.tool, color: stroke.color, widthStaffRatio: 0, segments };
  const firstLayout = containingMeasure(stroke.points[0]?.x ?? 0, layouts);
  for (let index = 1; index < stroke.points.length; index += 1) {
    const start = stroke.points[index - 1];
    const end = stroke.points[index];
    const cuts = [0, 1];
    if (start.x !== end.x) {
      for (const layout of layouts.slice(1)) {
        const t = (layout.leftPx - start.x) / (end.x - start.x);
        if (t > 0 && t < 1) cuts.push(t);
      }
    }
    cuts.sort((a, b) => a - b);
    const at = (t: number) => ({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
    for (let cut = 1; cut < cuts.length; cut += 1) {
      const from = at(cuts[cut - 1]);
      const to = at(cuts[cut]);
      const layout = containingMeasure((from.x + to.x) / 2, layouts);
      let segment = segments.at(-1);
      if (!segment || segment.measureIndex !== layout.measureIndex) {
        segment = { measureIndex: layout.measureIndex, points: [relativePoint(from, layout)] };
        segments.push(segment);
      }
      segment.points.push(relativePoint(to, layout));
    }
  }
  return { id: stroke.id, tool: stroke.tool, color: stroke.color, widthStaffRatio: stroke.width / Math.max(firstLayout.heightPx, 1), segments };
}

export function projectHorizontalSegment(segment: HorizontalAnnotationSegment, layout: MeasureLayoutInContainer): AnnotationPoint[] {
  return segment.points.map((point) => ({ x: layout.leftPx + point.x * layout.widthPx, y: layout.topPx + point.y * layout.heightPx }));
}

export interface AnnotationCanvasBounds {
  left: number; top: number; width: number; height: number; dpr: number; backingWidth: number; backingHeight: number;
}
export function getAnnotationCanvasBounds(
  viewport: { left: number; top: number; width: number; height: number },
  content: { width: number; height: number },
  devicePixelRatio: number,
): AnnotationCanvasBounds {
  const left = Math.max(0, viewport.left - viewport.width / 4);
  const top = Math.max(0, viewport.top);
  const right = Math.min(content.width, viewport.left + viewport.width * 1.25);
  const width = Math.max(1, right - left);
  const height = Math.max(1, Math.min(content.height - top, viewport.height));
  const dpr = Math.min(Math.max(devicePixelRatio || 1, .1), 2, 4096 / width, 4096 / height, Math.sqrt(4000000 / (width * height)));
  return { left, top, width, height, dpr, backingWidth: Math.max(1, Math.floor(width * dpr)), backingHeight: Math.max(1, Math.floor(height * dpr)) };
}

function distanceToSegment(point: AnnotationPoint, a: AnnotationPoint, b: AnnotationPoint): number {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}
export function eraseHorizontalStrokes(strokes: HorizontalAnnotationStroke[], point: AnnotationPoint, radius: number, layouts: MeasureLayoutInContainer[]): HorizontalAnnotationStroke[] {
  const byIndex = new Map(layouts.map((layout) => [layout.measureIndex, layout]));
  return strokes.filter((stroke) => !stroke.segments.some((segment) => {
    const layout = byIndex.get(segment.measureIndex);
    if (!layout || point.x + radius < layout.leftPx || point.x - radius > layout.leftPx + layout.widthPx) return false;
    const points = projectHorizontalSegment(segment, layout);
    return points.some((next, index) => index > 0 && distanceToSegment(point, points[index - 1], next) <= radius + stroke.widthStaffRatio * layout.heightPx / 2);
  }));
}
