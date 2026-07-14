import type { MeasureLayoutInContainer } from '../utils/measureTiming';

interface ScoreMeasureClickOverlayProps {
  layouts: MeasureLayoutInContainer[];
  enabled: boolean;
  onMeasureClick: (measureIndex: number) => void;
}

export default function ScoreMeasureClickOverlay({
  layouts,
  enabled,
  onMeasureClick,
}: ScoreMeasureClickOverlayProps) {
  if (!enabled || layouts.length === 0) return null;

  return (
    <div className="score-measure-overlay" aria-label="마디 선택">
      {layouts.map((layout) => (
        <button
          key={layout.measureIndex}
          type="button"
          className="score-measure-hit"
          style={{
            top: `${Math.max(0, layout.topPx)}px`,
            left: `${Math.max(0, layout.leftPx)}px`,
            width: `${layout.widthPx}px`,
            height: `${layout.heightPx}px`,
          }}
          onClick={() => onMeasureClick(layout.measureIndex)}
          aria-label={`마디 ${layout.measureIndex + 1} 선택`}
        />
      ))}
    </div>
  );
}
