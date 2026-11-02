import { useAnnotationState } from '../services/useAnnotationState';
import { applyEraserAtPoint } from '../utils/annotationEraser';
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import type { AnnotationBrushSizes, AnnotationLayerHandle, AnnotationToolMode } from '../types/temporiAnnotation';
import { loadPageAnnotations, savePageAnnotations, type PageAnnotationDocument, type PagePoint, type PageStroke } from './pageAnnotations';
interface Props { storageId?: string; id: string; layout: string; page: number; width: number; height: number; tool: AnnotationToolMode; sizes: AnnotationBrushSizes; ref?: Ref<AnnotationLayerHandle> }
export function PageAnnotationLayer(props: Props) {
  const sync = useAnnotationState('pages', props.layout, props.id);
  return <>{sync.error && <p role="status">{sync.error}</p>}{sync.ready && <PageAnnotationLayerInner key={`${sync.storageId}:${sync.revision}`} {...props} storageId={sync.storageId} />}</>;
}
function PageAnnotationLayerInner({ id, storageId = id, layout, page, width, height, tool, sizes, ref }: Props) {
  const [loaded] = useState(() => loadPageAnnotations(storageId, layout));
  const documentRef = useRef<PageAnnotationDocument>(loaded.ok ? loaded.document : { version: 1, pages: [] });
  const strokeRef = useRef<PageStroke | null>(null); const pointer = useRef<number | null>(null); const dirty = useRef(false);
  const [revision, redraw] = useState(0); const [error, setError] = useState(loaded.ok ? '' : '저장된 페이지 필기를 읽지 못했습니다. 원본 저장 내용을 보존했습니다.');
  const strokes = useCallback(() => documentRef.current.pages.find((item) => item.pageIndex === page)?.strokes ?? [], [page]);
  const replace = useCallback((next: PageStroke[]) => { const doc = documentRef.current; documentRef.current = { version: 1, pages: [...doc.pages.filter((item) => item.pageIndex !== page), { pageIndex: page, strokes: next }] }; dirty.current = true; redraw((value) => value + 1); }, [page]);
  const flush = useCallback(() => {
    if (!loaded.ok) return false;
    if (strokeRef.current) { const stroke = strokeRef.current; strokeRef.current = null; pointer.current = null; if (stroke.points.length >= 2) replace([...(documentRef.current.pages.find((item) => item.pageIndex === page)?.strokes ?? []), stroke]); }
    if (!dirty.current) return true;
    try { savePageAnnotations(storageId, layout, documentRef.current); dirty.current = false; setError(''); return true; }
    catch { setError('필기를 저장하지 못했습니다. 저장 공간을 확인한 후 다시 시도해 주세요.'); return false; }
  }, [storageId, layout, loaded.ok, page, replace]);
  useImperativeHandle(ref, () => ({ flush }), [flush]);
  useEffect(() => () => { flush(); }, [flush]);
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { temporiId: string; viewMode: string };
      if (detail.temporiId !== id || detail.viewMode !== 'pages' || !loaded.ok) return;
      flush(); replace(event.type.endsWith('undo') ? strokes().slice(0, -1) : []); flush();
    };
    window.addEventListener('tempori-annotations-clear', handler); window.addEventListener('tempori-annotations-undo', handler);
    return () => { window.removeEventListener('tempori-annotations-clear', handler); window.removeEventListener('tempori-annotations-undo', handler); };
  }, [id, loaded.ok, page, flush, replace, strokes]);
  const pointAt = (event: React.PointerEvent<SVGSVGElement>): PagePoint => { const rect = event.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }; };
  const erase = (point: PagePoint) => { const previous = strokes().map((stroke) => ({ ...stroke, width: stroke.widthPageRatio * width })); replace(applyEraserAtPoint(previous, point.x * width, point.y * height, width, height, sizes.eraser).map((stroke) => ({ ...stroke, widthPageRatio: stroke.width / width }))); };
  const visible = [...strokes(), ...(strokeRef.current ? [strokeRef.current] : [])]; void revision;
  return <><svg className="tempori-page-annotations" viewBox={`0 0 ${width} ${height}`} aria-label="페이지 필기" style={{ pointerEvents: tool === 'none' || !loaded.ok ? 'none' : 'auto', touchAction: tool === 'none' ? 'auto' : 'none' }}
    onPointerDown={(event) => {
      if (event.button !== 0 || !event.isPrimary || tool === 'none' || !loaded.ok || pointer.current !== null) return; event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); pointer.current = event.pointerId;
      const point = pointAt(event); if (tool === 'eraser') { erase(point); return; }
      strokeRef.current = { id: crypto.randomUUID(), tool, color: tool === 'highlighter' ? '#facc15' : '#dc2626', widthPageRatio: sizes[tool] / width, points: [point] }; redraw((value) => value + 1);
    }} onPointerMove={(event) => {
      if (pointer.current !== event.pointerId) return; event.stopPropagation(); const point = pointAt(event); if (tool === 'eraser') erase(point); else if (strokeRef.current) { strokeRef.current.points.push(point); redraw((value) => value + 1); }
    }} onPointerUp={(event) => { if (pointer.current === event.pointerId) { event.stopPropagation(); pointer.current = null; flush(); } }} onPointerCancel={(event) => { if (pointer.current === event.pointerId) { pointer.current = null; flush(); } }} onLostPointerCapture={() => { pointer.current = null; flush(); }}>
    {visible.map((stroke) => <polyline key={stroke.id} points={stroke.points.map((point) => `${point.x * width},${point.y * height}`).join(' ')} fill="none" stroke={stroke.color} strokeWidth={stroke.widthPageRatio * width} strokeLinecap="round" strokeLinejoin="round" opacity={stroke.tool === 'highlighter' ? .35 : 1} />)}
  </svg>{error && <div className="tempori-page-save-error" role="alert">{error}{loaded.ok && <button type="button" onClick={flush}>필기 저장 재시도</button>}</div>}</>;
}
