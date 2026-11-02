import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { captureCloudSession } from './temporiCloudApi';
import { emptyState, loadScoreState, saveLocalState, type ScoreState, type StateIdentity, validateStatePayload } from './temporiStateRepository';
import { resolveConflict, syncScoreState } from './temporiStateSync';
interface RecoveryEntry { key: string; payload: unknown; expectedGeneration?: number; order: number; parents?: string[] }
const recoveryKey = (id: StateIdentity) => `tempori:state-recovery:${JSON.stringify([id.owner, id.scoreId])}:`;
let recoveryOrder = 0;
export function writeStateRecovery(id: StateIdentity, key: string, payload: unknown, expectedGeneration?: number, parents: string[] = []) {
  const storageKey = `${recoveryKey(id)}${crypto.randomUUID()}`;
  localStorage.setItem(storageKey, JSON.stringify({ key, payload, expectedGeneration, parents, order: Date.now() * 1000 + (recoveryOrder++ % 1000) }));
  return storageKey;
}
export function recoveryEntries(id: StateIdentity): [string, RecoveryEntry][] {
  const entries: [string, RecoveryEntry][] = [];
  for (let i = 0; i < localStorage.length; i += 1) { const key = localStorage.key(i); if (key?.startsWith(recoveryKey(id))) entries.push([key, JSON.parse(localStorage.getItem(key)!) as RecoveryEntry]); }
  return entries.sort((a, b) => a[1].order - b[1].order);
}
export async function persistStateRecovery(id: StateIdentity, key: string, payload: unknown, expectedGeneration?: number, recoveryId?: string) {
  await saveLocalState(id.owner, id.scoreId, key, payload, expectedGeneration);
  if (recoveryId) {
    const remove = (id: string, seen = new Set<string>()) => { if (seen.has(id) || !id.startsWith(recoveryKey(identityForCleanup))) return; seen.add(id); const raw = localStorage.getItem(id); if (raw) { const entry = JSON.parse(raw) as RecoveryEntry; for (const parent of entry.parents ?? []) remove(parent, seen); } localStorage.removeItem(id); };
    const identityForCleanup = id; remove(recoveryId);
  }
}
interface StateContext {
  identity: StateIdentity; state: ScoreState; ready: boolean; busy: boolean;
  setBusy: (busy: boolean) => void; save: (key: string, payload: unknown, expectedGeneration?: number) => void;
  adoptRecovery: (key: string, recoveryId: string) => void;
  refresh: (keys?: string[]) => Promise<void>; reportError: (message: string) => void;
}
const Context = createContext<StateContext | null>(null);
export const useTemporiState = () => useContext(Context);
export function TemporiStateProvider({ identity, children }: { identity: StateIdentity; children: ReactNode }) {
  const [state, setState] = useState<ScoreState>(emptyState); const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(identity.initializationError ?? '');
  const mounted = useRef(true); const timer = useRef<ReturnType<typeof setTimeout> | null>(null); const keys = useRef(new Set(['practice', 'position'])); const writes = useRef(Promise.resolve()); const recoveryParents = useRef(new Map<string, string[]>());
  const adoptRecovery = useCallback((key: string, recoveryId: string) => { recoveryParents.current.set(key, [recoveryId]); }, []);
  const reportError = useCallback((message: string) => { if (mounted.current) setError(message); }, []);
  const refresh = useCallback(async (extra: string[] = []) => {
    extra.forEach((key) => keys.current.add(key));
    try {
      await writes.current; const blocked = [...new Set(recoveryEntries(identity).map(([, entry]) => entry.key))];
      await syncScoreState(identity, [...keys.current], blocked);
      if (mounted.current) setError(blocked.length ? '일부 연습 상태의 기기 저장이 완료되지 않았습니다. 복구 사본을 보관하고 있습니다.' : identity.initializationError ?? '');
    }
    catch (failure) { if (mounted.current && !(failure instanceof DOMException && failure.name === 'AbortError')) setError(failure instanceof Error ? failure.message : '연습 상태 동기화에 실패했습니다.'); }
  }, [identity]);
  const save = useCallback((key: string, payload: unknown, expectedGeneration?: number) => {
    // This throws synchronously if recovery cannot be written. Annotation flush then blocks teardown.
    const recoveryId = writeStateRecovery(identity, key, payload, expectedGeneration, recoveryParents.current.get(key) ?? []);
    recoveryParents.current.set(key, [recoveryId]);
    validateStatePayload(key, payload);
    keys.current.add(key);
    writes.current = writes.current.catch(() => {}).then(() => persistStateRecovery(identity, key, payload, expectedGeneration, recoveryId)).catch(() => { reportError('연습 상태의 기기 저장을 마치지 못했습니다. 복구 사본을 보관했습니다. 다시 시도해 주세요.'); });
    if (timer.current) clearTimeout(timer.current);
    if (mounted.current) timer.current = setTimeout(() => { void refresh(); }, 1000);
  }, [identity, refresh, reportError]);
  useEffect(() => {
    mounted.current = true; const session = captureCloudSession(); let cancelled = false;
    const reload = async () => { const next = await loadScoreState(identity.owner, identity.scoreId); session.assert(); if (!cancelled) setState(next); };
    const changed = (event: Event) => { const detail = (event as CustomEvent).detail; if (detail.owner === identity.owner && detail.scoreId === identity.scoreId) void reload().catch(() => {}); };
    window.addEventListener('tempori-state-changed', changed);
    void (async () => {
      try {
        for (const [recoveryId, entry] of recoveryEntries(identity)) { session.assert(); try { await persistStateRecovery(identity, entry.key, entry.payload, entry.expectedGeneration, recoveryId); } catch { recoveryParents.current.set(entry.key, [recoveryId]); if (!cancelled) setError('이전 편집의 복구 사본을 보관했습니다. 저장 용량을 확인해 주세요.'); } }
        await reload(); if (!cancelled) setReady(true); await refresh(); await reload();
      } catch (failure) { if (!cancelled) { setReady(true); setError(failure instanceof Error ? failure.message : '기기 연습 상태를 읽지 못했습니다.'); } }
    })();
    const resume = () => { if (document.visibilityState !== 'hidden') void refresh(); };
    window.addEventListener('online', resume); window.addEventListener('focus', resume); document.addEventListener('visibilitychange', resume);
    const poll = setInterval(resume, 30000);
    return () => { cancelled = true; mounted.current = false; if (timer.current) clearTimeout(timer.current); clearInterval(poll); window.removeEventListener('tempori-state-changed', changed); window.removeEventListener('online', resume); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); };
  }, [identity, refresh]);
  const value = useMemo(() => ({ identity, state, ready, busy, setBusy, save, refresh, reportError, adoptRecovery }), [identity, state, ready, busy, save, refresh, reportError, adoptRecovery]);
  const conflicts = Object.entries(state.documents).filter(([, doc]) => doc.conflict);
  const errors = Object.values(state.documents).map((doc) => doc.error).filter(Boolean);
  return <Context.Provider value={value}>
    {(error || errors.length > 0) && <div className="tempori-view-notice" role="status"><p>{error || errors[0]}</p><button type="button" onClick={() => {
      writes.current = writes.current.catch(() => {}).then(async () => { for (const [recoveryId, entry] of recoveryEntries(identity)) await persistStateRecovery(identity, entry.key, entry.payload, entry.expectedGeneration, recoveryId); }).catch(() => reportError('기기 복구 사본 저장에 실패했습니다.')); void refresh();
    }}>상태 동기화 다시 시도</button></div>}
    {conflicts.map(([key, doc]) => <div className="tempori-view-notice" role="status" key={key}><p>{key === 'practice' ? '연습 설정' : key === 'position' ? '연습 위치' : '필기'} 내용이 다른 기기에서 변경되었습니다. 두 사본을 보관하고 사용할 내용을 선택하세요.</p>{(['local', 'server'] as const).map((choice) => <button type="button" key={choice} disabled={busy} onClick={() => { void resolveConflict(identity, key, choice, { revision: doc.conflict!.revision, generation: doc.generation }).then(() => refresh([key])).catch((e: unknown) => reportError(e instanceof Error ? e.message : '충돌 해결에 실패했습니다.')); }}>{choice === 'local' ? '이 기기 내용 사용' : doc.conflictOrigin === 'tab' ? '다른 탭 내용 사용' : '서버 내용 사용'}</button>)}</div>)}
    {ready ? children : <p role="status">연습 상태를 준비하고 있습니다…</p>}
  </Context.Provider>;
}
