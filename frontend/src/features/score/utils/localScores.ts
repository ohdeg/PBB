import type { ScoreDetail, ScoreSummary } from '../types';
import { AppError } from './appError';

const DB_NAME = 'music-viewer-local-scores';
const STORE_NAME = 'scores';
const DB_VERSION = 1;
export const LOCAL_SCORE_ID_PREFIX = 'local-';

interface LocalScoreRecord {
  id: string;
  userId: string;
  title: string;
  artist: string | null;
  fileName: string;
  mimeType: string;
  fileData: ArrayBuffer;
  createdAt: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new AppError('errors.localDbOpenFailed'));
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = handler(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new AppError('errors.localDbOperationFailed'));

        transaction.oncomplete = () => db.close();
        transaction.onerror = () =>
          reject(transaction.error ?? new AppError('errors.localDbTransactionFailed'));
      }),
  );
}

function toSummary(record: LocalScoreRecord): ScoreSummary {
  return {
    id: record.id,
    title: record.title,
    artist: record.artist,
    createdAt: record.createdAt,
    fileName: record.fileName,
  };
}

function toDetail(record: LocalScoreRecord): ScoreDetail {
  return {
    id: record.id,
    title: record.title,
    artist: record.artist,
    storagePath: '',
    createdAt: record.createdAt,
    fileName: record.fileName,
  };
}

export function isLocalScoreId(scoreId: string): boolean {
  return scoreId.startsWith(LOCAL_SCORE_ID_PREFIX);
}

export async function fetchLocalScores(userId: string): Promise<ScoreSummary[]> {
  const records = await fetchLocalScoreRecords(userId);
  return records.map(toSummary).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function fetchLocalScoreRecords(userId: string): Promise<LocalScoreRecord[]> {
  const records = await runTransaction<LocalScoreRecord[]>('readonly', (store) => {
    const index = store.index('userId');
    return index.getAll(userId);
  });

  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function countLocalScores(userId: string): Promise<number> {
  const scores = await fetchLocalScores(userId);
  return scores.length;
}

async function getLocalScoreRecord(userId: string, scoreId: string): Promise<LocalScoreRecord> {
  const record = await runTransaction<LocalScoreRecord | undefined>('readonly', (store) =>
    store.get(scoreId),
  );

  if (!record || record.userId !== userId) {
    throw new AppError('errors.scoreNotFound');
  }

  return record;
}

export async function fetchLocalScoreDetail(userId: string, scoreId: string): Promise<ScoreDetail> {
  const record = await getLocalScoreRecord(userId, scoreId);
  return toDetail(record);
}

export async function fetchLocalScoreContent(userId: string, scoreId: string): Promise<Blob> {
  const record = await getLocalScoreRecord(userId, scoreId);
  return new Blob([record.fileData], { type: record.mimeType });
}

export async function saveLocalScore(
  userId: string,
  file: File,
  title: string,
  artist?: string,
): Promise<ScoreSummary> {
  const id = `${LOCAL_SCORE_ID_PREFIX}${crypto.randomUUID()}`;
  const fileData = await file.arrayBuffer();
  const record: LocalScoreRecord = {
    id,
    userId,
    title: title.trim(),
    artist: artist?.trim() || null,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    fileData,
    createdAt: new Date().toISOString(),
  };

  await runTransaction('readwrite', (store) => store.put(record));
  return toSummary(record);
}

export async function deleteLocalScore(userId: string, scoreId: string): Promise<void> {
  await getLocalScoreRecord(userId, scoreId);
  await runTransaction('readwrite', (store) => store.delete(scoreId));
}

export async function deleteAllLocalScores(userId: string): Promise<string[]> {
  const scores = await fetchLocalScores(userId);
  const ids = scores.map((score) => score.id);

  for (const id of ids) {
    await runTransaction('readwrite', (store) => store.delete(id));
  }

  return ids;
}
