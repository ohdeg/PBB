import { createContext, Suspense, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { applyTemporiScoreSurface } from '../features/tempori/utils/focusMode';
import { setScoreDockBounds } from '../features/tempori/utils/scoreViewport';
import { scrollToTop } from '../features/tempori/utils/scrollAnchor';
import { AppErrorBoundary } from './AppErrorBoundary';

type DockSlot = 'annotation' | 'beat' | 'playback';
type DockTargets = Record<DockSlot, HTMLDivElement | null>;
const DockContext = createContext<DockTargets | undefined>(undefined);

/** Outside a viewer frame, retain the component's ordinary standalone rendering. */
export function TemporiDockSlot({ slot, children }: { slot: DockSlot; children: ReactNode }) {
  const targets = useContext(DockContext);
  if (!targets) return children;
  return targets[slot] ? createPortal(children, targets[slot]) : null;
}

/** The exit survives score chunk loading, storage errors, and rendering failures. */
export function TemporiViewerFrame({ children }: { children: ReactNode }) {
  const dockRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [annotation, setAnnotation] = useState<HTMLDivElement | null>(null);
  const [beat, setBeat] = useState<HTMLDivElement | null>(null);
  const [playback, setPlayback] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => applyTemporiScoreSurface(document), []);

  useLayoutEffect(() => {
    const dock = dockRef.current;
    const frame = frameRef.current;
    if (!dock || !frame) return;
    const updateBounds = () => {
      const bounds = dock.getBoundingClientRect();
      const shell = frame.closest('.app-shell--tempori-score');
      const safeTop = shell ? Number.parseFloat(getComputedStyle(shell).paddingTop) || 0 : 0;
      frame.style.setProperty('--tempori-dock-height', `${bounds.height}px`);
      setScoreDockBounds({ top: bounds.top, bottom: bounds.bottom, safeTop });
    };
    updateBounds();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateBounds);
    observer?.observe(dock);
    window.addEventListener('resize', updateBounds);
    window.visualViewport?.addEventListener('resize', updateBounds);
    window.visualViewport?.addEventListener('scroll', updateBounds);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateBounds);
      window.visualViewport?.removeEventListener('resize', updateBounds);
      window.visualViewport?.removeEventListener('scroll', updateBounds);
      setScoreDockBounds(null);
    };
  }, []);

  return (
    <DockContext.Provider value={{ annotation, beat, playback }}>
      <div ref={frameRef} className="tempori-viewer-frame">
        <AppErrorBoundary>
          <Suspense fallback={<main className="viewer-page"><p className="tempori-status" role="status">악보를 불러오는 중입니다.</p></main>}>
            {children}
          </Suspense>
        </AppErrorBoundary>
        <div ref={dockRef} className="tempori-viewer-dock">
          <div ref={setAnnotation} className="tempori-viewer-dock-annotation" />
          <div ref={setBeat} className="tempori-viewer-dock-beat" />
          <div className="tempori-viewer-dock-row">
            <Link className="tempori-viewer-exit" to="/hobbies/tempori/library">보관함으로</Link>
            <button type="button" className="tempori-viewer-top" aria-label="악보 맨 위로" title="악보 맨 위로" onClick={() => scrollToTop(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')}><span aria-hidden="true">↑</span></button>
            <div ref={setPlayback} className="tempori-viewer-dock-playback" />
          </div>
        </div>
      </div>
    </DockContext.Provider>
  );
}
