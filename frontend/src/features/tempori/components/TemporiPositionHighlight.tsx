import type { PlayheadHighlight } from '../utils/measureTiming';

interface TemporiPositionHighlightProps {
  highlight: PlayheadHighlight | null;
  visible: boolean;
  variant?: 'progress' | 'selection';
}

export default function TemporiPositionHighlight({
  highlight,
  visible,
  variant = 'progress',
}: TemporiPositionHighlightProps) {
  if (!visible || !highlight) return null;

  const measureLeftPx = highlight.measureLeftPx - highlight.lineLeftPx;

  return (
    <div className="tempori-highlight-layer" aria-hidden>
      <div
        className="tempori-highlight-line-wrap"
        style={{
          top: `${Math.max(0, highlight.lineTopPx)}px`,
          left: `${Math.max(0, highlight.lineLeftPx)}px`,
          width: `${highlight.lineWidthPx}px`,
          height: `${highlight.lineHeightPx}px`,
        }}
      >
        <div
          key={highlight.measureIndex}
          className={`tempori-highlight-measure tempori-highlight-measure--${variant}`}
          style={{
            left: `${measureLeftPx}px`,
            width: `${highlight.measureWidthPx}px`,
          }}
        />
      </div>
    </div>
  );
}
