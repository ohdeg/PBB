import { cleanupDeletedTemporiAnnotations } from './temporiAnnotations';
import { LEGACY_STORAGE } from '../constants/legacyStorage';
import { openTemporiDatabase } from './temporiDatabase';
import { TEMPORI_STORAGE } from '../constants/temporiStorage';
import type { TemporiDetail, TemporiSummary } from '../types';
import { AppError } from './appError';

const STORE_NAME = TEMPORI_STORAGE.database.store;
export const LOCAL_TEMPORI_ID_PREFIX = TEMPORI_STORAGE.database.localIdPrefix;

interface LocalTemporiRecord {
  id: string;
  userId: string;
  title: string;
  artist: string | null;
  fileName: string;
  mimeType: string;
  fileData: ArrayBuffer;
  createdAt: string;
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openTemporiDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      let request: IDBRequest<T>;
      transaction.oncomplete = () => resolve(request.result);
      const fail = () => reject(transaction.error ?? new AppError('errors.localDbTransactionFailed'));
      transaction.onabort = fail;
      transaction.onerror = fail;
      try {
        request = handler(transaction.objectStore(STORE_NAME));
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  } finally {
    db.close();
  }
}

function toSummary(record: LocalTemporiRecord): TemporiSummary {
  return {
    id: record.id,
    title: record.title,
    artist: record.artist,
    createdAt: record.createdAt,
    fileName: record.fileName,
  };
}

function toDetail(record: LocalTemporiRecord): TemporiDetail {
  return {
    id: record.id,
    title: record.title,
    artist: record.artist,
    storagePath: '',
    createdAt: record.createdAt,
    fileName: record.fileName,
  };
}

export function isLocalTemporiId(temporiId: string): boolean {
  return temporiId.startsWith(LOCAL_TEMPORI_ID_PREFIX) || temporiId.startsWith(LEGACY_STORAGE.localIdPrefix);
}

export async function fetchLocalTemporiItems(userId: string): Promise<TemporiSummary[]> {
  const records = await fetchLocalTemporiRecords(userId);
  return records.map(toSummary).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function fetchLocalTemporiRecords(userId: string): Promise<LocalTemporiRecord[]> {
  const records = await runTransaction<LocalTemporiRecord[]>('readonly', (store) => {
    const index = store.index(TEMPORI_STORAGE.database.userIndex);
    return index.getAll(userId);
  });

  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function countLocalTemporiItems(userId: string): Promise<number> {
  const temporiItems = await fetchLocalTemporiItems(userId);
  return temporiItems.length;
}

async function getLocalTemporiRecord(userId: string, temporiId: string): Promise<LocalTemporiRecord> {
  const record = await runTransaction<LocalTemporiRecord | undefined>('readonly', (store) =>
    store.get(temporiId),
  );

  if (!record || record.userId !== userId) {
    throw new AppError('errors.temporiNotFound');
  }

  return record;
}

export async function fetchLocalTemporiDetail(userId: string, temporiId: string): Promise<TemporiDetail> {
  const record = await getLocalTemporiRecord(userId, temporiId);
  return toDetail(record);
}

export async function fetchLocalTemporiContent(userId: string, temporiId: string): Promise<Blob> {
  const record = await getLocalTemporiRecord(userId, temporiId);
  return new Blob([record.fileData], { type: record.mimeType });
}

export async function saveLocalTempori(
  userId: string,
  file: File,
  title: string,
  artist?: string,
): Promise<TemporiSummary> {
  const id = `${LOCAL_TEMPORI_ID_PREFIX}${crypto.randomUUID()}`;
  const fileData = await file.arrayBuffer();
  const record: LocalTemporiRecord = {
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

export async function deleteLocalTempori(userId: string, temporiId: string): Promise<void> {
  await getLocalTemporiRecord(userId, temporiId);
  await runTransaction('readwrite', (store) => store.delete(temporiId));
  cleanupDeletedTemporiAnnotations([temporiId]);
}

export async function deleteAllLocalTemporiItems(userId: string): Promise<string[]> {
  const temporiItems = await fetchLocalTemporiItems(userId);
  const ids = temporiItems.map((tempori) => tempori.id);

  for (const id of ids) {
    await deleteLocalTempori(userId, id);
  }

  return ids;
}
