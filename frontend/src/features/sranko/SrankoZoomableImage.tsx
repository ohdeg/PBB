import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';

const SCALE_MIN = 1;
const SCALE_MAX = 4;
const SCALE_STEP = 0.5;

export interface SrankoZoomableImageProps {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
}

interface PanOffset {
  x: number;
  y: number;
}

function clampScale(value: number): number {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, value));
}

function roundScale(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampOffset(
  offset: PanOffset,
  scale: number,
  width: number,
  height: number
): PanOffset {
  if (scale <= 1 || width <= 0 || height <= 0) {
    return { x: 0, y: 0 };
  }
  const maxX = ((scale - 1) * width) / 2;
  const maxY = ((scale - 1) * height) / 2;
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
}

/**
 * Portrait result viewer: +/- zoom buttons and drag-to-pan when zoomed.
 * No wheel / pinch zoom (explicit controls only).
 */
export function SrankoZoomableImage({
  src,
  alt,
  className,
  imageClassName,
}: SrankoZoomableImageProps): ReactElement {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(SCALE_MIN);
  const [offset, setOffset] = useState<PanOffset>({ x: 0, y: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  useEffect(() => {
    setScale(SCALE_MIN);
    setOffset({ x: 0, y: 0 });
    dragRef.current = null;
  }, [src]);

  function measure(): { width: number; height: number } {
    const el = viewportRef.current;
    if (!el) {
      return { width: 0, height: 0 };
    }
    return { width: el.clientWidth, height: el.clientHeight };
  }

  function applyScale(next: number): void {
    const clamped = roundScale(clampScale(next));
    const { width, height } = measure();
    setScale(clamped);
    setOffset((prev) => clampOffset(prev, clamped, width, height));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (scaleRef.current <= 1 || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const { width, height } = measure();
    setOffset(
      clampOffset(
        {
          x: drag.originX + (event.clientX - drag.startX),
          y: drag.originY + (event.clientY - drag.startY),
        },
        scaleRef.current,
        width,
        height
      )
    );
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const canZoomOut = scale > SCALE_MIN;
  const canZoomIn = scale < SCALE_MAX;
  const canPan = scale > 1;

  return (
    <div
      className={['sranko-zoomable', className].filter(Boolean).join(' ')}
    >
      <div
        ref={viewportRef}
        className={[
          'sranko-zoomable__viewport',
          canPan ? 'sranko-zoomable__viewport--pannable' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => {
          setScale(SCALE_MIN);
          setOffset({ x: 0, y: 0 });
        }}
      >
        <img
          className={['sranko-zoomable__img', imageClassName]
            .filter(Boolean)
            .join(' ')}
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        />
      </div>
      <div className="sranko-zoomable__controls" role="group" aria-label="확대·축소">
        <button
          type="button"
          className="sranko-zoomable__btn"
          aria-label="축소"
          disabled={!canZoomOut}
          onClick={() => applyScale(scale - SCALE_STEP)}
        >
          −
        </button>
        <button
          type="button"
          className="sranko-zoomable__btn"
          aria-label="확대"
          disabled={!canZoomIn}
          onClick={() => applyScale(scale + SCALE_STEP)}
        >
          +
        </button>
      </div>
    </div>
  );
}
