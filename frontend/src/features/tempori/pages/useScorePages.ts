import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { AnnotationLayerHandle } from '../types/temporiAnnotation';
import type { TemporiRenderSnapshot } from '../components/OsmdViewer';
import type { PageDocument, PageTurnRequest, ScoreSource } from './types';
import { createPageTurnController } from './pageTurnController';
import { createPdfPageDocument } from './PdfPageRenderer';
import { createMusicXmlPageDocument } from './MusicXmlPageRenderer';
import { pageLayoutKey } from './pageAnnotations';
export function useScorePages(source: ScoreSource, transpose: number, annotation: RefObject<AnnotationLayerHandle | null>, initialMeasure: number, onSnapshot?: (value: TemporiRenderSnapshot) => void, onManual?: () => void, onReady?: (ready: boolean) => void) {
  const [doc, setDoc] = useState<PageDocument | null>(null); const [index, setIndex] = useState(0); const indexRef = useRef(0);
  const [content, setContent] = useState<HTMLElement | null>(null); const prepared = useRef<HTMLElement | null>(null);
  const [layout, setLayout] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [retry, setRetry] = useState(0); const [zoom, setZoom] = useState(1); const [manualRevision, setManualRevision] = useState(0);
  const callbacks = useRef({ onSnapshot, onManual, onReady, initialMeasure }); callbacks.current = { onSnapshot, onManual, onReady, initialMeasure };
  const pendingRequest = useRef<PageTurnRequest | null>(null);
  useEffect(() => {
    const abort = new AbortController(); let document: PageDocument | null = null; setDoc(null); setContent(null); setError(''); setBusy(true); callbacks.current.onReady?.(false);
    void (async () => {
      try {
        const key = await pageLayoutKey(source.kind === 'pdf' ? source.blob : source.xml, transpose, source.kind);
        if (abort.signal.aborted) return;
        document = source.kind === 'pdf' ? await createPdfPageDocument(source.blob, abort.signal) : await createMusicXmlPageDocument(source.xml, transpose, abort.signal, (value) => { if (!abort.signal.aborted) callbacks.current.onSnapshot?.(value); });
        if (abort.signal.aborted) { document.dispose(); return; }
        const initial = document.measurePages?.[callbacks.current.initialMeasure] ?? 0;
        const holder = window.document.createElement('div'); holder.className = 'tempori-page-render'; await document.render(initial, holder);
        if (abort.signal.aborted) return;
        indexRef.current = initial; setIndex(initial); setContent(holder); setLayout(key); setDoc(document); setZoom(1); setBusy(false); callbacks.current.onReady?.(true);
      } catch (failure) { if (!abort.signal.aborted) { document?.dispose(); setError(failure instanceof Error ? failure.message : '페이지를 불러오지 못했습니다.'); setBusy(false); } }
    })();
    return () => { abort.abort(); document?.dispose(); };
  }, [source, transpose, retry]);
  useEffect(() => {
    if (!doc || source.kind !== 'pdf' || zoom <= 1) return;
    let cancelled = false; const expectedIndex = indexRef.current;
    const holder = document.createElement('div'); holder.className = 'tempori-page-render';
    void doc.render(expectedIndex, holder, zoom).then(() => { if (!cancelled && expectedIndex === indexRef.current) setContent(holder); }).catch(() => { if (!cancelled) setError('확대 화질을 다시 준비하지 못했습니다. 현재 페이지는 유지됩니다.'); });
    return () => { cancelled = true; };
  }, [doc, zoom, source.kind]);
  const controller = useMemo(() => createPageTurnController({ count: () => doc?.pages.length ?? 0, current: () => indexRef.current, ready: () => !!doc,
    flush: () => annotation.current?.flush() ?? true,
    async prepare(next) { setBusy(true); setError(''); const target = document.createElement('div'); target.className = 'tempori-page-render'; await doc!.render(next, target); prepared.current = target; },
    async transition() { if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) await new Promise((resolve) => setTimeout(resolve, 180)); },
    commit(next, origin) { indexRef.current = next; setIndex(next); setContent(prepared.current); prepared.current = null; setZoom(1); setBusy(false); pendingRequest.current = null; if (origin !== 'playback') { callbacks.current.onManual?.(); setManualRevision((value) => value + 1); } },
    fail(failure) { setBusy(false); setError(failure instanceof Error ? failure.message : '페이지를 넘기지 못했습니다.'); },
  }), [doc, annotation]);
  useEffect(() => () => controller.dispose(), [controller]);
  const request = useCallback((input: PageTurnRequest) => { pendingRequest.current = input; void controller.request(input); }, [controller]);
  const follow = useCallback((measure: number) => { const next = doc?.measurePages?.[measure]; if (next !== undefined && next !== indexRef.current) void controller.goTo(next, { delta: next > indexRef.current ? 1 : -1, origin: 'playback', timestamp: performance.now() }); }, [controller, doc]);
  return { doc, index, content, layout, error, busy, zoom, setZoom, manualRevision, request, follow,
    goToPage(next: number) { if (next === indexRef.current) return Promise.resolve(true); return controller.goTo(next, { delta: next > indexRef.current ? 1 : -1, origin: 'playback', timestamp: performance.now() }); },
    retry() { if (doc && pendingRequest.current) request({ ...pendingRequest.current, timestamp: performance.now() }); else setRetry((value) => value + 1); },
  };
}
