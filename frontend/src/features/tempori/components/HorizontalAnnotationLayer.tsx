import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type PointerEvent, type Ref, type RefObject } from 'react';
import type { AnnotationBrushSizes, AnnotationLayerHandle, AnnotationPoint, AnnotationStroke, AnnotationToolMode, HorizontalAnnotationStroke } from '../types/temporiAnnotation';
import type { MeasureLayoutInContainer } from '../utils/measureTiming';
import { anchorHorizontalStroke, eraseHorizontalStrokes, getAnnotationCanvasBounds, projectHorizontalSegment, type AnnotationCanvasBounds } from '../utils/horizontalAnnotations';
import { hasPendingAnnotationDraft, loadHorizontalAnnotations, saveHorizontalAnnotations } from '../utils/temporiAnnotations';

export type AnnotationError = 'save' | 'load' | null;
interface Props {
  ref?: Ref<AnnotationLayerHandle>;
  temporiId: string;
  containerRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  layouts: MeasureLayoutInContainer[];
  layoutKey?: string;
  tool: AnnotationToolMode;
  brushSizes: AnnotationBrushSizes;
  onError?: (error: AnnotationError) => void;
}
const initialBounds = getAnnotationCanvasBounds({ left: 0, top: 0, width: 1, height: 1 }, { width: 1, height: 1 }, 1);

