import { deleteScoreState } from './temporiStateRepository';
import { migrateTemporiStorageOnce } from '../utils/migrateTemporiStorage';
import type { TemporiDetail, TemporiSummary } from '../types';
import type { LibraryTemporiItem } from '../types/library';
import { getLocalLibraryUserId } from '../utils/libraryUserId';
import { deleteLocalTempori, fetchLocalTemporiContent, fetchLocalTemporiDetail, fetchLocalTemporiItems, isLocalTemporiId, saveLocalTempori } from '../utils/localTempori';
import { captureCloudSession, currentAccount, cloudScoreDetail, deleteCloudScore, downloadCloudScore, listCloudScores, scoreHash, type CloudScore } from './temporiCloudApi';
import { cloudCache } from './cloudCache';
import { initializeUploadedState, migrateLocalScore, migrationJobs, restartDeletedMigration } from './temporiMigration';
import { cleanupDeletedTemporiAnnotations } from '../utils/temporiAnnotations';

interface CachedOriginal { blob: Blob; detail: CloudScore }
const originalBlob = (value: Blob | CachedOriginal | undefined) => value instanceof Blob ? value : value?.blob;
const canUseCachedMetadata = (error: unknown) => { const status = (error as { response?: { status?: number } })?.response?.status; return status === undefined || status >= 500; };
async function availableDetail(id: string, account: string): Promise<CloudScore> {
  try { if (typeof navigator === 'undefined' || navigator.onLine) return await cloudScoreDetail(id); }
  catch (error) { if (!canUseCachedMetadata(error)) throw error; }
  const cached = await cloudCache<Blob | CachedOriginal>(`blob:${account}:${id}`);
  if (cached && !(cached instanceof Blob)) return cached.detail;
  const list = await cloudCache<CloudScore[]>(`list:${account}`); const found = list?.find((score) => score.id === id);
  if (found && originalBlob(cached)) return found;
  throw new Error('오류가 발생하여 다운로드에 실패하였습니다');
}
const accountOwner = (account: string) => `account:${account}`;
async function localOwner(id: string): Promise<string> {
  const account = currentAccount();
  if (account) {
    const jobs = await migrationJobs(account); const job = jobs.find((item) => item.localId === id);
    if (job) return job.localOwner;
    const own = await fetchLocalTemporiItems(accountOwner(account));
    if (own.some((item) => item.id === id)) return accountOwner(account);
  }
  return getLocalLibraryUserId();
}
export async function fetchLibraryTemporiItems(): Promise<LibraryTemporiItem[]> {
  const session = captureCloudSession(); await migrateTemporiStorageOnce(); session.assert(); const account = session.account;
  if (!account) return (await fetchLocalTemporiItems(getLocalLibraryUserId())).map((item) => ({ ...item, syncState: 'local' }));
  const [ownLocal, guestLocal, jobs, cachedList] = await Promise.all([fetchLocalTemporiItems(accountOwner(account)), fetchLocalTemporiItems(getLocalLibraryUserId()), migrationJobs(account), cloudCache<CloudScore[]>(`list:${account}`)]); session.assert();
  const local = [...new Map([...ownLocal, ...guestLocal].map((item) => [item.id, item])).values()];
  const drafts = local.filter((item) => !jobs.some((job) => job.localId === item.id && job.state === 'saved'));
  let remote: CloudScore[]; let offline = false; let serverListUnavailable = false;
  try {
    remote = await listCloudScores(); session.assert();
    const previous = await cloudCache<CloudScore[]>(`list:${account}`) ?? [];
    for (const deleted of previous.filter((item) => !remote.some((score) => score.id === item.id))) await cloudCache(`blob:${account}:${deleted.id}`, null);
    await cloudCache(`list:${account}`, remote);
  } catch (error) {
    session.assert();
    if (!cachedList?.length && !drafts.length) throw error;
    remote = cachedList ?? []; offline = typeof navigator !== 'undefined' && !navigator.onLine;
    serverListUnavailable = true;
  }
  session.assert();
  if (!serverListUnavailable) for (const job of jobs.filter((job) => job.state === 'saved' && (!job.stateSeeded || job.stateSyncPending))) {
    const score = remote.find((item) => item.id === job.serverId);
    if (score) { try { await initializeUploadedState(account, job, score.sha256); } catch { session.assert(); } }
  }
  session.assert();
  const refreshedJobs = await migrationJobs(account); session.assert();
  return [
    ...remote.map((item) => ({ ...item, syncState: 'saved' as const, stateSyncPending: refreshedJobs.find((job) => job.serverId === item.id)?.stateSyncPending, offline, serverListUnavailable, annotationId: jobs.find((job) => job.serverId === item.id)?.localId })),
    ...local.filter((item) => !jobs.some((job) => job.localId === item.id && job.state === 'saved' && (serverListUnavailable || remote.some((score) => score.id === job.serverId)))).map((item) => ({ ...item, syncState: (jobs.find((job) => job.localId === item.id)?.state === 'saved' ? 'local' : jobs.find((job) => job.localId === item.id)?.state === 'failed' || ownLocal.some((own) => own.id === item.id) ? 'failed' : 'local') as 'failed' | 'local', serverListUnavailable })),
  ];
}
export async function fetchTemporiDetail(id: string): Promise<TemporiDetail> {
  const session = captureCloudSession(); await migrateTemporiStorageOnce(); session.assert();
  if (isLocalTemporiId(id)) { const value = await fetchLocalTemporiDetail(await localOwner(id), id); session.assert(); return value; }
  if (!session.account) throw new Error('계정에 로그인해 주세요.');
  const score = await availableDetail(id, session.account); session.assert();
  const job = (await migrationJobs(session.account)).find((item) => item.serverId === id); session.assert();
  return { ...score, storagePath: '', annotationId: job?.localId ?? id };
}
export async function fetchTemporiContent(id: string): Promise<Blob> {
  const session = captureCloudSession(); await migrateTemporiStorageOnce(); session.assert();
  if (isLocalTemporiId(id)) { const blob = await fetchLocalTemporiContent(await localOwner(id), id); session.assert(); return blob; }
  if (!session.account) throw new Error('계정에 로그인해 주세요.');
  try {
    const key = `blob:${session.account}:${id}`;
    const detail = await availableDetail(id, session.account); const cached = originalBlob(await cloudCache<Blob | CachedOriginal>(key)); session.assert();
    if (cached && cached.size === detail.sizeBytes && await scoreHash(cached) === detail.sha256) { session.assert(); return cached; }
    const blob = await downloadCloudScore(id); session.assert();
    if (blob.size !== detail.sizeBytes || await scoreHash(blob) !== detail.sha256) throw new Error('Original integrity check failed');
    // The blob record is the completion marker: one atomic IDB transaction, never a memory fallback.
    session.assert(); await cloudCache(key, { blob, detail }); session.assert(); return blob;
  } catch (error) {
    session.assert();
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error(error instanceof DOMException && error.name === 'QuotaExceededError'
      ? '저장공간이 부족해 다운로드에 실패했습니다' : '오류가 발생하여 다운로드에 실패하였습니다');
  }
}
export async function saveTempori(file: File, title: string, artist: string | undefined): Promise<TemporiSummary> {
  const session = captureCloudSession(); await migrateTemporiStorageOnce(); session.assert(); const account = session.account;
  const owner = account ? accountOwner(account) : getLocalLibraryUserId();
  const local = await saveLocalTempori(owner, file, title, artist); session.assert();
  if (!account) return { ...local, syncState: 'local' };
  try { const remote = await migrateLocalScore(local.id, owner, title, artist); return { ...remote, syncState: 'saved', annotationId: local.id }; }
  catch { session.assert(); return { ...local, syncState: 'failed' }; }
}
export async function retryTemporiUpload(id: string) {
  const session = captureCloudSession(); const owner = await localOwner(id); session.assert();
  const detail = await fetchLocalTemporiDetail(owner, id); session.assert();
  if (session.account) {
    const job = (await migrationJobs(session.account)).find((job) => job.localId === id); session.assert();
    if (job?.state === 'saved' && job.serverId) { try { await cloudScoreDetail(job.serverId); session.assert(); } catch (failure) { session.assert(); if ((failure as { response?: { status?: number } }).response?.status !== 404) throw failure; await restartDeletedMigration(session.account, id); session.assert(); } }
  }
  const result = await migrateLocalScore(id, owner, detail.title, detail.artist ?? undefined); session.assert(); return result;
}
export async function deleteLibraryTempori(item: LibraryTemporiItem): Promise<void> {
  const session = captureCloudSession(); await migrateTemporiStorageOnce(); session.assert();
  if (isLocalTemporiId(item.id)) { const owner = await localOwner(item.id); session.assert(); await deleteLocalTempori(owner, item.id); session.assert(); await deleteScoreState(owner, item.id); session.assert(); return; }
  if (!session.account) throw new Error('계정에 로그인해 주세요.');
  await deleteCloudScore(item.id); session.assert(); await cloudCache(`blob:${session.account}:${item.id}`, null); await deleteScoreState(accountOwner(session.account), item.id); session.assert();
  // A migrated local copy and its annotations survive cloud deletion.
  if (!item.annotationId || item.annotationId === item.id) cleanupDeletedTemporiAnnotations([item.id]);
}
export async function deleteTempori(item: TemporiSummary): Promise<void> { return deleteLibraryTempori(item); }

export async function temporiStateIdentity(id: string, originalHash: string) {
  const session = captureCloudSession();
  const owner = isLocalTemporiId(id) ? await localOwner(id) : `account:${session.account}`; session.assert();
  let initializationError: string | undefined;
  if (!isLocalTemporiId(id) && session.account) { const job = (await migrationJobs(session.account)).find((job) => job.serverId === id); session.assert(); if (job) { try { await initializeUploadedState(session.account, job, originalHash); } catch { session.assert(); initializationError = '원본은 준비되었지만 이전 기기 상태의 복사를 마치지 못했습니다. 보관함에서 다시 열어 재시도해 주세요.'; } } session.assert(); }
  return { owner, scoreId: id, originalHash, accountId: session.account, initializationError };
}
