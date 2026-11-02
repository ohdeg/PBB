// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccountSession } from './cloudSession';
const boundary = vi.hoisted(() => ({ session: null as ReturnType<typeof createAccountSession> | null, cache: new Map<string, unknown>(), upload: vi.fn(), records: vi.fn(), blob: new Blob(['abc']) }));
vi.mock('./temporiCloudApi', () => ({ captureCloudSession: () => boundary.session!.capture(), scoreHash: async () => 'hash', uploadCloudScore: boundary.upload }));
vi.mock('./cloudCache', () => ({ cloudCache: async (key: string, value?: unknown) => value === undefined ? boundary.cache.get(key) : boundary.cache.set(key, value), updateCloudCache: async (key: string, update: (value: unknown) => unknown) => { const next = update(boundary.cache.get(key)); boundary.cache.set(key, next); return next; } }));
vi.mock('../utils/libraryUserId', () => ({ getLocalLibraryUserId: () => 'guest-device' }));
vi.mock('../utils/localTempori', () => ({ fetchLocalTemporiRecords: boundary.records, fetchLocalTemporiContent: async () => boundary.blob }));
import { migrateLocalScore, migrationJobs, restartDeletedMigration, saveMigrationJob } from './temporiMigration';
beforeEach(() => { vi.clearAllMocks(); boundary.cache.clear(); boundary.session = createAccountSession('A'); boundary.records.mockResolvedValue([{ id: 'local-a', fileName: 'score.xml', fileData: new ArrayBuffer(3) }]); boundary.upload.mockResolvedValue({ id: 'remote-a', sha256: 'hash', sizeBytes: 3 }); });
describe('explicit local migration', () => {
  it('reuses a persisted idempotency key after failure and preserves the local identity after success', async () => {
    boundary.upload.mockRejectedValueOnce(new Error('offline'));
    await expect(migrateLocalScore('local-a', 'guest-device', 'Title')).rejects.toThrow('offline');
    const first = (await migrationJobs('A'))[0]; expect(first.state).toBe('failed');
    await migrateLocalScore('local-a', 'guest-device', 'Title');
    const saved = (await migrationJobs('A'))[0]; expect(saved).toMatchObject({ state: 'saved', localId: 'local-a', serverId: 'remote-a', idempotencyKey: first.idempotencyKey });
    expect(boundary.upload.mock.calls[0][3]).toBe(boundary.upload.mock.calls[1][3]);
  });
  it('rejects another account local draft before reading bytes or uploading', async () => {
    await expect(migrateLocalScore('local-a', 'account:B', 'Private B')).rejects.toThrow('다른 계정');
    expect(boundary.records).not.toHaveBeenCalled(); expect(boundary.upload).not.toHaveBeenCalled();
  });
  it('creates a new key only for an explicit restart of a saved, confirmed-deleted migration', async () => {
    await migrateLocalScore('local-a', 'guest-device', 'Title'); const first = (await migrationJobs('A'))[0];
    await restartDeletedMigration('A', 'local-a'); await migrateLocalScore('local-a', 'guest-device', 'Title');
    expect(boundary.upload.mock.calls[1][3]).not.toBe(first.idempotencyKey);
    expect((await migrationJobs('A'))[0].localId).toBe('local-a');
  });
  it('does not downgrade a completed mapping when a concurrent failed request finishes late', async () => {
    await migrateLocalScore('local-a', 'guest-device', 'Title'); const saved = (await migrationJobs('A'))[0];
    await saveMigrationJob('A', { ...saved, state: 'failed', serverId: undefined });
    expect((await migrationJobs('A'))[0]).toEqual(saved);
  });
});
