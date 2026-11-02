import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { PageTurnRequest } from './types';
import { swipeDirection } from './pageTurnController';
const interactive = (target: EventTarget | null) => target instanceof Element && !!target.closest('button,input,select,textarea,a,[role="dialog"],[contenteditable="true"],[role="slider"]');
export function usePageTurnInput(ref: RefObject<HTMLElement | null>, enabled: boolean, request: (input: PageTurnRequest) => void) {
  const pointers = useRef(new Set<number>());
  const gesture = useRef<{ id: number; x: number; y: number; time: number } | null>(null);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (!enabled || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || interactive(event.target) || document.querySelector('[role="dialog"]')) return;
      const delta = ['ArrowRight', 'PageDown'].includes(event.key) ? 1 : ['ArrowLeft', 'PageUp'].includes(event.key) ? -1 : null;
      if (delta !== null) { event.preventDefault(); request({ delta, origin: 'keyboard', timestamp: performance.now() }); }
    };
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  }, [enabled, request]);
  return {
    onPointerDown(event: ReactPointerEvent) {
      pointers.current.add(event.pointerId);
      if (!enabled || event.pointerType === 'pen' || pointers.current.size !== 1 || interactive(event.target)) { gesture.current = null; return; }
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
    },
    onPointerUp(event: ReactPointerEvent) {
      const start = gesture.current; pointers.current.delete(event.pointerId); gesture.current = null;
      if (!enabled || !start || start.id !== event.pointerId) return;
      const delta = swipeDirection(event.clientX - start.x, event.clientY - start.y, performance.now() - start.time, ref.current?.clientWidth ?? 0);
      if (delta) request({ delta, origin: 'swipe', timestamp: performance.now() });
    },
    onPointerCancel() { gesture.current = null; pointers.current.clear(); },
  };
}
