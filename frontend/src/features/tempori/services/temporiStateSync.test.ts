// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { createAccountSession } from './cloudSession';
const boundary = vi.hoisted(() => ({ session: null as ReturnType<typeof createAccountSession> | null, cache: new Map<string, unknown>(), put: vi.fn(), get: vi.fn(), revisions: vi.fn() }));
vi.mock('./cloudCache', () => ({ cloudCache: async (key: string) => structuredClone(boundary.cache.get(key)), updateCloudCache: async (key: string, change: (value: unknown) => unknown) => { const next = change(structuredClone(boundary.cache.get(key))); boundary.cache.set(key, structuredClone(next)); return next; } }));
vi.mock('./temporiCloudApi', () => ({ captureCloudSession: () => boundary.session!.capture() }));
vi.mock('./temporiStateApi', () => ({ stateRevisions: boundary.revisions, getStateDocument: boundary.get, putStateDocument: boundary.put, conflictDocument: (error: { conflict?: unknown }) => error.conflict ?? null }));
import { loadState, saveLocalState, seedScoreState } from './temporiStateRepository';
import { resolveConflict, syncScoreState } from './temporiStateSync';
const id = { owner: 'account:A', accountId: 'A', scoreId: 'server-score', originalHash: 'a'.repeat(64) };
const practice = (bpm: number) => ({ bpm, startMeasure: 1, endMeasure: 2, isRepeatMode: false, tempoChanges: [] });
const remote = (revision: number, bpm: number | null) => ({ revision, updatedAt: null, schemaVersion: 1, payload: bpm === null ? null : practice(bpm) });
beforeEach(() => { vi.clearAllMocks(); boundary.cache.clear(); boundary.session = createAccountSession('A'); boundary.revisions.mockResolvedValue([]); boundary.get.mockResolvedValue(remote(0, null)); boundary.put.mockImplementation(async (_a, _s, _k, mutation) => ({ ...remote(mutation.baseRevision + 1, null), payload: mutation.payload })); });
it('guest and local-only documents never invoke state APIs', async () => {
  await syncScoreState({ ...id, accountId: null }); await syncScoreState({ ...id, scoreId: 'tempori-local' }); expect(boundary.revisions).not.toHaveBeenCalled();
});
it('keeps an edit made while PUT is in flight and sends it against the acknowledged revision', async () => {
  await saveLocalState(id.owner, id.scoreId, 'practice', practice(120)); let finish!: (value: unknown) => void;
  boundary.put.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const running = syncScoreState(id, ['practice']); await vi.waitFor(() => expect(boundary.put).toHaveBeenCalledTimes(1));
  await saveLocalState(id.owner, id.scoreId, 'practice', practice(160)); finish(remote(1, 120)); await running;
  expect(boundary.put.mock.calls[1][3]).toMatchObject({ baseRevision: 1, payload: practice(160) });
  expect(await loadState(id.owner, id.scoreId, 'practice')).toMatchObject({ revision: 2, dirty: false, payload: practice(160) });
});
it('replays the identical uncertain mutation after an offline/response-loss failure', async () => {
  await saveLocalState(id.owner, id.scoreId, 'practice', practice(120)); boundary.put.mockRejectedValueOnce(new Error('lost response'));
  await syncScoreState(id, ['practice']); const first = boundary.put.mock.calls[0][3];
  await saveLocalState(id.owner, id.scoreId, 'practice', practice(180)); await syncScoreState(id, ['practice']);
  expect(boundary.put.mock.calls[1][3]).toEqual(first); expect(boundary.put.mock.calls[2][3].payload.bpm).toBe(180);
});
it('preserves both conflict copies and refuses a stale resolution after another local edit', async () => {
  await saveLocalState(id.owner, id.scoreId, 'practice', practice(120)); boundary.get.mockResolvedValue(remote(4, 140));
  await syncScoreState(id, ['practice']); const first = await loadState(id.owner, id.scoreId, 'practice');
  expect(first.conflict?.revision).toBe(4); expect(boundary.put).not.toHaveBeenCalled();
  await saveLocalState(id.owner, id.scoreId, 'practice', practice(160));
  await expect(resolveConflict(id, 'practice', 'server', { revision: 4, generation: first.generation })).rejects.toThrow('추가로 변경');
  const latest = await loadState(id.owner, id.scoreId, 'practice');
  await resolveConflict(id, 'practice', 'local', { revision: 4, generation: latest.generation });
  expect(await loadState(id.owner, id.scoreId, 'practice')).toMatchObject({ revision: 4, dirty: true, payload: practice(160), conflictCopies: [{ local: practice(160), server: remote(4, 140) }] });
});
it('drops late responses after account switch without sending the pending queue to B', async () => {
  await saveLocalState(id.owner, id.scoreId, 'practice', practice(120)); let finish!: (value: unknown) => void;
  boundary.put.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })); const running = syncScoreState(id, ['practice']);
  await vi.waitFor(() => expect(boundary.put).toHaveBeenCalled()); boundary.session!.setAccount('B'); finish(remote(1, 120));
  await expect(running).rejects.toMatchObject({ name: 'AbortError' }); expect((await loadState(id.owner, id.scoreId, 'practice')).dirty).toBe(true);
});
it('forks guest state only once so later guest changes cannot overwrite the account copy', async () => {
  await saveLocalState('guest-device', 'tempori-local', 'practice', practice(120)); await seedScoreState('guest-device', 'tempori-local', id.owner, id.scoreId);
  await saveLocalState('guest-device', 'tempori-local', 'practice', practice(200)); await seedScoreState('guest-device', 'tempori-local', id.owner, id.scoreId);
  expect((await loadState(id.owner, id.scoreId, 'practice')).payload).toEqual(practice(120));
});
it('allows a smaller repaired edit after a definitive quota rejection', async () => {
  await saveLocalState(id.owner, id.scoreId, 'practice', practice(120)); boundary.put.mockRejectedValueOnce({ response: { status: 413 } });
  await syncScoreState(id, ['practice']); await saveLocalState(id.owner, id.scoreId, 'practice', practice(100)); await syncScoreState(id, ['practice']);
  expect(boundary.put.mock.calls[1][3].payload.bpm).toBe(100);
});
it('turns a stale other-tab full-document edit into an explicit conflict instead of silently replacing it', async () => {
  await saveLocalState(id.owner, id.scoreId, 'practice', practice(120));
  const tabA = await loadState(id.owner, id.scoreId, 'practice');
  await saveLocalState(id.owner, id.scoreId, 'practice', practice(140), tabA.generation);
  await saveLocalState(id.owner, id.scoreId, 'practice', practice(180), tabA.generation);
  const doc = await loadState(id.owner, id.scoreId, 'practice');
  expect(doc.payload).toEqual(practice(180)); expect(doc.conflict?.payload).toEqual(practice(140));
  await syncScoreState(id, ['practice']); expect(boundary.put).not.toHaveBeenCalled();
});
it('keeps the chosen other-tab unsent content dirty so it reaches the server', async () => {
  await saveLocalState(id.owner, id.scoreId, 'practice', practice(160), 0);
  await saveLocalState(id.owner, id.scoreId, 'practice', practice(120), 0);
  const doc = await loadState(id.owner, id.scoreId, 'practice');
  await resolveConflict(id, 'practice', 'server', { revision: doc.conflict!.revision, generation: doc.generation });
  expect((await loadState(id.owner, id.scoreId, 'practice')).dirty).toBe(true);
  await syncScoreState(id, ['practice']); expect(boundary.put.mock.calls[0][3].payload.bpm).toBe(160);
});
it('increments generation when a remote payload arrives so an unseen remote edit cannot be overwritten', async () => {
  const displayedGeneration = 0; boundary.get.mockResolvedValue(remote(2, 160));
  await syncScoreState(id, ['practice']); await saveLocalState(id.owner, id.scoreId, 'practice', practice(120), displayedGeneration);
  expect((await loadState(id.owner, id.scoreId, 'practice')).conflict?.payload).toEqual(practice(160));
});
it('does not drop a new requested layout/document while another score sync is active', async () => {
  let finish!: (value: unknown) => void; boundary.get.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const first = syncScoreState(id, ['practice']); await vi.waitFor(() => expect(boundary.get).toHaveBeenCalled());
  const second = syncScoreState(id, ['position']); finish(remote(0, null)); await Promise.all([first, second]);
  expect(boundary.get.mock.calls.map((args) => args[2])).toContain('position');
});
it('syncs independent practice while a recovery-affected document is excluded from the automatic dirty union', async () => {
  await saveLocalState(id.owner, id.scoreId, 'practice', practice(140));
  await saveLocalState(id.owner, id.scoreId, 'position', { kind: 'pdf', pageIndex: 3, y: .4 });
  await syncScoreState(id, ['practice', 'position'], ['position']);
  expect(boundary.put.mock.calls.map((args) => args[2])).toEqual(['practice']);
  expect((await loadState(id.owner, id.scoreId, 'position')).dirty).toBe(true);
});
