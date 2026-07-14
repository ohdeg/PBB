export function getAnchoredScrollTop(measureY: number, anchorRatio = 0.33): number {
  const viewportAnchor = window.innerHeight * anchorRatio;
  return Math.max(0, measureY - viewportAnchor);
}

export function scrollToAnchoredMeasure(measureY: number, behavior: ScrollBehavior = 'smooth'): void {
  const top = getAnchoredScrollTop(measureY);
  window.scrollTo({ top, behavior });
}
