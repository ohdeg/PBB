interface ScoreDockBounds {
  top: number;
  bottom: number;
  safeTop: number;
  safeBottom?: number;
}

let scoreDockBounds: ScoreDockBounds | null = null;

/** Updated by dock/viewport resize events, avoiding layout reads in playback ticks. */
export function setScoreDockBounds(bounds: ScoreDockBounds | null): void {
  scoreDockBounds = bounds;
}

export function getScoreViewport(reserveDock = true): { top: number; height: number } {
  const viewport = window.visualViewport;
  const visibleTop = viewport?.offsetTop ?? 0;
  const visibleBottom = visibleTop + (viewport?.height ?? window.innerHeight);
  const dock = scoreDockBounds;
  const top = Math.max(visibleTop, dock?.safeTop ?? 0);
  const bottom = reserveDock && dock && dock.bottom > top && dock.top < visibleBottom
    ? Math.min(visibleBottom, dock.top)
    : visibleBottom - (dock?.safeBottom ?? 0);
  return { top, height: Math.max(1, bottom - top) };
}
