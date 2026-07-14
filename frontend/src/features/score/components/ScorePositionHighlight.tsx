import type { PlayheadHighlight } from '../utils/measureTiming';

interface ScorePositionHighlightProps {
  highlight: PlayheadHighlight | null;
  visible: boolean;
}

export default function ScorePositionHighlight({ highlight, visible }: ScorePositionHighlightProps) {
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
          className="score-highlight-measure"
          style={{
            left: `${measureLeftPx}px`,
            width: `${highlight.measureWidthPx}px`,
          }}
        />
      </div>
    </div>
  );
}
