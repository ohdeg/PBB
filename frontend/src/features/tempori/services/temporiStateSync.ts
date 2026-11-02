import { captureCloudSession } from './temporiCloudApi';
import { stateRevisions, getStateDocument, putStateDocument, conflictDocument } from './temporiStateApi';
import { cloneState, emptyDocument, loadScoreState, updateScoreState, validateStatePayload, type ServerDocument, type StateIdentity } from './temporiStateRepository';
const active = new Map<string, Promise<void>>();
const errorMessage = (e: unknown) => (e as { response?: { status?: number } }).response?.status === 413 ? '동기화 용량을 초과했습니다. 이 기기의 내용은 유지됩니다.' : '연습 상태를 동기화하지 못했습니다. 이 기기의 내용은 유지되며 다시 시도할 수 있습니다.';
export async function syncScoreState(identity: StateIdentity, requested = ['practice', 'position'], blocked: string[] = []): Promise<void> {
  if (!identity.accountId || identity.scoreId.startsWith('tempori-')) return;
  const key = JSON.stringify([identity.owner, identity.scoreId]); const existing = active.get(key); if (existing) { await existing; return syncScoreState(identity, requested, blocked); }
  const job = sync(identity, requested, blocked); active.set(key, job); try { await job; } finally { active.delete(key); }
}
async function sync(identity: StateIdentity, requested: string[], blocked: string[]) {
  const { accountId, owner, scoreId } = identity; const session = captureCloudSession();
  const assert = () => { session.assert(); if (session.account !== accountId) throw new DOMException('Account changed', 'AbortError'); }; assert();
  let revisions: Awaited<ReturnType<typeof stateRevisions>>;
  try { revisions = await stateRevisions(accountId!, scoreId); assert(); }
  catch (error) { assert(); throw new Error(errorMessage(error)); }
  const initial = await loadScoreState(owner, scoreId); assert();
  const keys = new Set([...requested, ...Object.entries(initial.documents).filter(([, doc]) => doc.dirty || doc.inFlight).map(([key]) => key)]);
  for (const key of keys) {
    if (blocked.includes(key)) continue;
    try {
      assert();
      let doc = (await loadScoreState(owner, scoreId)).documents[key] ?? emptyDocument(); assert();
      if (doc.conflict) continue;
      // Replay an immutable uncertain request before doing any new comparison or write.
      if (!doc.inFlight && (!doc.serverKnown || (revisions.find((r) => r.documentKey === key)?.revision ?? 0) > doc.revision)) {
        const remote = await getStateDocument(accountId!, scoreId, key); assert(); checkRemote(identity, key, remote);
        await updateScoreState(owner, scoreId, (score) => {
          assert(); const current = score.documents[key] ?? emptyDocument();
          if (current.inFlight || current.conflict || remote.revision < current.revision) return score;
          if (current.dirty && remote.revision !== current.revision) { current.conflict = cloneState(remote); current.conflictOrigin = 'server'; }
          else if (!current.dirty) { if (JSON.stringify(current.payload) !== JSON.stringify(remote.payload)) current.generation += 1; current.payload = cloneState(remote.payload); current.revision = remote.revision; }
          current.serverKnown = true; current.error = undefined; score.documents[key] = current; return score;
        }); assert();
      }
      // Drain edits made while a request awaits, keeping every request tuple immutable.
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const state = await updateScoreState(owner, scoreId, (score) => {
          assert(); const current = score.documents[key];
          if (current?.dirty && current.serverKnown && !current.conflict && !current.inFlight) current.inFlight = { baseRevision: current.revision, mutationId: crypto.randomUUID(), schemaVersion: 1, payload: cloneState(current.payload), generation: current.generation };
          return score;
        }); assert(); doc = state.documents[key] ?? emptyDocument(); const mutation = doc.inFlight; if (!mutation || doc.conflict) break;
        try {
          const result = await putStateDocument(accountId!, scoreId, key, mutation); assert(); checkRemote(identity, key, result);
          await updateScoreState(owner, scoreId, (score) => {
            assert(); const current = score.documents[key];
            if (current?.inFlight?.mutationId !== mutation.mutationId) return score;
            current.revision = result.revision; current.inFlight = undefined; current.serverKnown = true; current.error = undefined;
            current.dirty = current.generation !== mutation.generation;
            if (!current.dirty) current.payload = cloneState(result.payload);
            return score;
          }); assert();
        } catch (error) {
          assert(); const conflict = conflictDocument(error); if (conflict) checkRemote(identity, key, conflict);
          await updateScoreState(owner, scoreId, (score) => {
            assert(); const current = score.documents[key];
            if (current?.inFlight?.mutationId === mutation.mutationId) {
              if (conflict) { current.conflict = cloneState(conflict); current.conflictOrigin = 'server'; current.inFlight = undefined; }
              else { current.error = errorMessage(error); const status = (error as { response?: { status?: number } }).response?.status; if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) current.inFlight = undefined; }
            }
            return score;
          }); assert(); break;
        }
      }
    } catch (error) {
      assert(); await updateScoreState(owner, scoreId, (score) => { assert(); const current = score.documents[key] ?? emptyDocument(); current.error = errorMessage(error); score.documents[key] = current; return score; });
    }
  }
}
function checkRemote(identity: StateIdentity, key: string, doc: ServerDocument) {
  if (!Number.isSafeInteger(doc.revision) || doc.revision < 0 || doc.schemaVersion !== 1) throw new Error('지원하지 않는 서버 상태입니다.');
  if (doc.payload !== null) { validateStatePayload(key, doc.payload); if (key.startsWith('annotations:') && (doc.payload as { originalHash: string }).originalHash !== identity.originalHash) throw new Error('원본이 다른 필기입니다.'); }
}
export async function resolveConflict(identity: StateIdentity, key: string, choice: 'local' | 'server', expected: { revision: number; generation: number }) {
  const session = captureCloudSession();
  return updateScoreState(identity.owner, identity.scoreId, (score) => {
    session.assert(); if (session.account !== identity.accountId) throw new DOMException('Account changed', 'AbortError');
    const current = score.documents[key];
    if (!current?.conflict || current.conflict.revision !== expected.revision || current.generation !== expected.generation) throw new Error('내용이 추가로 변경되었습니다. 최신 사본을 확인한 뒤 다시 선택해 주세요.');
    current.conflictCopies = [...(current.conflictCopies ?? []), { local: cloneState(current.payload), server: cloneState(current.conflict) }];
    if (choice === 'server') current.payload = cloneState(current.conflict.payload);
    current.revision = current.conflict.revision; current.serverKnown = true; current.conflict = undefined; current.inFlight = undefined; current.generation += 1; current.dirty = choice === 'local' || current.conflictOrigin === 'tab'; current.conflictOrigin = undefined; current.error = undefined; return score;
  });
}
