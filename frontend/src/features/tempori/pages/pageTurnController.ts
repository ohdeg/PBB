import type { PageTurnRequest } from './types';
interface TurnDependencies {
  count: () => number; current: () => number; ready: () => boolean; flush: () => boolean;
  prepare: (index: number) => Promise<void>; transition: () => Promise<void>;
  commit: (index: number, origin: PageTurnRequest['origin']) => void; fail: (error: unknown) => void;
}
export function createPageTurnController(deps: TurnDependencies) {
  let busy = false; let disposed = false; let last = -Infinity;
  async function goTo(target: number, request: PageTurnRequest): Promise<boolean> {
    const next = Math.max(0, Math.min(deps.count() - 1, target));
    if (disposed || busy || !deps.ready() || next === deps.current() || request.timestamp - last < 250) return false;
    busy = true;
    try {
      if (!deps.flush()) { deps.fail(new Error('필기 저장에 실패했습니다. 저장 공간을 확인한 후 다시 넘겨 주세요.')); return false; }
      await deps.prepare(next); if (disposed) return false;
      await deps.transition(); if (disposed) return false;
      deps.commit(next, request.origin); last = request.timestamp; return true;
    } catch (error) { if (!disposed) deps.fail(error); return false; }
    finally { busy = false; }
  }
  return { request: (request: PageTurnRequest) => goTo(deps.current() + request.delta, request), goTo, busy: () => busy, dispose: () => { disposed = true; } };
}
export function swipeDirection(dx: number, dy: number, duration: number, width: number): -1 | 1 | null {
  if (duration > 800 || Math.abs(dx) < Math.max(48, width * 0.08) || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 1 : -1;
}
