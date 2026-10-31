import { describe, expect, it } from 'vitest';
import { anchorHorizontalStroke, projectHorizontalSegment, getAnnotationCanvasBounds, eraseHorizontalStrokes } from './horizontalAnnotations';
import type { MeasureLayoutInContainer } from './measureTiming';
const layouts: MeasureLayoutInContainer[] = Array.from({ length: 4 }, (_, measureIndex) => ({ measureIndex, leftPx: measureIndex * 100, topPx: 50, widthPx: 100, heightPx: 100 }));
describe('horizontal annotation geometry', () => {
  it('splits a single long edge at every crossed bar, keeping one undo/erase stroke and outside-staff y', () => {
    const stroke = anchorHorizontalStroke({ id: 'one', tool: 'pen', color: '#000', width: 4, points: [{ x: 20, y: 20 }, { x: 380, y: 200 }] }, layouts);
    expect(stroke.id).toBe('one');
    expect(stroke.widthStaffRatio).toBe(.04);
    expect(stroke.segments.map((s) => s.measureIndex)).toEqual([0, 1, 2, 3]);
    expect(stroke.segments[0].points[0]).toEqual({ x: .2, y: -.3 });
    expect(stroke.segments[3].points.at(-1)).toEqual({ x: .8, y: 1.5 });
    expect(stroke.segments[1].points[0].x).toBe(0);
    expect(stroke.segments[1].points.at(-1)?.x).toBe(1);
  });
  it('reprojects by physical measure after width/position/height changes and supports backwards crossings', () => {
    const stroke = anchorHorizontalStroke({ id: 'back', tool: 'pen', color: '#000', width: 4, points: [{ x: 250, y: 100 }, { x: 50, y: 100 }] }, layouts);
    expect(stroke.segments.map((s) => s.measureIndex)).toEqual([2, 1, 0]);
    const projected = projectHorizontalSegment(stroke.segments[0], { ...layouts[2], leftPx: 1000, topPx: 20, widthPx: 200, heightPx: 80 });
    expect(projected[0]).toEqual({ x: 1100, y: 60 });
  });
  it('caps each backing canvas by visible area, 4 MP, 4096 per side and DPR 2', () => {
    for (const [width, height, dpr] of [[390, 800, 3], [2048, 2732, 3], [8000, 6000, 4]]) {
      const bounds = getAnnotationCanvasBounds({ left: 5000, top: 100, width, height }, { width: 100000, height: 10000 }, dpr);
      expect(bounds.width).toBeLessThanOrEqual(width * 1.5);
      expect(bounds.backingWidth).toBeLessThanOrEqual(4096);
      expect(bounds.backingHeight).toBeLessThanOrEqual(4096);
      expect(bounds.backingWidth * bounds.backingHeight * 2).toBeLessThanOrEqual(8000000);
      expect(bounds.dpr).toBeLessThanOrEqual(2);
      expect(bounds.left).toBeGreaterThan(0);
    }
  });
  it('keeps each side overscan within 25% even at the beginning and end', () => {
    const start = getAnnotationCanvasBounds({ left: 0, top: 0, width: 100, height: 100 }, { width: 1000, height: 100 }, 2);
    expect(start.left + start.width).toBe(125);
    const end = getAnnotationCanvasBounds({ left: 900, top: 0, width: 100, height: 100 }, { width: 1000, height: 100 }, 2);
    expect(end.left).toBe(875); expect(end.left + end.width).toBe(1000);
  });
  it('erases one logical stroke if any of its measure segments intersects the eraser', () => {
    const cross = anchorHorizontalStroke({ id: 'cross', tool: 'pen', color: '#000', width: 4, points: [{ x: 20, y: 100 }, { x: 380, y: 100 }] }, layouts);
    const other = anchorHorizontalStroke({ id: 'other', tool: 'pen', color: '#000', width: 4, points: [{ x: 20, y: 40 }, { x: 80, y: 40 }] }, layouts);
    expect(eraseHorizontalStrokes([cross, other], { x: 250, y: 100 }, 10, layouts).map((s) => s.id)).toEqual(['other']);
  });
});
