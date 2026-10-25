export function isIpadLikeDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = navigator.userAgent;
  const isIpadUserAgent =
    /iPad/i.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  return isIpadUserAgent;
}

export function prefersNativeAutoScroll(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}
