import type { PlayheadHighlight } from '../utils/measureTiming';

interface ScorePositionHighlightProps {
  highlight: PlayheadHighlight | null;
  visible: boolean;
  variant?: 'progress' | 'selection';
}

export default function ScorePositionHighlight({
  highlight,
  visible,
  variant = 'progress',
}: ScorePositionHighlightProps) {
  if (!visible || !highlight) return null;

  const measureLeftPx = highlight.measureLeftPx - highlight.lineLeftPx;

  return (
    <div className="score-highlight-layer" aria-hidden>
      <div
        className="score-highlight-line-wrap"
        style={{
          top: `${Math.max(0, highlight.lineTopPx)}px`,
          left: `${Math.max(0, highlight.lineLeftPx)}px`,
          width: `${highlight.lineWidthPx}px`,
          height: `${highlight.lineHeightPx}px`,
        }}
      >
        <div
          key={highlight.measureIndex}
          className={`score-highlight-measure score-highlight-measure--${variant}`}
          style={{
            left: `${measureLeftPx}px`,
            width: `${highlight.measureWidthPx}px`,
          }}
        />
      </div>
    </div>
  );
}
