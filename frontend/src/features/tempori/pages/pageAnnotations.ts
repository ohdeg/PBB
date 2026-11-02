import { publishAnnotationChange } from '../services/annotationStateBridge';
export interface PagePoint { x: number; y: number }
export interface PageStroke { id: string; tool: 'pen' | 'highlighter'; color: string; widthPageRatio: number; points: PagePoint[] }
export interface PageAnnotationDocument { version: 1; pages: { pageIndex: number; strokes: PageStroke[] }[] }
const prefix = 'tempori:annotations:pages:';
const pending = new Map<string, PageAnnotationDocument>();
export const pageAnnotationKey = (id: string, layout: string) => `${prefix}${id}:${layout}`;
const empty = (): PageAnnotationDocument => ({ version: 1, pages: [] });
function valid(value: unknown): value is PageAnnotationDocument {
  if (!value || typeof value !== 'object') return false;
  const doc = value as PageAnnotationDocument;
  return doc.version === 1 && Array.isArray(doc.pages) && doc.pages.every((page) => Number.isInteger(page.pageIndex) && page.pageIndex >= 0 && Array.isArray(page.strokes) && page.strokes.every((stroke) => typeof stroke.id === 'string' && ['pen', 'highlighter'].includes(stroke.tool) && typeof stroke.color === 'string' && Number.isFinite(stroke.widthPageRatio) && stroke.widthPageRatio > 0 && Array.isArray(stroke.points) && stroke.points.length >= 2 && stroke.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)));
}
export function loadPageAnnotations(id: string, layout: string): { ok: true; document: PageAnnotationDocument } | { ok: false } {
  const key = pageAnnotationKey(id, layout); const draft = pending.get(key); if (draft) return { ok: true, document: draft };
  try { const raw = localStorage.getItem(key); if (!raw) return { ok: true, document: empty() }; const parsed: unknown = JSON.parse(raw); return valid(parsed) ? { ok: true, document: parsed } : { ok: false }; } catch { return { ok: false }; }
}
export function savePageAnnotations(id: string, layout: string, doc: PageAnnotationDocument) {
  const key = pageAnnotationKey(id, layout); pending.set(key, doc);
  localStorage.setItem(key, JSON.stringify(doc)); publishAnnotationChange(id, doc); pending.delete(key);
}
export function clearPageAnnotations(id: string) {
  const start = `${prefix}${id}:`; const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) { const key = localStorage.key(index); if (key?.startsWith(start)) keys.push(key); }
  keys.forEach((key) => localStorage.removeItem(key));
  for (const key of pending.keys()) if (key.startsWith(start)) pending.delete(key);
}
export async function pageLayoutKey(source: string | Blob, transpose: number, kind: 'pdf' | 'musicxml') {
  const bytes = typeof source === 'string' ? new TextEncoder().encode(source) : await source.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return kind === 'pdf' ? `pdf-${hash}-intrinsic-rotation` : `xml-${hash}-A4P-osmd1.9.9-transpose${transpose}`;
}
