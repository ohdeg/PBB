import { createContext, Suspense, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { applyTemporiScoreSurface } from '../features/tempori/utils/focusMode';
import { setScoreDockBounds } from '../features/tempori/utils/scoreViewport';
import { scrollToTop } from '../features/tempori/utils/scrollAnchor';
import { AppErrorBoundary } from './AppErrorBoundary';

type DockSlot = 'annotation' | 'beat' | 'playback' | 'pages' | 'settings' | 'title' | 'status';
type DockTargets = Record<DockSlot, HTMLDivElement | null>;
type Presentation = { enabled: boolean; locked: boolean };
const DockContext = createContext<(DockTargets & { menuOpen: boolean; openSettings: () => void; configurePresentation: (value: Presentation) => void; toggleControls: () => void }) | undefined>(undefined);

/** PDF controls overlay the paper; modes that consume score gestures retain a recovery path. */
export function useTemporiViewerPresentation(enabled: boolean, locked: boolean) {
  const context = useContext(DockContext);
  const configure = context?.configurePresentation;
  useLayoutEffect(() => { configure?.({ enabled, locked }); }, [configure, enabled, locked]);
  useLayoutEffect(() => () => configure?.({ enabled: false, locked: false }), [configure]);
  return context?.toggleControls;
}

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
  const focusExitOnReveal = useRef(false);
  const revealRef = useRef<HTMLButtonElement>(null);
  const [pages, setPages] = useState<HTMLDivElement | null>(null);
  const [annotation, setAnnotation] = useState<HTMLDivElement | null>(null);
  const [beat, setBeat] = useState<HTMLDivElement | null>(null);
  const [playback, setPlayback] = useState<HTMLDivElement | null>(null);
  const [settings, setSettings] = useState<HTMLDivElement | null>(null);
  const [title, setTitle] = useState<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<HTMLDivElement | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [presentation, setPresentation] = useState<Presentation>({ enabled: false, locked: false });
  const [controlsShown, setControlsShown] = useState(false);
  const controlsVisible = !presentation.enabled || controlsShown || presentation.locked;
  const configurePresentation = useCallback((value: Presentation) => setPresentation(previous => previous.enabled === value.enabled && previous.locked === value.locked ? previous : value), []);
  const hideControls = () => {
    if (presentation.locked) return;
    setToolsOpen(false); setControlsShown(false);
    // A keyboard action must never leave focus inside the hidden row.
    if (dockRef.current?.contains(document.activeElement)) revealRef.current?.focus({ preventScroll: true });
  };
  const toggleControls = () => { if (controlsVisible) hideControls(); else setControlsShown(true); };
  const toolsId = useId();

  useLayoutEffect(() => applyTemporiScoreSurface(document), []);

  useLayoutEffect(() => {
    if (controlsVisible && focusExitOnReveal.current) {
      dockRef.current?.querySelector<HTMLAnchorElement>('.tempori-viewer-exit')?.focus({ preventScroll: true });
      focusExitOnReveal.current = false;
    }
    if (toolsOpen && focusSettingsOnOpen.current) {
      focusScoreSettings(settings);
      focusSettingsOnOpen.current = false;
    } else if (toolsOpen && focusMenuOnOpen.current) {
      menuRef.current?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')?.focus({ preventScroll: true });
      focusMenuOnOpen.current = false;
    }
  }, [toolsOpen, settings, controlsVisible]);

  // Native bubbling follows portal DOM targets; React bubbling follows their score owner.
  useEffect(() => {
    const dock = dockRef.current;
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !toolsOpen || event.defaultPrevented || (event.target as Element).closest('[role="dialog"]')) return;
      event.preventDefault();
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
      // The dock's resolved bottom includes its 4px gap plus the actual CSS safe inset.
      const safeBottom = Math.max(0, (Number.parseFloat(getComputedStyle(dock).bottom) || 4) - 4);
      frame.style.setProperty('--tempori-dock-height', `${bounds.height}px`);
      setScoreDockBounds({ top: bounds.top, bottom: bounds.bottom, safeTop, safeBottom });
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
    <DockContext.Provider value={{ annotation, beat, playback, pages, settings, title, status, menuOpen: toolsOpen && controlsVisible, configurePresentation, toggleControls, openSettings: () => { setControlsShown(true); focusSettingsOnOpen.current = true; setToolsOpen(true); if (toolsOpen) { focusScoreSettings(settings); focusSettingsOnOpen.current = false; } } }}>
      <div ref={frameRef} className="tempori-viewer-frame" data-presentation={presentation.enabled} onKeyDown={event => {
        if (!presentation.enabled || event.defaultPrevented || event.repeat || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || document.querySelector('[role="dialog"]')) return;
        if (event.key === 'Escape' && toolsOpen) { event.preventDefault(); setToolsOpen(false); dockRef.current?.querySelector<HTMLButtonElement>('.tempori-viewer-tools-toggle')?.focus({ preventScroll: true }); }
        else if (event.key === 'Escape' && controlsVisible) { event.preventDefault(); hideControls(); }
        else if (event.key.toLowerCase() === 'c' && !(event.target as Element).closest('button,input,select,textarea,a,[contenteditable]:not([contenteditable="false"])')) { event.preventDefault(); toggleControls(); }
      }}>
        {presentation.enabled && <button ref={revealRef} type="button" className="tempori-viewer-reveal" aria-expanded={controlsVisible} aria-controls={`${toolsId}-row`} onClick={() => { if (controlsVisible) dockRef.current?.querySelector<HTMLAnchorElement>('.tempori-viewer-exit')?.focus({ preventScroll: true }); else { focusExitOnReveal.current = true; setControlsShown(true); } }}>악보 컨트롤 표시</button>}
        <AppErrorBoundary>
          <Suspense fallback={<main className="viewer-page"><p className="tempori-status" role="status">악보를 불러오는 중입니다.</p></main>}>
            {children}
          </Suspense>
        </AppErrorBoundary>
        <div ref={dockRef} className="tempori-viewer-dock" data-tools-open={toolsOpen}>
          <div ref={menuRef} id={toolsId} className="tempori-viewer-menu" hidden={!toolsOpen || !controlsVisible} aria-label="악보 메뉴">
            <div ref={setTitle} className="tempori-viewer-menu-title" />
            <div ref={setSettings} className="tempori-viewer-menu-settings" />
            <div ref={setAnnotation} className="tempori-viewer-dock-annotation" />
            <button type="button" className="tempori-viewer-top" onClick={() => { scrollToTop(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'); setToolsOpen(false); dockRef.current?.querySelector<HTMLButtonElement>('.tempori-viewer-tools-toggle')?.focus({ preventScroll: true }); }}>악보 맨 위로</button>
          </div>
          <div ref={setStatus} className="tempori-viewer-dock-status" />
          <div id={`${toolsId}-row`} className="tempori-viewer-dock-row" hidden={!controlsVisible}>
            <Link className="tempori-viewer-exit" to="/hobbies/tempori/library">보관함으로</Link>
            <button type="button" className="tempori-viewer-tools-toggle" aria-expanded={toolsOpen} aria-controls={toolsId} onClick={(event) => { focusMenuOnOpen.current = !toolsOpen && event.detail === 0; if (!toolsOpen) setControlsShown(true); setToolsOpen(open => !open); }}>메뉴</button>
            {presentation.enabled && <button type="button" className="tempori-viewer-hide" aria-label="컨트롤 숨기기" disabled={presentation.locked} title={presentation.locked ? '필기나 확대를 끝내면 컨트롤을 숨길 수 있습니다.' : '컨트롤 숨기기'} onClick={hideControls}><ChevronDown size={18} aria-hidden="true" /></button>}
            <div ref={setPages} className="tempori-viewer-dock-pages" />
            <div ref={setBeat} className="tempori-viewer-dock-beat" />
            <div ref={setPlayback} className="tempori-viewer-dock-playback" />
          </div>
        </div>
      </div>
    </DockContext.Provider>
  );
}
