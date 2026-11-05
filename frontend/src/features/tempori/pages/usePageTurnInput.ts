import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { PageTurnRequest } from './types';
import { swipeDirection } from './pageTurnController';
const interactive = (target: EventTarget | null) => target instanceof Element && !!target.closest('button,input,select,textarea,a,summary,[role="button"],[role="dialog"],[contenteditable]:not([contenteditable="false"]),[role="slider"]');
const nativeZoomed = () => (window.visualViewport?.scale ?? 1) > 1;
type Gesture = { id: number; x: number; y: number; lastX: number; lastY: number; distance: number; time: number };
function trackMovement(start: Gesture, x: number, y: number) {
  start.distance += Math.hypot(x - start.lastX, y - start.lastY); start.lastX = x; start.lastY = y;
}
export function usePageTurnInput(ref: RefObject<HTMLElement | null>, enabled: boolean, request: (input: PageTurnRequest) => void, tapEnabled = false, onCenterTap?: () => void, navigationEnabled = enabled) {
  const pointers = useRef(new Set<number>());
  const gesture = useRef<Gesture | null>(null);
  useEffect(() => { gesture.current = null; }, [enabled, tapEnabled]);
  useEffect(() => {
    const activePointers = pointers.current;
    // Capture all pointers, including a second touch or a release outside the score.
    const down = (event: PointerEvent) => { activePointers.add(event.pointerId); if (activePointers.size > 1) gesture.current = null; };
    const up = (event: PointerEvent) => { activePointers.delete(event.pointerId); if (!(event.target instanceof Node) || !ref.current?.contains(event.target)) gesture.current = null; };
    const cancel = (event: PointerEvent) => { activePointers.delete(event.pointerId); gesture.current = null; };
    const interrupt = () => { gesture.current = null; };
    const blur = () => { interrupt(); activePointers.clear(); };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('scroll', interrupt, true); window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('scroll', interrupt, true); window.removeEventListener('blur', blur); activePointers.clear(); gesture.current = null;
    };
  }, [ref]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (!navigationEnabled || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || interactive(event.target) || document.querySelector('[role="dialog"]')) return;
      const delta = ['ArrowRight', 'PageDown'].includes(event.key) ? 1 : ['ArrowLeft', 'PageUp'].includes(event.key) ? -1 : null;
      if (delta !== null) { event.preventDefault(); request({ delta, origin: 'keyboard', timestamp: performance.now() }); }
    };
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  }, [navigationEnabled, request]);
  return {
    onPointerDown(event: ReactPointerEvent) {
      if (!enabled || nativeZoomed() || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !event.isPrimary || event.button !== 0 || !['mouse', 'touch'].includes(event.pointerType) || pointers.current.size !== 1 || interactive(event.target) || document.querySelector('[role="dialog"]')) { gesture.current = null; return; }
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, distance: 0, time: performance.now() };
    },
    onPointerMove(event: ReactPointerEvent) {
      const start = gesture.current; if (!start || start.id !== event.pointerId) return;
      const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
      const bounds = ref.current?.getBoundingClientRect();
      // Touch implicitly captures its target, so leaving may not emit pointerleave.
      for (const sample of [...samples, event]) {
        if (bounds && (sample.clientX < bounds.left || sample.clientX > bounds.right || sample.clientY < bounds.top || sample.clientY > bounds.bottom)) { gesture.current = null; return; }
        trackMovement(start, sample.clientX, sample.clientY);
      }
    },
    onPointerUp(event: ReactPointerEvent) {
      const start = gesture.current; pointers.current.delete(event.pointerId); gesture.current = null;
      if (!enabled || nativeZoomed() || !start || start.id !== event.pointerId || interactive(event.target) || document.querySelector('[role="dialog"]')) return;
      const now = performance.now(); const duration = now - start.time;
      const delta = swipeDirection(event.clientX - start.x, event.clientY - start.y, duration, ref.current?.clientWidth ?? 0);
      if (delta) { if (navigationEnabled) request({ delta, origin: 'swipe', timestamp: now }); return; }
      trackMovement(start, event.clientX, event.clientY);
      if (!tapEnabled || duration > 350 || start.distance > 10) return;
      const bounds = ref.current?.getBoundingClientRect();
      if (!bounds || bounds.width <= 0 || [start.x, event.clientX].some((x) => x < bounds.left || x > bounds.right) || [start.y, event.clientY].some((y) => y < bounds.top || y > bounds.bottom)) return;
      const fraction = (event.clientX - bounds.left) / bounds.width;
      if (onCenterTap && fraction >= 1 / 3 && fraction <= 2 / 3) { onCenterTap(); return; }
      if (navigationEnabled) request({ delta: fraction < .5 ? -1 : 1, origin: 'tap', timestamp: now });
    },
    onPointerCancel() { gesture.current = null; },
    onPointerLeave() { gesture.current = null; },
    onLostPointerCapture() { gesture.current = null; },
    onScroll() { gesture.current = null; },
  };
}
