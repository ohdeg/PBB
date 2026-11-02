// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccountSession } from './cloudSession';
const boundary = vi.hoisted(() => ({ session: null as ReturnType<typeof createAccountSession> | null, cache: new Map<string, unknown>(), jobs: [] as { localId: string; localOwner: string; state: string; serverId?: string }[], hash: vi.fn(), remote: vi.fn(), download: vi.fn(), list: vi.fn(), migrate: vi.fn(), localDetail: vi.fn(), upload: vi.fn(), localSave: vi.fn(), localList: vi.fn() }));
vi.mock('./temporiCloudApi', () => ({ captureCloudSession: () => boundary.session!.capture(), currentAccount: () => boundary.session!.capture().account, cloudScoreDetail: boundary.remote, downloadCloudScore: boundary.download, listCloudScores: boundary.list, scoreHash: boundary.hash, deleteCloudScore: vi.fn() }));
vi.mock('./cloudCache', () => ({ cloudCache: vi.fn(async (key: string, value?: unknown) => { if (value === undefined) return boundary.cache.get(key); if (value === null) boundary.cache.delete(key); else boundary.cache.set(key, value); }) }));
vi.mock('../utils/migrateTemporiStorage', () => ({ migrateTemporiStorageOnce: boundary.migrate }));
vi.mock('./temporiMigration', () => ({ migrationJobs: async () => boundary.jobs, initializeUploadedState: vi.fn(), restartDeletedMigration: vi.fn(), migrateLocalScore: boundary.upload }));
vi.mock('../utils/localTempori', () => ({ isLocalTemporiId: (id: string) => id.startsWith('tempori-'), fetchLocalTemporiItems: boundary.localList, fetchLocalTemporiContent: vi.fn(), fetchLocalTemporiDetail: boundary.localDetail, saveLocalTempori: boundary.localSave, deleteLocalTempori: vi.fn() }));
import { fetchLibraryTemporiItems, fetchTemporiContent, retryTemporiUpload, saveTempori } from './temporiRepository';
import { cloudCache } from './cloudCache';
const score = { id: 'remote-a', title: 'Score A', artist: null, createdAt: '', fileName: 'score.pdf', format: 'pdf', sizeBytes: 3, sha256: 'hash', version: 0 };
beforeEach(() => { vi.clearAllMocks(); boundary.migrate.mockResolvedValue(undefined); boundary.localList.mockResolvedValue([]); boundary.session = createAccountSession('A'); boundary.jobs = []; boundary.cache.clear(); boundary.remote.mockResolvedValue(score); boundary.hash.mockResolvedValue('hash'); boundary.download.mockResolvedValue(new Blob(['abc'])); boundary.list.mockResolvedValue([score]); });
describe('cloud repository account boundaries', () => {
  it('never calls score APIs for a guest save or list', async () => {
    boundary.session!.setAccount(null); boundary.localSave.mockResolvedValue({ id: 'tempori-guest' });
    await saveTempori(new File(['abc'], 'score.xml'), 'Guest', undefined); await fetchLibraryTemporiItems();
    expect(boundary.upload).not.toHaveBeenCalled(); expect(boundary.list).not.toHaveBeenCalled();
  });
  it('shows guest originals while logged in without automatically uploading them', async () => {
    boundary.localList.mockImplementation(async (owner: string) => owner === 'account:A' ? [] : [{ id: 'tempori-guest', title: 'Guest', artist: null, createdAt: '' }]);
    expect(await fetchLibraryTemporiItems()).toMatchObject([{ id: 'remote-a' }, { id: 'tempori-guest', syncState: 'local' }]);
    expect(boundary.upload).not.toHaveBeenCalled();
  });
  it('keeps a valid cache and never downloads identical bytes again', async () => {
    const cached = new Blob(['abc']); boundary.cache.set('blob:A:remote-a', cached);
    expect(await fetchTemporiContent('remote-a')).toBe(cached); expect(boundary.download).not.toHaveBeenCalled();
  });
  it('maps confirmed storage exhaustion to the exact message and never returns memory bytes', async () => {
    vi.mocked(cloudCache).mockImplementationOnce(async () => undefined).mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'));
    await expect(fetchTemporiContent('remote-a')).rejects.toThrow('저장공간이 부족해 다운로드에 실패했습니다');
  });
  it('uses the general download message for network failures', async () => {
    boundary.download.mockRejectedValueOnce(new Error('network'));
    await expect(fetchTemporiContent('remote-a')).rejects.toThrow('오류가 발생하여 다운로드에 실패하였습니다');
  });
  it('keeps failed local drafts visible when the first cloud list fails', async () => {
    boundary.localList.mockResolvedValue([{ id: 'tempori-draft', title: 'Unsent original', artist: null, createdAt: '' }]); boundary.list.mockRejectedValue(new Error('unavailable'));
    expect(await fetchLibraryTemporiItems()).toMatchObject([{ id: 'tempori-draft', syncState: 'failed', serverListUnavailable: true }]);
  });
  it('does not upload an A draft to B when account changes during local-detail retry', async () => {
    let finish!: (value: unknown) => void;
    boundary.localDetail.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const pending = retryTemporiUpload('tempori-draft'); await vi.waitFor(() => expect(boundary.localDetail).toHaveBeenCalled());
    boundary.session!.setAccount('B'); finish({ title: 'Private A', artist: null });
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(boundary.upload).not.toHaveBeenCalled();
  });
  it('captures the initiating account before the initial legacy migration await', async () => {
    let finish!: () => void; boundary.migrate.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = saveTempori(new File(['score'], 'a.xml'), 'A title', undefined);
    boundary.session!.setAccount('B'); finish(); await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(boundary.localSave).not.toHaveBeenCalled();
  });
  it('rejects old cached bytes when account changes during digest', async () => {
    boundary.cache.set('blob:A:remote-a', new Blob(['abc'])); let finish!: (hash: string) => void;
    boundary.hash.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const pending = fetchTemporiContent('remote-a'); await vi.waitFor(() => expect(boundary.hash).toHaveBeenCalled());
    boundary.session!.setAccount('B'); finish('hash'); await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('rejects old downloaded bytes when account changes during cache commit', async () => {
    let commit!: () => void;
    vi.mocked(cloudCache).mockImplementationOnce(async () => undefined).mockImplementationOnce(() => new Promise((resolve) => { commit = () => resolve(undefined); }));
    const pending = fetchTemporiContent('remote-a'); await vi.waitFor(() => expect(boundary.download).toHaveBeenCalled()); await vi.waitFor(() => expect(commit).toBeTypeOf('function'));
    boundary.session!.setAccount('B'); commit(); await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('preserves cached list on online errors and removes only missing remote blobs after successful refresh', async () => {
    boundary.cache.set('list:A', [score]); boundary.cache.set('blob:A:remote-a', new Blob(['abc']));
    boundary.list.mockRejectedValueOnce(new Error('server unavailable'));
    expect(await fetchLibraryTemporiItems()).toMatchObject([{ id: 'remote-a', serverListUnavailable: true }]); expect(boundary.cache.get('list:A')).toEqual([score]);
    boundary.list.mockResolvedValue([]); expect(await fetchLibraryTemporiItems()).toEqual([]); expect(boundary.cache.has('blob:A:remote-a')).toBe(false);
  });
});

it('shows a retained local original after confirmed cloud deletion, but does not misclassify it during a list outage', async () => {
  boundary.jobs = [{ localId: 'tempori-guest', localOwner: 'guest-device', state: 'saved', serverId: 'remote-a' }];
  boundary.localList.mockResolvedValue([{ id: 'tempori-guest', title: 'Guest', artist: null, createdAt: '' }]);
  boundary.cache.set('list:A', [score]); boundary.list.mockRejectedValueOnce(new Error('outage'));
  expect(await fetchLibraryTemporiItems()).toMatchObject([{ id: 'remote-a', syncState: 'saved' }]);
  boundary.list.mockResolvedValue([]); expect(await fetchLibraryTemporiItems()).toMatchObject([{ id: 'tempori-guest', syncState: 'local' }]);
});
