import { prefersNativeAutoScroll } from './platform';

let cachedViewportAnchorPx: number | null = null;
let activeScrollAnimation: number | null = null;
let programmaticScrollTimer: number | null = null;
let activeScrollTargetTop: number | null = null;
let isProgrammaticScroll = false;

const LINE_SCROLL_DURATION_MS = 520;

export function resetScrollAnchorCache(): void {
  cachedViewportAnchorPx = null;
}

export function cancelScrollAnimation(): void {
  if (activeScrollAnimation !== null) {
    cancelAnimationFrame(activeScrollAnimation);
    activeScrollAnimation = null;
  }

  if (programmaticScrollTimer !== null) {
    window.clearTimeout(programmaticScrollTimer);
    programmaticScrollTimer = null;
  }

  activeScrollTargetTop = null;
  isProgrammaticScroll = false;
}

function getScrollTop(): number {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function setScrollTop(top: number): void {
  isProgrammaticScroll = true;
  window.scrollTo({ top, behavior: 'auto' });
}

export function isAutoScrollAnimating(): boolean {
  return isProgrammaticScroll;
}

function getViewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}

function getViewportAnchorPx(anchorRatio = 0.33): number {
  if (cachedViewportAnchorPx !== null) {
    return cachedViewportAnchorPx;
  }

  cachedViewportAnchorPx = getViewportHeight() * anchorRatio;
  return cachedViewportAnchorPx;
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

export function getAnchoredScrollTop(measureY: number, anchorRatio = 0.33): number {
  return Math.max(0, measureY - getViewportAnchorPx(anchorRatio));
}

function markProgrammaticScroll(durationMs: number): void {
  isProgrammaticScroll = true;

  if (programmaticScrollTimer !== null) {
    window.clearTimeout(programmaticScrollTimer);
  }

  programmaticScrollTimer = window.setTimeout(() => {
    isProgrammaticScroll = false;
    activeScrollTargetTop = null;
    programmaticScrollTimer = null;
  }, durationMs);
}

function animateScrollWithNativeSmooth(targetTop: number, durationMs: number): void {
  cancelScrollAnimation();

  const currentTop = getScrollTop();
  if (Math.abs(targetTop - currentTop) < 2) {
    return;
  }

  if (
    activeScrollTargetTop !== null &&
    Math.abs(activeScrollTargetTop - targetTop) < 2 &&
    isProgrammaticScroll
  ) {
    return;
  }

  activeScrollTargetTop = targetTop;
  markProgrammaticScroll(durationMs);
  window.scrollTo({ top: targetTop, behavior: 'smooth' });

  if ('onscrollend' in window) {
    const handleScrollEnd = () => {
      isProgrammaticScroll = false;
      activeScrollTargetTop = null;
      if (programmaticScrollTimer !== null) {
        window.clearTimeout(programmaticScrollTimer);
        programmaticScrollTimer = null;
      }
    };

    window.addEventListener('scrollend', handleScrollEnd, { once: true });
  }
}

function animateScrollWithFrames(targetTop: number, durationMs: number): void {
  cancelScrollAnimation();

  const startTop = getScrollTop();
  const distance = targetTop - startTop;

  if (Math.abs(distance) < 2) {
    return;
  }

  activeScrollTargetTop = targetTop;
  isProgrammaticScroll = true;
  const startTime = performance.now();

  const step = (now: number) => {
    const progress = Math.min(1, (now - startTime) / durationMs);
    const easedTop = startTop + distance * easeOutCubic(progress);
    setScrollTop(easedTop);

    if (progress < 1) {
      activeScrollAnimation = requestAnimationFrame(step);
      return;
    }

    activeScrollAnimation = null;
    isProgrammaticScroll = false;
    activeScrollTargetTop = null;
  };

  activeScrollAnimation = requestAnimationFrame(step);
}

function animateScrollTo(targetTop: number, durationMs: number): void {
  if (prefersNativeAutoScroll()) {
    animateScrollWithNativeSmooth(targetTop, durationMs);
    return;
  }

  animateScrollWithFrames(targetTop, durationMs);
}

export function scrollToAnchoredMeasure(
  measureY: number,
  behavior: ScrollBehavior = 'smooth',
  options?: { lockAnchor?: boolean; durationMs?: number; anchorRatio?: number },
): void {
  if (options?.lockAnchor && cachedViewportAnchorPx === null) {
    cachedViewportAnchorPx = getViewportHeight() * (options.anchorRatio ?? 0.33);
  }

  const targetTop =
    options?.anchorRatio === 0
      ? Math.max(0, measureY)
      : getAnchoredScrollTop(measureY, options?.anchorRatio);

  if (behavior === 'auto') {
    cancelScrollAnimation();
    setScrollTop(targetTop);
    isProgrammaticScroll = false;
    activeScrollTargetTop = null;
    return;
  }

  animateScrollTo(targetTop, options?.durationMs ?? LINE_SCROLL_DURATION_MS);
}

export function scrollToTop(behavior: ScrollBehavior = 'smooth'): void {
  if (behavior === 'auto') {
    cancelScrollAnimation();
    setScrollTop(0);
    isProgrammaticScroll = false;
    activeScrollTargetTop = null;
    return;
  }

  animateScrollTo(0, LINE_SCROLL_DURATION_MS);
}
