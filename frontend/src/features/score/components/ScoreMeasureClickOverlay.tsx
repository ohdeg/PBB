import { useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { getMeasureHighlightBounds, type MeasureLayoutInContainer } from '../utils/measureTiming';

interface ScoreMeasureClickOverlayProps {
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
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.hypot(deltaX, deltaY) <= TAP_MOVE_THRESHOLD_PX) {
      onMeasureClick(layout.measureIndex);
    }
  };

  const resetPointer = () => {
    pointerStartRef.current = null;
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onMeasureClick(layout.measureIndex);
    }
  };

  const highlightBounds = getMeasureHighlightBounds(layout);

  return (
    <div
      role="button"
      tabIndex={0}
      className="score-measure-hit"
      style={{
        top: `${Math.max(0, layout.topPx)}px`,
        left: `${Math.max(0, highlightBounds.leftPx)}px`,
        width: `${highlightBounds.widthPx}px`,
        height: `${layout.heightPx}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={resetPointer}
      onKeyDown={handleKeyDown}
      aria-label={t('viewer.selectMeasure', { measure: layout.measureIndex + 1 })}
    />
  );
}

export default function ScoreMeasureClickOverlay({
  layouts,
  enabled,
  onMeasureClick,
}: ScoreMeasureClickOverlayProps) {
  const t = useTranslation();

  if (!enabled || layouts.length === 0) return null;

  return (
    <div className="score-measure-overlay" aria-label={t('viewer.measureOverlayLabel')}>
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
