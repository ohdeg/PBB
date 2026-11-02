import { annotationDocumentKey } from './annotationStateBridge';
import { cloneState, emptyDocument, validateStatePayload, type ScoreState } from './temporiStateRepository';
import { TEMPORI_STORAGE } from '../constants/temporiStorage';
import { pageAnnotationKey } from '../pages/pageAnnotations';
const annotationLocalKey = (mode: string, id: string, _layout: string) => `${mode === 'wrapped' ? TEMPORI_STORAGE.annotationsPrefix : TEMPORI_STORAGE.horizontalAnnotationsPrefix}${id}`;
export function snapshotLegacyAnnotations(id: string): Record<string, string> {
  const result: Record<string, string> = {}; const wrapped = annotationLocalKey('wrapped', id, ''); const horizontal = annotationLocalKey('horizontal', id, ''); const pagePrefix = pageAnnotationKey(id, '');
  for (let index = 0; index < localStorage.length; index += 1) { const key = localStorage.key(index); if (key && (key === wrapped || key === horizontal || key.startsWith(pagePrefix))) { const raw = localStorage.getItem(key); if (raw !== null) result[key] = raw; } } return result;
}

/** Page layout keys identify source, renderer and transposition; ambiguous older modes stay archived. */
export async function mergeLegacyPageState(state: ScoreState, legacy: Record<string, string>, localId: string, originalHash: string): Promise<ScoreState> {
  const result = cloneState(state); const prefix = pageAnnotationKey(localId, '');
  for (const [storageKey, raw] of Object.entries(legacy)) {
    if (!storageKey.startsWith(prefix)) continue;
    const layout = storageKey.slice(prefix.length);
    if (!/^(pdf-[a-f0-9]{64}-intrinsic-rotation|xml-[a-f0-9]{64}-A4P-osmd1\.9\.9-transpose-?\d+)$/.test(layout)) continue;
    const key = await annotationDocumentKey('pages', layout); if (result.documents[key]) continue;
    try { const payload = { originalHash, layout: key, document: JSON.parse(raw) as unknown }; validateStatePayload(key, payload); result.documents[key] = { ...emptyDocument(), payload, generation: 1, dirty: true }; }
    catch { /* Raw legacy copy remains in the durable fork archive, never replaced with an empty document. */ }
  }
  return result;
}