/** Only this viewport crop has canvas backing pixels; the complete score remains SVG. */
export default function HorizontalAnnotationLayer({ ref, temporiId, containerRef, viewportRef, layouts, layoutKey, tool, brushSizes, onError }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<HorizontalAnnotationStroke[]>([]);
  const indexRef = useRef(new Map<number, Set<HorizontalAnnotationStroke>>());
  const activeRef = useRef<AnnotationStroke | null>(null);
  const pointerRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const lockedRef = useRef(false);
  const layoutsRef = useRef(layouts);
  const boundsRef = useRef(initialBounds);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const [bounds, setBounds] = useState<AnnotationCanvasBounds>(initialBounds);
  const [locked, setLocked] = useState(false);
  const [eraserPoint, setEraserPoint] = useState<AnnotationPoint | null>(null);

  const reindex = useCallback(() => {
    const index = new Map<number, Set<HorizontalAnnotationStroke>>();
    for (const stroke of strokesRef.current) for (const segment of stroke.segments) {
      if (!index.has(segment.measureIndex)) index.set(segment.measureIndex, new Set());
      index.get(segment.measureIndex)!.add(stroke);
    }
    indexRef.current = index;
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const crop = boundsRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(crop.dpr, 0, 0, crop.dpr, -crop.left * crop.dpr, -crop.top * crop.dpr);
    const visibleLayouts = layoutsRef.current.filter((layout) => layout.leftPx + layout.widthPx >= crop.left && layout.leftPx <= crop.left + crop.width);
    const visibleByIndex = new Map(visibleLayouts.map((layout) => [layout.measureIndex, layout]));
    const visible = new Set<HorizontalAnnotationStroke>();
    for (const layout of visibleLayouts) for (const stroke of indexRef.current.get(layout.measureIndex) ?? []) visible.add(stroke);
    const draw = (points: AnnotationPoint[], color: string, width: number, alpha: number) => {
      if (points.length < 2) return;
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    };
    for (const stroke of visible) for (const segment of stroke.segments) {
      const layout = visibleByIndex.get(segment.measureIndex);
      if (layout) draw(projectHorizontalSegment(segment, layout), stroke.color, stroke.widthStaffRatio * layout.heightPx, stroke.tool === 'highlighter' ? .3 : 1);
    }
    const active = activeRef.current;
    if (active) draw(active.points, active.color, active.width, active.tool === 'highlighter' ? .3 : 1);
    ctx.globalAlpha = 1;
  }, []);

  const persist = useCallback(() => {
    if (lockedRef.current || !dirtyRef.current) return true;
    try {
      // Synchronous save captures this mounted document's ID, never a later render's ID.
      saveHorizontalAnnotations(temporiId, { version: 2, strokes: strokesRef.current });
      dirtyRef.current = false; onErrorRef.current?.(null); return true;
    } catch { onErrorRef.current?.('save'); return false; }
  }, [temporiId]);

  const flush = useCallback(() => {
    const active = activeRef.current;
    activeRef.current = null; pointerRef.current = null;
    if (active && active.points.length >= 2) {
      const stroke = anchorHorizontalStroke(active, layoutsRef.current);
      if (stroke.segments.length) {
        strokesRef.current = [...strokesRef.current, stroke]; dirtyRef.current = true; reindex();
      }
    }
    setEraserPoint(null); paint();
    return persist();
  }, [paint, persist, reindex]);

  const load = useCallback(() => {
    const result = loadHorizontalAnnotations(temporiId);
    lockedRef.current = !result.ok; setLocked(!result.ok);
    if (result.ok) { strokesRef.current = result.document.strokes; dirtyRef.current = hasPendingAnnotationDraft(temporiId, 'horizontal'); reindex(); onErrorRef.current?.(dirtyRef.current ? 'save' : null); }
    else onErrorRef.current?.('load');
    paint();
    return result.ok;
  }, [temporiId, paint, reindex]);

  useImperativeHandle(ref, () => ({ flush, retryLoad: load }), [flush, load]);

  useEffect(() => { load(); return () => { flush(); }; }, [load, flush]);
  useLayoutEffect(() => {
    // Commit against the old rectangles before replacing them on rotation/transpose.
    if (layoutsRef.current !== layouts) flush();
    layoutsRef.current = layouts; paint();
  }, [layouts, flush, paint]);

  useEffect(() => {
    const content = containerRef.current; const viewport = viewportRef.current;
    if (!content || !viewport) return;
    let frame = 0;
    const sync = () => {
      const rect = content.getBoundingClientRect();
      const visibleTop = window.visualViewport?.offsetTop ?? 0;
      const top = Math.max(0, visibleTop - rect.top);
      const height = Math.max(1, Math.min(content.scrollHeight - top, (window.visualViewport?.height ?? window.innerHeight) - Math.max(rect.top - visibleTop, 0)));
      const crop = getAnnotationCanvasBounds({ left: viewport.scrollLeft, top, width: Math.max(viewport.clientWidth, 1), height }, { width: Math.max(content.scrollWidth, content.clientWidth, 1), height: Math.max(content.scrollHeight, content.clientHeight, 1) }, window.devicePixelRatio);
      boundsRef.current = crop; setBounds(crop);
      const canvas = canvasRef.current;
      if (canvas && (canvas.width !== crop.backingWidth || canvas.height !== crop.backingHeight)) { canvas.width = crop.backingWidth; canvas.height = crop.backingHeight; }
      paint();
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(sync); };
    const resize = () => { flush(); schedule(); };
    sync();
    const observer = new ResizeObserver(resize); observer.observe(viewport); observer.observe(content);
    const scoreRoot = content.closest('.tempori');
    if (scoreRoot) observer.observe(scoreRoot);
    viewport.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('orientationchange', resize);
    window.visualViewport?.addEventListener('resize', resize);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); viewport.removeEventListener('scroll', schedule); window.removeEventListener('scroll', schedule); window.removeEventListener('orientationchange', resize); window.visualViewport?.removeEventListener('resize', resize); };
  }, [containerRef, viewportRef, paint, flush, layoutKey]);

  useEffect(() => {
    const matches = (event: Event) => { const detail = (event as CustomEvent).detail; return detail?.temporiId === temporiId && detail?.viewMode === 'horizontal'; };
    const clear = (event: Event) => {
      if (!matches(event) || lockedRef.current) return;
      activeRef.current = null; pointerRef.current = null; strokesRef.current = []; dirtyRef.current = true; reindex(); persist(); paint();
    };
    const undo = (event: Event) => {
      if (!matches(event) || lockedRef.current) return;
      flush(); strokesRef.current = strokesRef.current.slice(0, -1); dirtyRef.current = true; reindex(); persist(); paint();
    };
    window.addEventListener('tempori-annotations-clear', clear); window.addEventListener('tempori-annotations-undo', undo);
    const unload = (event: BeforeUnloadEvent) => { if (!flush()) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', unload);
    return () => { window.removeEventListener('tempori-annotations-clear', clear); window.removeEventListener('tempori-annotations-undo', undo); window.removeEventListener('beforeunload', unload); };
  }, [temporiId, flush, persist, paint, reindex]);

  // Switching tools must not abandon a captured pen stroke.
  useEffect(() => { flush(); }, [tool, flush]);

  const point = (event: { clientX: number; clientY: number }): AnnotationPoint | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : null;
  };
  const append = (event: { clientX: number; clientY: number }) => {
    const next = point(event); if (!next) return;
    if (tool === 'eraser') {
      setEraserPoint(next);
      const nearby = layoutsRef.current.filter((layout) => next.x + brushSizes.eraser >= layout.leftPx && next.x - brushSizes.eraser <= layout.leftPx + layout.widthPx);
      const candidates = new Set<HorizontalAnnotationStroke>();
      for (const layout of nearby) for (const stroke of indexRef.current.get(layout.measureIndex) ?? []) candidates.add(stroke);
      const remaining = new Set(eraseHorizontalStrokes([...candidates], next, brushSizes.eraser, nearby));
      if (remaining.size !== candidates.size) {
        strokesRef.current = strokesRef.current.filter((stroke) => !candidates.has(stroke) || remaining.has(stroke));
        dirtyRef.current = true; reindex();
      }
    } else if (activeRef.current) {
      const previous = activeRef.current.points.at(-1)!;
      if (Math.hypot(next.x - previous.x, next.y - previous.y) >= 1) activeRef.current.points.push(next);
    }
  };
  const finishPointer = (event: PointerEvent<HTMLCanvasElement>, cancelled = false) => {
    if (pointerRef.current === null || pointerRef.current !== event.pointerId) return;
    if (!cancelled) append(event);
    flush();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const active = tool !== 'none' && !locked;
  return <div className={`tempori-annotation-layer${active ? ' tempori-annotation-layer--active' : ''}`}
    style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}>
    <canvas ref={canvasRef} data-testid="horizontal-annotation-canvas" className="tempori-annotation-canvas" aria-hidden
      style={{ width: bounds.width, height: bounds.height }}
      onPointerDown={(event) => {
        if (!active || pointerRef.current !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault(); event.stopPropagation();
        const first = point(event); if (!first || !layoutsRef.current.length) return;
        pointerRef.current = event.pointerId;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        if (tool === 'pen' || tool === 'highlighter') activeRef.current = { id: crypto.randomUUID(), tool, color: tool === 'pen' ? '#1f2937' : '#facc15', width: brushSizes[tool], points: [first] };
        else append(event);
        paint();
      }}
      onPointerMove={(event) => {
        if (!active || pointerRef.current === null || pointerRef.current !== event.pointerId) return;
        event.preventDefault(); event.stopPropagation();
        const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
        for (const sample of events) append(sample);
        paint();
      }}
      onPointerUp={(event) => finishPointer(event)}
      onPointerCancel={(event) => finishPointer(event, true)}
      onLostPointerCapture={(event) => finishPointer(event, true)} />
    {tool === 'eraser' && eraserPoint && <div className="tempori-eraser-indicator pressing" aria-hidden style={{ width: brushSizes.eraser * 2, height: brushSizes.eraser * 2, transform: `translate(${eraserPoint.x - bounds.left - brushSizes.eraser}px, ${eraserPoint.y - bounds.top - brushSizes.eraser}px)` }} />}
  </div>;
}
