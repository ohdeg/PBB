import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import type {
  AnnotationBrushSizes,
  AnnotationStroke,
  AnnotationTool,
  AnnotationToolMode,
} from '../types/scoreAnnotation';
import { applyEraserAtPoint } from '../utils/annotationEraser';
import {
  createEmptyAnnotationDocument,
  loadScoreAnnotations,
  saveScoreAnnotations,
} from '../utils/scoreAnnotations';

interface ScoreAnnotationLayerProps {
  scoreId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  tool: AnnotationToolMode;
  brushSizes: AnnotationBrushSizes;
  enabled: boolean;
}

interface LayerSize {
  width: number;
  height: number;
}

interface EraserCursor {
  x: number;
  y: number;
  isPressing: boolean;
}

const PEN_COLOR = '#1f2937';
const HIGHLIGHTER_COLOR = '#facc15';
const MIN_SEGMENT_PX = 1.2;

function createStrokeId(): string {
  return `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getStrokeStyle(stroke: AnnotationStroke): {
  color: string;
  width: number;
  alpha: number;
  composite: GlobalCompositeOperation;
} {
  if (stroke.tool === 'highlighter') {
    return {
      color: stroke.color,
      width: stroke.width,
      alpha: 0.38,
      composite: 'multiply',
    };
  }

  return {
    color: stroke.color,
    width: stroke.width,
    alpha: 1,
    composite: 'source-over',
  };
}

function applyStrokeStyle(context: CanvasRenderingContext2D, stroke: AnnotationStroke): void {
  const style = getStrokeStyle(stroke);
  context.globalCompositeOperation = style.composite;
  context.globalAlpha = style.alpha;
  context.strokeStyle = style.color;
  context.lineWidth = style.width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
}

function drawStrokePath(
  context: CanvasRenderingContext2D,
  stroke: AnnotationStroke,
  width: number,
  height: number,
): void {
  if (stroke.points.length < 2) return;

  context.beginPath();
  const first = stroke.points[0];
  context.moveTo(first.x * width, first.y * height);

  for (let index = 1; index < stroke.points.length; index += 1) {
    const point = stroke.points[index];
    context.lineTo(point.x * width, point.y * height);
  }

  context.stroke();
}

function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: AnnotationStroke,
  width: number,
  height: number,
): void {
  if (stroke.points.length < 2) return;

  context.save();
  applyStrokeStyle(context, stroke);
  drawStrokePath(context, stroke, width, height);
  context.restore();
}

function drawStrokeSegment(
  context: CanvasRenderingContext2D,
  stroke: AnnotationStroke,
  fromIndex: number,
  toIndex: number,
  width: number,
  height: number,
): void {
  const from = stroke.points[fromIndex];
  const to = stroke.points[toIndex];
  if (!from || !to) return;

  context.save();
  applyStrokeStyle(context, stroke);
  context.beginPath();
  context.moveTo(from.x * width, from.y * height);
  context.lineTo(to.x * width, to.y * height);
  context.stroke();
  context.restore();
}

function paintCommittedLayer(
  context: CanvasRenderingContext2D,
  strokes: AnnotationStroke[],
  width: number,
  height: number,
): void {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);

  const dpr = window.devicePixelRatio || 1;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  strokes.forEach((stroke) => drawStroke(context, stroke, width, height));
}

export default function ScoreAnnotationLayer({
  scoreId,
  containerRef,
  tool,
  brushSizes,
  enabled,
}: ScoreAnnotationLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const committedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<AnnotationStroke[]>([]);
  const activeStrokeRef = useRef<AnnotationStroke | null>(null);
  const layerSizeRef = useRef<LayerSize>({ width: 1, height: 1 });
  const containerRectRef = useRef<DOMRect | null>(null);
  const brushSizesRef = useRef(brushSizes);
  const eraserDirtyRef = useRef(false);
  const isErasingActiveRef = useRef(false);
  const [layerSize, setLayerSize] = useState<LayerSize>({ width: 1, height: 1 });
  const [eraserCursor, setEraserCursor] = useState<EraserCursor | null>(null);

  brushSizesRef.current = brushSizes;

  const isToolActive = tool !== 'none';
  const isDrawing = tool === 'pen' || tool === 'highlighter';
  const isErasing = tool === 'eraser';

  useEffect(() => {
    if (!isErasing) {
      isErasingActiveRef.current = false;
      setEraserCursor(null);
    }
  }, [isErasing]);

  const getDisplayContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d', { desynchronized: true, alpha: true });
  }, []);

  const getCommittedContext = useCallback(() => {
    if (!committedCanvasRef.current) {
      committedCanvasRef.current = document.createElement('canvas');
    }
    return committedCanvasRef.current.getContext('2d', { alpha: true });
  }, []);

  const persistStrokes = useCallback(() => {
    saveScoreAnnotations(scoreId, {
      version: 1,
      strokes: strokesRef.current,
    });
  }, [scoreId]);

  const paintCommitted = useCallback(() => {
    const committedContext = getCommittedContext();
    if (!committedContext || !committedCanvasRef.current) return;

    const { width, height } = layerSizeRef.current;
    paintCommittedLayer(committedContext, strokesRef.current, width, height);
  }, [getCommittedContext]);

  const blitCommittedToDisplay = useCallback(() => {
    const displayContext = getDisplayContext();
    const committedCanvas = committedCanvasRef.current;
    if (!displayContext || !committedCanvas) return;

    const dpr = window.devicePixelRatio || 1;
    displayContext.setTransform(1, 0, 0, 1, 0, 0);
    displayContext.clearRect(0, 0, displayContext.canvas.width, displayContext.canvas.height);
    displayContext.drawImage(committedCanvas, 0, 0);
    displayContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [getDisplayContext]);

  const paint = useCallback(() => {
    paintCommitted();
    blitCommittedToDisplay();
  }, [blitCommittedToDisplay, paintCommitted]);

  const resizeCanvasElement = useCallback((canvas: HTMLCanvasElement, width: number, height: number) => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }, []);

  const syncCanvasSize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const width = Math.max(container.scrollWidth, container.clientWidth, 1);
    const height = Math.max(container.scrollHeight, container.clientHeight, 1);

    layerSizeRef.current = { width, height };
    setLayerSize({ width, height });

    resizeCanvasElement(canvas, width, height);
    if (committedCanvasRef.current) {
      resizeCanvasElement(committedCanvasRef.current, width, height);
    }

    paint();
  }, [containerRef, paint, resizeCanvasElement]);

  useEffect(() => {
    if (!enabled) return;

    const document = loadScoreAnnotations(scoreId);
    strokesRef.current = document.strokes;
    activeStrokeRef.current = null;
    eraserDirtyRef.current = false;
    paint();
  }, [enabled, scoreId, paint]);

  useEffect(() => {
    if (!enabled) return;

    syncCanvasSize();

    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      syncCanvasSize();
    });
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [containerRef, enabled, syncCanvasSize]);

  const cacheContainerRect = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    containerRectRef.current = container.getBoundingClientRect();
  }, [containerRef]);

  const toPixelPoint = useCallback((clientX: number, clientY: number) => {
    const rect = containerRectRef.current;
    const { width, height } = layerSizeRef.current;
    if (!rect || width <= 0 || height <= 0) return null;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < 0 || x > width || y < 0 || y > height) return null;

    return { x, y };
  }, []);

  const toNormalizedPoint = useCallback((clientX: number, clientY: number) => {
    const pixel = toPixelPoint(clientX, clientY);
    const { width, height } = layerSizeRef.current;
    if (!pixel || width <= 0 || height <= 0) return null;

    return { x: pixel.x / width, y: pixel.y / height };
  }, [toPixelPoint]);

  const appendPoint = useCallback(
    (clientX: number, clientY: number, pressure: number) => {
      const activeStroke = activeStrokeRef.current;
      if (!activeStroke) return;

      const point = toNormalizedPoint(clientX, clientY);
      if (!point) return;

      const { width, height } = layerSizeRef.current;
      const pointPxX = point.x * width;
      const pointPxY = point.y * height;

      const lastPoint = activeStroke.points[activeStroke.points.length - 1];
      if (lastPoint) {
        const lastPxX = lastPoint.x * width;
        const lastPxY = lastPoint.y * height;
        if (Math.hypot(pointPxX - lastPxX, pointPxY - lastPxY) < MIN_SEGMENT_PX) {
          return;
        }
      }

      const activeTool = activeStroke.tool;
      const baseWidth = brushSizesRef.current;
      activeStroke.width =
        activeTool === 'pen'
          ? baseWidth.pen * (0.75 + pressure * 0.5)
          : baseWidth.highlighter * (0.85 + pressure * 0.3);

      const previousIndex = activeStroke.points.length - 1;
      activeStroke.points.push(point);

      if (previousIndex < 0) return;

      const displayContext = getDisplayContext();
      if (!displayContext) return;

      drawStrokeSegment(
        displayContext,
        activeStroke,
        previousIndex,
        previousIndex + 1,
        width,
        height,
      );
    },
    [getDisplayContext, toNormalizedPoint],
  );

  const beginStroke = useCallback(
    (clientX: number, clientY: number, pressure: number) => {
      if (!isDrawing) return;

      cacheContainerRect();
      blitCommittedToDisplay();

      const point = toNormalizedPoint(clientX, clientY);
      if (!point) return;

      const activeTool = tool as AnnotationTool;
      const sizes = brushSizesRef.current;
      const width =
        activeTool === 'pen'
          ? sizes.pen * (0.75 + pressure * 0.5)
          : sizes.highlighter * (0.85 + pressure * 0.3);

      activeStrokeRef.current = {
        id: createStrokeId(),
        tool: activeTool,
        points: [point],
        width,
        color: activeTool === 'pen' ? PEN_COLOR : HIGHLIGHTER_COLOR,
      };
    },
    [blitCommittedToDisplay, cacheContainerRect, isDrawing, toNormalizedPoint, tool],
  );

  const finishStroke = useCallback(() => {
    const activeStroke = activeStrokeRef.current;
    containerRectRef.current = null;

    if (!activeStroke) return;

    if (activeStroke.points.length >= 2) {
      strokesRef.current = [...strokesRef.current, activeStroke];
      persistStrokes();
      paintCommitted();
    }

    activeStrokeRef.current = null;
    blitCommittedToDisplay();
  }, [blitCommittedToDisplay, paintCommitted, persistStrokes]);

  const applyEraserPoints = useCallback(
    (clientX: number, clientY: number, isPressing: boolean) => {
      const pixel = toPixelPoint(clientX, clientY);
      if (!pixel) return;

      if (isErasing) {
        setEraserCursor({ x: pixel.x, y: pixel.y, isPressing });
      }

      if (!isPressing) return;

      const { width, height } = layerSizeRef.current;
      const beforePointCount = strokesRef.current.reduce((sum, stroke) => sum + stroke.points.length, 0);
      const nextStrokes = applyEraserAtPoint(
        strokesRef.current,
        pixel.x,
        pixel.y,
        width,
        height,
        brushSizesRef.current.eraser,
      );
      const afterPointCount = nextStrokes.reduce((sum, stroke) => sum + stroke.points.length, 0);

      const changed =
        nextStrokes.length !== strokesRef.current.length || afterPointCount !== beforePointCount;

      if (!changed) return;

      strokesRef.current = nextStrokes;
      eraserDirtyRef.current = true;
      paint();
    },
    [isErasing, paint, toPixelPoint],
  );

  const updateEraserHover = useCallback(
    (clientX: number, clientY: number, isPressing: boolean) => {
      if (!isErasing) return;

      if (!containerRectRef.current) {
        cacheContainerRect();
      }

      const pixel = toPixelPoint(clientX, clientY);
      if (!pixel) {
        setEraserCursor(null);
        return;
      }

      setEraserCursor({ x: pixel.x, y: pixel.y, isPressing });
    },
    [cacheContainerRect, isErasing, toPixelPoint],
  );

  const clearEraserCursor = useCallback(() => {
    setEraserCursor(null);
  }, []);

  const beginEraser = useCallback(
    (clientX: number, clientY: number) => {
      if (!isErasing) return;

      cacheContainerRect();
      eraserDirtyRef.current = false;
      isErasingActiveRef.current = true;
      applyEraserPoints(clientX, clientY, true);
    },
    [applyEraserPoints, cacheContainerRect, isErasing],
  );

  const finishEraser = useCallback(() => {
    containerRectRef.current = null;
    isErasingActiveRef.current = false;
    clearEraserCursor();

    if (eraserDirtyRef.current) {
      persistStrokes();
      eraserDirtyRef.current = false;
    }
  }, [clearEraserCursor, persistStrokes]);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isToolActive) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const pressure = event.pressure > 0 ? event.pressure : 0.5;

    if (isErasing) {
      beginEraser(event.clientX, event.clientY);
      return;
    }

    if (isDrawing) {
      beginStroke(event.clientX, event.clientY, pressure);
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isToolActive) return;

    event.preventDefault();
    event.stopPropagation();

    const nativeEvent = event.nativeEvent;
    const coalescedEvents =
      typeof nativeEvent.getCoalescedEvents === 'function'
        ? nativeEvent.getCoalescedEvents()
        : [nativeEvent];

    if (isErasing) {
      for (const coalescedEvent of coalescedEvents) {
        if (isErasingActiveRef.current) {
          applyEraserPoints(coalescedEvent.clientX, coalescedEvent.clientY, true);
        } else {
          updateEraserHover(coalescedEvent.clientX, coalescedEvent.clientY, false);
        }
      }
      return;
    }

    if (!isDrawing || !activeStrokeRef.current) return;

    const pressure = event.pressure > 0 ? event.pressure : 0.5;
    for (const coalescedEvent of coalescedEvents) {
      appendPoint(coalescedEvent.clientX, coalescedEvent.clientY, pressure);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isToolActive) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (isErasing) {
      applyEraserPoints(event.clientX, event.clientY, true);
      finishEraser();
      return;
    }

    if (!activeStrokeRef.current) return;

    const pressure = event.pressure > 0 ? event.pressure : 0.5;
    appendPoint(event.clientX, event.clientY, pressure);
    finishStroke();
  };

  const handlePointerCancel = () => {
    activeStrokeRef.current = null;
    containerRectRef.current = null;
    isErasingActiveRef.current = false;
    clearEraserCursor();

    if (eraserDirtyRef.current) {
      persistStrokes();
      eraserDirtyRef.current = false;
    }

    blitCommittedToDisplay();
  };

  const handlePointerLeave = () => {
    if (!isErasingActiveRef.current) {
      clearEraserCursor();
    }
  };

  useEffect(() => {
    if (!enabled) return;

    const handleClear = (event: Event) => {
      const customEvent = event as CustomEvent<{ scoreId: string }>;
      if (customEvent.detail?.scoreId !== scoreId) return;

      strokesRef.current = [];
      activeStrokeRef.current = null;
      containerRectRef.current = null;
      eraserDirtyRef.current = false;
      saveScoreAnnotations(scoreId, createEmptyAnnotationDocument());
      paint();
    };

    const handleUndo = (event: Event) => {
      const customEvent = event as CustomEvent<{ scoreId: string }>;
      if (customEvent.detail?.scoreId !== scoreId) return;

      strokesRef.current = strokesRef.current.slice(0, -1);
      persistStrokes();
      paint();
    };

    window.addEventListener('score-annotations-clear', handleClear);
    window.addEventListener('score-annotations-undo', handleUndo);

    return () => {
      window.removeEventListener('score-annotations-clear', handleClear);
      window.removeEventListener('score-annotations-undo', handleUndo);
    };
  }, [enabled, paint, persistStrokes, scoreId]);

  if (!enabled) return null;

  return (
    <div
      className={`score-annotation-layer${isToolActive ? ' score-annotation-layer--active' : ''}`}
      style={{ width: `${layerSize.width}px`, height: `${layerSize.height}px` }}
      onPointerLeave={handlePointerLeave}
    >
      <canvas
        ref={canvasRef}
        className="score-annotation-canvas"
        aria-hidden={!isToolActive}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />
      {isErasing && eraserCursor && (
        <div
          className={`score-eraser-indicator${eraserCursor.isPressing ? ' pressing' : ''}`}
          style={{
            width: `${brushSizes.eraser * 2}px`,
            height: `${brushSizes.eraser * 2}px`,
            transform: `translate(${eraserCursor.x - brushSizes.eraser}px, ${eraserCursor.y - brushSizes.eraser}px)`,
          }}
          aria-hidden
        />
      )}
    </div>
  );
}
