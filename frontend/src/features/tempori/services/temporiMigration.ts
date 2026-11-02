import { syncScoreState } from './temporiStateSync';
import { loadScoreState, seedScoreState, type ScoreState } from './temporiStateRepository';
import { mergeLegacyPageState, snapshotLegacyAnnotations } from './legacyAnnotationSnapshot';
import { cloudCache, updateCloudCache } from './cloudCache';
import { captureCloudSession, cloudScoreDetail, scoreHash, uploadCloudScore, type CloudScore } from './temporiCloudApi';
import { fetchLocalTemporiContent, fetchLocalTemporiRecords } from '../utils/localTempori';
import { getLocalLibraryUserId } from '../utils/libraryUserId';

export interface MigrationJob { localId: string; localOwner: string; idempotencyKey: string; title: string; artist?: string; fileName: string; serverId?: string; state: 'pending' | 'failed' | 'saved'; stateSeeded?: boolean; stateSyncPending?: boolean }
export const jobsKey = (account: string) => `jobs:${account}`;
export async function migrationJobs(account: string): Promise<MigrationJob[]> { return await cloudCache<MigrationJob[]>(jobsKey(account)) ?? []; }
export async function localMigrationCandidates() { return fetchLocalTemporiRecords(getLocalLibraryUserId()); }
export async function saveMigrationJob(account: string, job: MigrationJob) {
  await updateCloudCache<MigrationJob[]>(jobsKey(account), (jobs = []) => { const existing = jobs.find((item) => item.localId === job.localId); if (existing?.state === 'saved' && job.state !== 'saved') return jobs; return [...jobs.filter((item) => item.localId !== job.localId), job]; });
}
async function reserveMigrationJob(account: string, proposed: MigrationJob) {
  const jobs = await updateCloudCache<MigrationJob[]>(jobsKey(account), (jobs = []) => jobs.some((item) => item.localId === proposed.localId) ? jobs : [...jobs, proposed]);
  return jobs.find((item) => item.localId === proposed.localId)!;
}
export async function migrateLocalScore(localId: string, localOwner: string, title: string, artist?: string): Promise<CloudScore> {
  const session = captureCloudSession(); const account = session.account;
  if (!account) throw new Error('계정에 저장하려면 로그인해 주세요.');
  if (localOwner !== `account:${account}` && localOwner !== getLocalLibraryUserId()) throw new Error('다른 계정의 기기 원본은 저장할 수 없습니다.');
  const records = await fetchLocalTemporiRecords(localOwner); session.assert();
  const record = records.find((item) => item.id === localId); if (!record) throw new Error('이 기기의 원본을 찾을 수 없습니다.');
  const job = await reserveMigrationJob(account, { localId, localOwner, idempotencyKey: crypto.randomUUID(), title, artist, fileName: record.fileName, state: 'pending' }); session.assert();
  if (job.state === 'saved' && job.serverId) {
    const remote = await cloudScoreDetail(job.serverId); session.assert(); await initializeUploadedState(account, job, remote.sha256).catch(() => {}); session.assert(); return remote;
  }
  try {
    const blob = await fetchLocalTemporiContent(localOwner, localId); session.assert();
    const stateSnapshot = await loadScoreState(localOwner, localId); session.assert();
    const legacySnapshot = snapshotLegacyAnnotations(localId);
    await updateCloudCache<{ state: ScoreState; legacy: Record<string, string> }>(`state-seed:${account}:${job.idempotencyKey}`, (existing) => { session.assert(); return existing ?? { state: stateSnapshot, legacy: legacySnapshot }; }); session.assert();
    const remote = await uploadCloudScore(new File([blob], job.fileName, { type: blob.type }), job.title, job.artist, job.idempotencyKey); session.assert();
    if (remote.sizeBytes !== blob.size || remote.sha256 !== await scoreHash(blob)) throw new Error('원본 확인에 실패했습니다. 이 기기의 파일은 유지됩니다.');
    session.assert(); await saveMigrationJob(account, { ...job, serverId: remote.id, state: 'saved', stateSyncPending: true });
    await cloudCache(`blob:${account}:${remote.id}`, { blob, detail: remote }).catch(() => {}); session.assert();
    await initializeUploadedState(account, { ...job, serverId: remote.id, state: 'saved' }, remote.sha256).catch(() => {}); session.assert(); return remote;
  } catch (error) {
    await saveMigrationJob(account, { ...job, state: 'failed' }); throw error;
  }
}

/** Only called after a successful account listing confirms deletion and the user selects this local original again. */
export async function restartDeletedMigration(account: string, localId: string) {
  const session = captureCloudSession(); if (session.account !== account) throw new DOMException('Account changed', 'AbortError');
  await updateCloudCache<MigrationJob[]>(jobsKey(account), (jobs = []) => { session.assert(); return jobs.map((job) => job.localId === localId && job.state === 'saved' ? { ...job, idempotencyKey: crypto.randomUUID(), serverId: undefined, state: 'pending', stateSeeded: false, stateSyncPending: false } : job); });
  session.assert();
}

/** Independent marker: original success must not be retried when only state seeding failed. */
export async function initializeUploadedState(account: string, job: MigrationJob, originalHash?: string) {
  if (!job.serverId) return;
  const session = captureCloudSession(); if (session.account !== account) throw new DOMException('Account changed', 'AbortError');
  if (!job.stateSeeded) {
    const captured = await cloudCache<{ state: ScoreState; legacy: Record<string, string> }>(`state-seed:${account}:${job.idempotencyKey}`); session.assert();
    const snapshot = captured?.legacy ?? snapshotLegacyAnnotations(job.localId);
    await updateCloudCache<Record<string, string>>(`legacy-fork:${account}:${job.serverId}`, (existing) => { session.assert(); return existing ?? snapshot; }); session.assert();
    const hash = originalHash ?? (await cloudScoreDetail(job.serverId)).sha256; session.assert();
    const sourceState = captured?.state ?? await loadScoreState(job.localOwner, job.localId); session.assert();
    const migrated = await mergeLegacyPageState(sourceState, snapshot, job.localId, hash); session.assert();
    await seedScoreState(job.localOwner, job.localId, `account:${account}`, job.serverId, migrated); session.assert();
    await saveMigrationJob(account, { ...job, stateSeeded: true, stateSyncPending: true }); session.assert();
  }
  const pending = await loadScoreState(`account:${account}`, job.serverId); session.assert();
  const keys = Object.entries(pending.documents).filter(([, doc]) => doc.dirty || doc.inFlight).map(([key]) => key);
  if (keys.length) {
    const hash = originalHash ?? (await cloudScoreDetail(job.serverId)).sha256; session.assert();
    try { await syncScoreState({ owner: `account:${account}`, accountId: account, scoreId: job.serverId, originalHash: hash }, keys); } catch { session.assert(); }
  }
  const state = await loadScoreState(`account:${account}`, job.serverId); session.assert();
  await saveMigrationJob(account, { ...job, stateSeeded: true, stateSyncPending: Object.values(state.documents).some((doc) => doc.dirty || !!doc.conflict || !!doc.error) }); session.assert();
}
