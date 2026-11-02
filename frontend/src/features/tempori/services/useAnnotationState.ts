import { useEffect, useRef, useState } from 'react';
import { recoveryEntries, useTemporiState } from './TemporiStateProvider';
import { loadState, saveLocalState, validateStatePayload } from './temporiStateRepository';
import { annotationDocumentKey, registerAnnotationWriter } from './annotationStateBridge';
import { TEMPORI_STORAGE } from '../constants/temporiStorage';
import { pageAnnotationKey } from '../pages/pageAnnotations';
import { cloudCache } from './cloudCache';
export type AnnotationMode = 'pages' | 'wrapped' | 'horizontal';
export const annotationLocalKey = (mode: AnnotationMode, id: string, layout: string) => mode === 'pages' ? pageAnnotationKey(id, layout) : `${mode === 'wrapped' ? TEMPORI_STORAGE.annotationsPrefix : TEMPORI_STORAGE.horizontalAnnotationsPrefix}${id}`;

export function useAnnotationState(mode: AnnotationMode, layout: string, legacyId: string) {
  const context = useTemporiState(); const [binding, setBinding] = useState<{ storageId: string; key: string; revision: number } | null>(null); const [error, setError] = useState('');
  const current = useRef(context); current.current = context; const applied = useRef(''); const generation = useRef(0); const contextIdentity = context?.identity;
  useEffect(() => {
    if (!contextIdentity || !layout) return;
    let cancelled = false; let unregister: (() => void) | undefined; const identity = contextIdentity;
    setBinding(null); setError(''); applied.current = '';
    void (async () => {
      try {
        const key = await annotationDocumentKey(mode, layout); const storageId = `state:${JSON.stringify([identity.owner, identity.scoreId, key])}`;
        await current.current!.refresh([key]); if (cancelled) return;
        let doc = await loadState(identity.owner, identity.scoreId, key); if (cancelled) return;
        // Legacy wrapped strokes lack a reliable geometry identity; preserve rather than reassign them.
        if (doc.payload === null) {
          const fork = identity.accountId && !identity.scoreId.startsWith('tempori-') ? await cloudCache<Record<string, string>>(`legacy-fork:${identity.accountId}:${identity.scoreId}`) : undefined;
          const oldKey = annotationLocalKey(mode, legacyId, mode === 'pages' ? layout : '');
          const raw = fork ? fork[oldKey] : identity.accountId && !identity.scoreId.startsWith('tempori-') ? undefined : localStorage.getItem(oldKey);
          if (raw) {
            if (mode !== 'pages') setError('이전 필기는 기존 기기 저장소에 보관했습니다. 배치·조옮김 정보가 없어 현재 화면에 자동 적용하지 않았습니다.');
            else {
              try { const payload = { originalHash: identity.originalHash, layout: key, document: JSON.parse(raw) as unknown }; validateStatePayload(key, payload); await saveLocalState(identity.owner, identity.scoreId, key, payload); doc = await loadState(identity.owner, identity.scoreId, key); }
              catch { setError('이전 필기를 확인하지 못했습니다. 기존 원본을 보관했습니다.'); }
            }
          }
        }
        if (cancelled) return;
        const recoverySelection = recoveryEntries(identity).filter(([, entry]) => entry.key === key).at(-1); const recovery = recoverySelection?.[1];
        if (recovery) { current.current!.adoptRecovery(key, recoverySelection![0]); validateStatePayload(key, recovery.payload, false); doc = { ...doc, payload: recovery.payload }; setError('필기 복구 사본을 표시합니다. 동기화 용량 또는 기기 저장 공간을 확인해 주세요.'); }
        const payload = doc.payload as { layout?: string; document?: unknown } | null;
        if (payload && payload.layout !== key) throw new Error('다른 배치의 필기는 보관하고 이 화면에 표시하지 않습니다.');
        const document = payload?.document ?? (mode === 'pages' ? { version: 1, pages: [] } : { version: mode === 'horizontal' ? 2 : 1, strokes: [] });
        localStorage.setItem(annotationLocalKey(mode, storageId, layout), JSON.stringify(document)); applied.current = JSON.stringify(document);
        generation.current = doc.generation;
        unregister = registerAnnotationWriter(storageId, (document) => { const next = JSON.stringify(document); if (next === applied.current) return; current.current!.save(key, { originalHash: identity.originalHash, layout: key, document }, generation.current); generation.current += 1; applied.current = next; });
        setBinding({ storageId, key, revision: 0 });
      } catch (failure) { if (!cancelled) setError(failure instanceof Error ? failure.message : '필기를 불러오지 못했습니다.'); }
    })();
    return () => { cancelled = true; queueMicrotask(() => unregister?.()); };
  }, [contextIdentity, mode, layout, legacyId]);
  const document = binding && context?.state.documents[binding.key];
  useEffect(() => {
    if (!binding || !document?.payload || context?.busy || document.conflict) return;
    if (context && recoveryEntries(context.identity).some(([, entry]) => entry.key === binding.key)) return;
    const payload = document.payload as { layout: string; document: unknown }; const text = JSON.stringify(payload.document);
    if (payload.layout !== binding.key) return;
    if (text === applied.current) { generation.current = Math.max(generation.current, document.generation); return; }
    try { localStorage.setItem(annotationLocalKey(mode, binding.storageId, layout), text); applied.current = text; generation.current = document.generation; setBinding((value) => value && ({ ...value, revision: value.revision + 1 })); }
    catch { context?.reportError('필기 복구 사본을 저장하지 못했습니다.'); }
  }, [binding, document, context, layout, mode]);
  return context ? { storageId: binding?.storageId ?? '', ready: !!binding, revision: binding?.revision ?? 0, error } : { storageId: legacyId, ready: true, revision: 0, error: '' };
}
