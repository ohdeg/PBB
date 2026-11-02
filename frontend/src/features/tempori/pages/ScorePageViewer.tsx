import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import type { AnnotationBrushSizes, AnnotationLayerHandle, AnnotationToolMode } from '../types/temporiAnnotation';
import type { OsmdViewerHandle, TemporiRenderSnapshot } from '../components/OsmdViewer';
import type { ScoreSource } from './types';
import { useScorePages } from './useScorePages';
import { usePageTurnInput } from './usePageTurnInput';
import { PageTurnBar } from './PageTurnBar';
import { PageAnnotationLayer } from './PageAnnotationLayer';
import { CameraTurnSettings } from './camera/CameraTurnSettings';
import { getScoreViewport } from '../utils/scoreViewport';
interface Props { source: ScoreSource; annotationId: string; transpose?: number; currentMeasure?: number; followEnabled?: boolean; followRequestKey?: number; annotationTool: AnnotationToolMode; annotationBrushSizes: AnnotationBrushSizes; settingsOpen?: boolean; onManualNavigation?: () => void; onSnapshot?: (value: TemporiRenderSnapshot) => void; onReady?: (ready: boolean) => void; ref?: Ref<OsmdViewerHandle> }
export function ScorePageViewer({ source, annotationId, transpose = 0, currentMeasure = 0, followEnabled = true, followRequestKey = 0, annotationTool, annotationBrushSizes, settingsOpen = false, onManualNavigation, onSnapshot, onReady, ref }: Props) {
  const annotation = useRef<AnnotationLayerHandle>(null); const viewport = useRef<HTMLDivElement>(null); const renderHost = useRef<HTMLDivElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [nativeZoom, setNativeZoom] = useState(1);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const pages = useScorePages(source, transpose, annotation, currentMeasure, onSnapshot, onManualNavigation, onReady);
  const input = usePageTurnInput(viewport, !settingsOpen && !cameraOpen && annotationTool === 'none' && pages.zoom === 1 && nativeZoom <= 1 && !pages.busy, pages.request);
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
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  return <section className="tempori-pages" aria-label="악보 페이지 보기">
    <div className="tempori-page-controls"><button type="button" onClick={() => pages.setZoom(1)} aria-pressed={pages.zoom === 1}>페이지 맞춤</button><button type="button" onClick={() => pages.setZoom((value) => value >= 2 ? 1 : value + .5)} aria-label="악보 확대">확대 {Math.round(pages.zoom * 100)}%</button>
      <CameraTurnSettings onSettingsChange={setCameraOpen} onTurn={(delta) => pages.request({ delta, origin: 'camera', timestamp: performance.now() })} suspended={annotationTool !== 'none' || pages.zoom !== 1 || nativeZoom > 1 || pages.busy || !!pages.error || settingsOpen} manualRevision={pages.manualRevision} />
    </div>
    {source.kind === 'musicxml' && annotationTool !== 'none' && <p className="tempori-view-notice">페이지 필기는 조옮김 설정별로 따로 저장됩니다.</p>}
    {pages.error && <div className="tempori-page-error" role="alert">{pages.error} <button type="button" onClick={pages.retry}>페이지 다시 시도</button></div>}
    {!pages.doc && !pages.error && <p role="status">페이지를 준비하고 있습니다…</p>}
    <div ref={viewport} className="tempori-page-viewport" style={{ height: size.height, touchAction: pages.zoom === 1 ? 'pan-y pinch-zoom' : 'auto' }} {...input}
      onPointerDown={(event) => { input.onPointerDown(event); if (pages.zoom > 1 && event.pointerType === 'mouse' && event.button === 0 && annotationTool === 'none') { drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop }; event.currentTarget.setPointerCapture(event.pointerId); } }}
      onPointerMove={(event) => { if (drag.current) { event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x); event.currentTarget.scrollTop = drag.current.top - (event.clientY - drag.current.y); } }}
      onPointerUp={(event) => { drag.current = null; input.onPointerUp(event); }} onPointerCancel={() => { drag.current = null; input.onPointerCancel(); }}>
      {page && <div className="tempori-page-sheet" style={{ width: page.width * fit * pages.zoom, height: page.height * fit * pages.zoom }} data-page={pages.index + 1} aria-busy={pages.busy}>
        <div ref={renderHost} className="tempori-page-art" />
        <PageAnnotationLayer key={`${annotationId}:${pages.layout}`} ref={annotation} id={annotationId} layout={pages.layout} page={pages.index} width={page.width} height={page.height} tool={annotationTool} sizes={annotationBrushSizes} />
      </div>}
    </div>
    <PageTurnBar index={pages.index} count={pages.doc?.pages.length ?? 0} busy={pages.busy} request={pages.request} />
  </section>;
}
