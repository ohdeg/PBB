import { createContext, Suspense, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { applyTemporiScoreSurface } from '../features/tempori/utils/focusMode';
import { setScoreDockBounds } from '../features/tempori/utils/scoreViewport';
import { scrollToTop } from '../features/tempori/utils/scrollAnchor';
import { AppErrorBoundary } from './AppErrorBoundary';

type DockSlot = 'annotation' | 'beat' | 'playback' | 'pages' | 'settings' | 'title' | 'status';
type DockTargets = Record<DockSlot, HTMLDivElement | null>;
const DockContext = createContext<(DockTargets & { menuOpen: boolean; openSettings: () => void }) | undefined>(undefined);

/** Standalone settings have no parent menu to dismiss them. */
export function useTemporiViewerMenuOpen(): boolean {
  return useContext(DockContext)?.menuOpen ?? true;
}

/** Open the existing menu and move keyboard focus to the score settings. */
export function useTemporiViewerSettingsOpen(): (() => void) | undefined {
  return useContext(DockContext)?.openSettings;
}

/** Outside a viewer frame, retain the component's ordinary standalone rendering. */
export function TemporiDockSlot({ slot, children }: { slot: DockSlot; children: ReactNode }) {
  const targets = useContext(DockContext);
  if (!targets) return children;
  return targets[slot] ? createPortal(children, targets[slot]) : null;
}

function focusScoreSettings(settings: HTMLDivElement | null) {
  const target = settings?.querySelector<HTMLElement>('[data-tempori-settings-focus]:not(:disabled)')
    ?? settings?.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), button:not(:disabled)');
  target?.focus({ preventScroll: true });
  target?.scrollIntoView?.({ block: 'nearest' });
}

/** The exit survives score chunk loading, storage errors, and rendering failures. */
export function TemporiViewerFrame({ children }: { children: ReactNode }) {
  const dockRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusMenuOnOpen = useRef(false);
  const focusSettingsOnOpen = useRef(false);
  const [pages, setPages] = useState<HTMLDivElement | null>(null);
  const [annotation, setAnnotation] = useState<HTMLDivElement | null>(null);
  const [beat, setBeat] = useState<HTMLDivElement | null>(null);
  const [playback, setPlayback] = useState<HTMLDivElement | null>(null);
  const [settings, setSettings] = useState<HTMLDivElement | null>(null);
  const [title, setTitle] = useState<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<HTMLDivElement | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsId = useId();

  useLayoutEffect(() => applyTemporiScoreSurface(document), []);

  useLayoutEffect(() => {
    if (toolsOpen && focusSettingsOnOpen.current) {
      focusScoreSettings(settings);
      focusSettingsOnOpen.current = false;
    } else if (toolsOpen && focusMenuOnOpen.current) {
      menuRef.current?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')?.focus({ preventScroll: true });
      focusMenuOnOpen.current = false;
    }
  }, [toolsOpen, settings]);

  // Native bubbling follows portal DOM targets; React bubbling follows their score owner.
  useEffect(() => {
    const dock = dockRef.current;
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !toolsOpen || event.defaultPrevented || (event.target as Element).closest('[role="dialog"]')) return;
      setToolsOpen(false);
      dock?.querySelector<HTMLButtonElement>('.tempori-viewer-tools-toggle')?.focus();
    };
    dock?.addEventListener('keydown', closeMenu);
    return () => dock?.removeEventListener('keydown', closeMenu);
  }, [toolsOpen]);

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
    <DockContext.Provider value={{ annotation, beat, playback, pages, settings, title, status, menuOpen: toolsOpen, openSettings: () => { focusSettingsOnOpen.current = true; setToolsOpen(true); if (toolsOpen) { focusScoreSettings(settings); focusSettingsOnOpen.current = false; } } }}>
      <div ref={frameRef} className="tempori-viewer-frame">
        <AppErrorBoundary>
          <Suspense fallback={<main className="viewer-page"><p className="tempori-status" role="status">악보를 불러오는 중입니다.</p></main>}>
            {children}
          </Suspense>
        </AppErrorBoundary>
        <div ref={dockRef} className="tempori-viewer-dock" data-tools-open={toolsOpen}>
          <div ref={menuRef} id={toolsId} className="tempori-viewer-menu" hidden={!toolsOpen} aria-label="악보 메뉴">
            <div ref={setTitle} className="tempori-viewer-menu-title" />
            <div ref={setSettings} className="tempori-viewer-menu-settings" />
            <div ref={setAnnotation} className="tempori-viewer-dock-annotation" />
            <button type="button" className="tempori-viewer-top" onClick={() => { scrollToTop(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'); setToolsOpen(false); dockRef.current?.querySelector<HTMLButtonElement>('.tempori-viewer-tools-toggle')?.focus({ preventScroll: true }); }}>악보 맨 위로</button>
          </div>
          <div ref={setStatus} className="tempori-viewer-dock-status" />
          <div className="tempori-viewer-dock-row">
            <Link className="tempori-viewer-exit" to="/hobbies/tempori/library">보관함으로</Link>
            <button type="button" className="tempori-viewer-tools-toggle" aria-expanded={toolsOpen} aria-controls={toolsId} onClick={(event) => { focusMenuOnOpen.current = !toolsOpen && event.detail === 0; setToolsOpen(open => !open); }}>메뉴</button>
            <div ref={setPages} className="tempori-viewer-dock-pages" />
            <div ref={setBeat} className="tempori-viewer-dock-beat" />
            <div ref={setPlayback} className="tempori-viewer-dock-playback" />
          </div>
        </div>
      </div>
    </DockContext.Provider>
  );
}
