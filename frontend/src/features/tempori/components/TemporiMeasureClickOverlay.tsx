import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { getMeasureHighlightBounds, type MeasureLayoutInContainer } from '../utils/measureTiming';

interface TemporiMeasureClickOverlayProps {
  layouts: MeasureLayoutInContainer[];
  enabled: boolean;
  onMeasureClick: (measureIndex: number) => void;
}

interface MeasureHitTargetProps {
  layout: MeasureLayoutInContainer;
  onMeasureClick: (measureIndex: number) => void;
}

const TAP_MOVE_THRESHOLD_PX = 12;

function MeasureHitTarget({ layout, onMeasureClick }: MeasureHitTargetProps) {
  const t = useTranslation();
  const movedRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    movedRef.current = false;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    movedRef.current = Math.hypot(deltaX, deltaY) > TAP_MOVE_THRESHOLD_PX;
  };

  const resetPointer = () => {
    pointerStartRef.current = null;
    movedRef.current = true;
  };

  const highlightBounds = getMeasureHighlightBounds(layout);

  return (
    <button
      type="button"
      className="tempori-measure-hit"
      style={{
        top: `${Math.max(0, layout.topPx)}px`,
        left: `${Math.max(0, highlightBounds.leftPx)}px`,
        width: `${highlightBounds.widthPx}px`,
        height: `${layout.heightPx}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={resetPointer}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') movedRef.current = false;
      }}
      onClick={() => {
        if (!movedRef.current) onMeasureClick(layout.measureIndex);
        movedRef.current = false;
      }}
      aria-label={t('viewer.selectMeasure', { measure: layout.measureIndex + 1 })}
    />
  );
}

export default function TemporiMeasureClickOverlay({
  layouts,
  enabled,
  onMeasureClick,
}: TemporiMeasureClickOverlayProps) {
  const t = useTranslation();

  if (!enabled || layouts.length === 0) return null;

  return (
    <div className="tempori-measure-overlay" aria-label={t('viewer.measureOverlayLabel')}>
      {layouts.map((layout) => (
        <MeasureHitTarget
          key={layout.measureIndex}
          layout={layout}
          onMeasureClick={onMeasureClick}
        />
      ))}
    </div>
  );
}
