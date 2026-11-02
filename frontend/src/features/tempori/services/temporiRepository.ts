import { migrateTemporiStorageOnce } from '../utils/migrateTemporiStorage';
import type { TemporiDetail, TemporiSummary } from '../types';
import type { LibraryTemporiItem } from '../types/library';
import { getLocalLibraryUserId } from '../utils/libraryUserId';
import { deleteLocalTempori, fetchLocalTemporiContent, fetchLocalTemporiDetail, fetchLocalTemporiItems, isLocalTemporiId, saveLocalTempori } from '../utils/localTempori';
import { captureCloudSession, currentAccount, cloudScoreDetail, deleteCloudScore, downloadCloudScore, listCloudScores, scoreHash, type CloudScore } from './temporiCloudApi';
import { cloudCache } from './cloudCache';
import { migrateLocalScore, migrationJobs } from './temporiMigration';
import { cleanupDeletedTemporiAnnotations } from '../utils/temporiAnnotations';

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
  const [local, jobs, cachedList] = await Promise.all([fetchLocalTemporiItems(accountOwner(account)), migrationJobs(account), cloudCache<CloudScore[]>(`list:${account}`)]); session.assert();
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
  return [
    ...remote.map((item) => ({ ...item, syncState: 'saved' as const, offline, serverListUnavailable, annotationId: jobs.find((job) => job.serverId === item.id)?.localId })),
    ...drafts.map((item) => ({ ...item, syncState: 'failed' as const, serverListUnavailable })),
  ];
}
export async function fetchTemporiDetail(id: string): Promise<TemporiDetail> {
  const session = captureCloudSession(); await migrateTemporiStorageOnce(); session.assert();
  if (isLocalTemporiId(id)) { const value = await fetchLocalTemporiDetail(await localOwner(id), id); session.assert(); return value; }
  if (!session.account) throw new Error('계정에 로그인해 주세요.');
  let score: CloudScore;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = await cloudCache<CloudScore[]>(`list:${session.account}`); const found = cached?.find((item) => item.id === id);
    if (!found || !await cloudCache(`blob:${session.account}:${id}`)) throw new Error('오프라인에서는 이 기기에 내려받은 악보만 열 수 있습니다.'); score = found;
  } else score = await cloudScoreDetail(id);
  const job = (await migrationJobs(session.account)).find((item) => item.serverId === id); session.assert();
  return { ...score, storagePath: '', annotationId: job?.localId ?? id };
}
export async function fetchTemporiContent(id: string): Promise<Blob> {
  const session = captureCloudSession(); await migrateTemporiStorageOnce(); session.assert();
  if (isLocalTemporiId(id)) { const blob = await fetchLocalTemporiContent(await localOwner(id), id); session.assert(); return blob; }
  if (!session.account) throw new Error('계정에 로그인해 주세요.');
  const key = `blob:${session.account}:${id}`;
  if (typeof navigator !== 'undefined' && !navigator.onLine) { const cached = await cloudCache<Blob>(key); session.assert(); if (cached) return cached; throw new Error('오프라인 원본이 없습니다.'); }
  const detail = await cloudScoreDetail(id); const cached = await cloudCache<Blob>(key); session.assert();
  if (cached && cached.size === detail.sizeBytes && await scoreHash(cached) === detail.sha256) { session.assert(); return cached; }
  const blob = await downloadCloudScore(id); session.assert();
  if (blob.size !== detail.sizeBytes || await scoreHash(blob) !== detail.sha256) throw new Error('원본 검증에 실패했습니다. 다시 내려받아 주세요.');
  session.assert(); await cloudCache(key, blob); session.assert(); return blob;
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
  const result = await migrateLocalScore(id, owner, detail.title, detail.artist ?? undefined); session.assert(); return result;
}
export async function deleteLibraryTempori(item: LibraryTemporiItem): Promise<void> {
  const session = captureCloudSession(); await migrateTemporiStorageOnce(); session.assert();
  if (isLocalTemporiId(item.id)) { await deleteLocalTempori(await localOwner(item.id), item.id); session.assert(); return; }
  if (!session.account) throw new Error('계정에 로그인해 주세요.');
  await deleteCloudScore(item.id); session.assert(); await cloudCache(`blob:${session.account}:${item.id}`, null);
  // A migrated local copy and its annotations survive cloud deletion.
  if (!item.annotationId || item.annotationId === item.id) cleanupDeletedTemporiAnnotations([item.id]);
}
export async function deleteTempori(item: TemporiSummary): Promise<void> { return deleteLibraryTempori(item); }
