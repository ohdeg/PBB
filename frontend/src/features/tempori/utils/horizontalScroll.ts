/** Start one cancellable viewport movement from its currently visible position. */
export function animateHorizontalScroll(
  viewport: { scrollLeft: number },
  target: number,
  behavior: ScrollBehavior = 'smooth',
  durationMs = 600,
): () => void {
  const start = viewport.scrollLeft;
  const distance = target - start;
  if (behavior !== 'smooth' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || Math.abs(distance) < 1) {
    viewport.scrollLeft = target;
    return () => {};
  }
  const startedAt = performance.now();
  const duration = Number.isFinite(durationMs) ? Math.max(1, durationMs) : 600;
  let cancelled = false;
  let frame = 0;
  const step = (now: number) => {
    if (cancelled) return;
    const progress = Math.min(1, Math.max(0, (now - startedAt) / duration));
    // Gentle acceleration and deceleration, including backwards repeat jumps.
    const eased = progress * progress * (3 - 2 * progress);
    viewport.scrollLeft = progress === 1 ? target : start + distance * eased;
    if (progress < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => { cancelled = true; cancelAnimationFrame(frame); };
}
