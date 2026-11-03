import { useTemporiState } from '../services/TemporiStateProvider';
import type { PositionState } from '../services/temporiStateRepository';
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import type { AnnotationBrushSizes, AnnotationLayerHandle, AnnotationToolMode } from '../types/temporiAnnotation';
import type { OsmdViewerHandle, TemporiRenderSnapshot } from '../components/OsmdViewer';
import type { PageTurnRequest, ScoreSource } from './types';
import { useScorePages } from './useScorePages';
import { usePageTurnInput } from './usePageTurnInput';
import { PageTurnBar } from './PageTurnBar';
import { PageAnnotationLayer } from './PageAnnotationLayer';
import { CameraTurnSettings } from './camera/CameraTurnSettings';
import { getScoreViewport } from '../utils/scoreViewport';
import { TemporiDockSlot } from '../../../components/TemporiViewerDock';
const pdfTapHintKey = 'tempori:pdf-tap-hint-seen';
interface Props { source: ScoreSource; annotationId: string; transpose?: number; currentMeasure?: number; followEnabled?: boolean; followRequestKey?: number; annotationTool: AnnotationToolMode; annotationBrushSizes: AnnotationBrushSizes; settingsOpen?: boolean; onManualNavigation?: () => void; onMeasureNavigation?: (measure: number) => void; onSnapshot?: (value: TemporiRenderSnapshot) => void; onReady?: (ready: boolean) => void; ref?: Ref<OsmdViewerHandle> }
export function ScorePageViewer({ source, annotationId, transpose = 0, currentMeasure = 0, followEnabled = true, followRequestKey = 0, annotationTool, annotationBrushSizes, settingsOpen = false, onManualNavigation, onMeasureNavigation, onSnapshot, onReady, ref }: Props) {
  const scoreState = useTemporiState(); const stateRef = useRef(scoreState); stateRef.current = scoreState;
  const positionGeneration = useRef(0); const positionApplied = useRef(-1); const restoringPage = useRef<number | null>(null); const savedPosition = useRef(''); const pendingPosition = useRef<PositionState | null>(null); const positionTimer = useRef<ReturnType<typeof setTimeout> | null>(null); const lastPositionAt = useRef(0);
  const annotation = useRef<AnnotationLayerHandle>(null); const viewport = useRef<HTMLDivElement>(null); const renderHost = useRef<HTMLDivElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [nativeZoom, setNativeZoom] = useState(1);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const hintSeen = useRef(false); const [showTapHint, setShowTapHint] = useState(false);
  const pages = useScorePages(source, transpose, annotation, currentMeasure, onSnapshot, onManualNavigation, onReady);
  const inputEnabled = !settingsOpen && !cameraOpen && annotationTool === 'none' && pages.zoom === 1 && nativeZoom <= 1 && !pages.busy && !pages.error && !!pages.doc;
  const tapEnabled = source.kind === 'pdf' && inputEnabled;
  const requestFromInput = (request: PageTurnRequest) => { if (request.origin === 'tap') setShowTapHint(false); pages.request(request); };
  const input = usePageTurnInput(viewport, inputEnabled, requestFromInput, tapEnabled);
  useEffect(() => {
    if (!tapEnabled) { setShowTapHint(false); return; }
    if (hintSeen.current) return;
    hintSeen.current = true;
    try { if (localStorage.getItem(pdfTapHintKey) === 'true') return; } catch { /* Optional guidance must work without storage access. */ }
    setShowTapHint(true);
    try { localStorage.setItem(pdfTapHintKey, 'true'); } catch { /* Keep the preference for this mounted viewer. */ }
    const timer = setTimeout(() => setShowTapHint(false), 5000);
    return () => clearTimeout(timer);
  }, [tapEnabled]);
  useImperativeHandle(ref, () => ({ flush: () => annotation.current?.flush() ?? true, restoreMeasure: pages.follow }), [pages.follow]);
  const follow = pages.follow;
  useEffect(() => { if (followEnabled) follow(currentMeasure); }, [currentMeasure, followEnabled, followRequestKey, follow]);
  useLayoutEffect(() => {
    const element = viewport.current; if (!element) return;
    const measure = () => { setNativeZoom(window.visualViewport?.scale ?? 1); const bounds = element.getBoundingClientRect(); const score = getScoreViewport(); setSize({ width: element.clientWidth || 800, height: Math.max(20, score.top + score.height - bounds.top - 8) }); };
    const observer = new ResizeObserver(measure); observer.observe(element); const dock = document.querySelector('.tempori-viewer-dock'); if (dock) observer.observe(dock); measure(); window.addEventListener('resize', measure); window.visualViewport?.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure); };
  }, []);
  useLayoutEffect(() => { if (pages.content) renderHost.current?.replaceChildren(pages.content); if (viewport.current) { viewport.current.scrollLeft = 0; viewport.current.scrollTop = 0; } }, [pages.content]);
  const page = pages.doc?.pages[pages.index]; const fit = page ? Math.min((size.width - 16) / page.width, (size.height - 16) / page.height) : 1;
  const flushPosition = () => {
    const payload = pendingPosition.current; if (!payload || JSON.stringify(payload) === savedPosition.current) return;
    try { stateRef.current?.save('position', payload, positionGeneration.current); positionGeneration.current += 1; positionApplied.current = positionGeneration.current; savedPosition.current = JSON.stringify(payload); lastPositionAt.current = Date.now(); }
    catch (failure) { stateRef.current?.reportError(failure instanceof Error ? failure.message : '연습 위치 저장에 실패했습니다.'); }
  };
  const flushRef = useRef(flushPosition); flushRef.current = flushPosition;
  useEffect(() => {
    if (source.kind !== 'pdf' || !scoreState?.ready || !pages.doc || pages.busy || scoreState.busy || annotationTool !== 'none') return;
    const doc = scoreState.state.documents.position; const value = doc?.payload as PositionState | undefined;
    if (value?.kind === 'pdf' && doc.generation !== positionApplied.current && !doc.conflict) {
      positionGeneration.current = doc.generation; positionApplied.current = doc.generation;
      if (value.pageIndex >= pages.doc.pages.length) return;
      restoringPage.current = value.pageIndex; savedPosition.current = JSON.stringify(value);
      if (pages.index !== value.pageIndex) void pages.goToPage(value.pageIndex).then((moved) => { if (!moved) { restoringPage.current = null; scoreState.reportError('연습 위치를 옮기지 못했습니다. 현재 페이지를 유지합니다.'); } });
      else if (viewport.current && page) { viewport.current.scrollTop = value.y * page.height * fit * pages.zoom; restoringPage.current = null; }
    } else if (restoringPage.current === pages.index && viewport.current && value?.kind === 'pdf' && page) { viewport.current.scrollTop = value.y * page.height * fit * pages.zoom; restoringPage.current = null; }
  }, [source.kind, scoreState, pages, page, fit, annotationTool]);
  const recordPosition = () => {
    if (source.kind !== 'pdf' || !page || !scoreState?.ready || pages.busy || restoringPage.current !== null) return;
    const doc = scoreState.state.documents.position;
    if (!doc?.payload && !doc?.serverKnown && scoreState.identity.accountId && !source.id.startsWith('tempori-')) return;
    pendingPosition.current = { kind: 'pdf', pageIndex: pages.index, y: Math.round(Math.max(0, Math.min(1, (viewport.current?.scrollTop ?? 0) / (page.height * fit * pages.zoom))) * 10000) / 10000 };
    if (Date.now() - lastPositionAt.current >= 5000) flushPosition();
    else { if (positionTimer.current) clearTimeout(positionTimer.current); positionTimer.current = setTimeout(() => flushRef.current(), 5000 - (Date.now() - lastPositionAt.current)); }
  };
  useEffect(() => { recordPosition(); }, [pages.index, pages.content, pages.busy]);
  useEffect(() => { if (pages.manualRevision > 0 && source.kind === 'musicxml') { const measure = pages.doc?.measurePages?.findIndex((index) => index === pages.index); if (measure !== undefined && measure >= 0) onMeasureNavigation?.(measure); } }, [pages.manualRevision]);
  useEffect(() => { const flush = () => flushRef.current(); window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', flush); return () => { flush(); if (positionTimer.current) clearTimeout(positionTimer.current); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', flush); }; }, []);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  return <section className="tempori-pages" aria-label="악보 페이지 보기">
    <TemporiDockSlot slot="settings"><div className="tempori-page-controls"><button type="button" onClick={() => pages.setZoom(1)} aria-pressed={pages.zoom === 1}>페이지 맞춤</button><button type="button" onClick={() => pages.setZoom((value) => value >= 2 ? 1 : value + .5)} aria-label="악보 확대">확대 {Math.round(pages.zoom * 100)}%</button></div></TemporiDockSlot>
      <CameraTurnSettings onSettingsChange={setCameraOpen} onTurn={(delta) => pages.request({ delta, origin: 'camera', timestamp: performance.now() })} suspended={annotationTool !== 'none' || pages.zoom !== 1 || nativeZoom > 1 || pages.busy || !!pages.error || settingsOpen} manualRevision={pages.manualRevision} />
    {source.kind === 'musicxml' && annotationTool !== 'none' && <p className="tempori-view-notice">페이지 필기는 조옮김 설정별로 따로 저장됩니다.</p>}
    {pages.error && <div className="tempori-page-error" role="alert">{pages.error} <button type="button" onClick={pages.retry}>페이지 다시 시도</button></div>}
    {!pages.doc && !pages.error && <p role="status">페이지를 준비하고 있습니다…</p>}
    <div ref={viewport} className="tempori-page-viewport" style={{ height: size.height, touchAction: pages.zoom === 1 ? 'pan-y pinch-zoom' : 'auto' }} {...input}
      onScroll={() => { input.onScroll(); recordPosition(); }}
      onPointerDown={(event) => { input.onPointerDown(event); if (pages.zoom > 1 && event.pointerType === 'mouse' && event.button === 0 && annotationTool === 'none') { drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop }; event.currentTarget.setPointerCapture(event.pointerId); } }}
      onPointerMove={(event) => { input.onPointerMove(event); if (drag.current) { event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x); event.currentTarget.scrollTop = drag.current.top - (event.clientY - drag.current.y); } }}
      onPointerUp={(event) => { drag.current = null; input.onPointerUp(event); }} onPointerCancel={() => { drag.current = null; input.onPointerCancel(); }}>
      {page && <div className="tempori-page-sheet" style={{ width: page.width * fit * pages.zoom, height: page.height * fit * pages.zoom }} data-page={pages.index + 1} aria-busy={pages.busy}>
        <div ref={renderHost} className="tempori-page-art" />
        <PageAnnotationLayer key={`${annotationId}:${pages.layout}`} ref={annotation} id={annotationId} layout={pages.layout} page={pages.index} width={page.width} height={page.height} tool={annotationTool} sizes={annotationBrushSizes} />
      </div>}
      {showTapHint && <p className="tempori-page-tap-hint" role="status">왼쪽은 이전 · 오른쪽은 다음</p>}
    </div>
    <PageTurnBar index={pages.index} count={pages.doc?.pages.length ?? 0} busy={pages.busy || !!pages.error} request={pages.request} compact={source.kind === 'pdf'} />
  </section>;
}
