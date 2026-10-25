import { LEGACY_STORAGE } from '../constants/legacyStorage';
import { TEMPORI_STORAGE } from '../constants/temporiStorage';
import { openTemporiDatabase } from './temporiDatabase';

type LibraryRecord = { id: string; userId: string; [key: string]: unknown };
type LegacySnapshot = { exists: boolean; rows: LibraryRecord[] };

function readLegacyDatabase(factory: IDBFactory, name: string): Promise<LegacySnapshot> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name);
    let absent = false;
    let failed = false;
    request.onupgradeneeded = () => {
      // Opening an absent source must not leave an empty legacy database behind.
      absent = true;
      request.transaction?.abort();
    };
    request.onblocked = () => { failed = true; reject(new Error('Legacy storage is busy')); };
    request.onerror = () => {
      if (absent && !failed) resolve({ exists: false, rows: [] });
      else reject(request.error ?? new Error('Legacy storage could not be opened'));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (failed) { db.close(); return; }
      if (!db.objectStoreNames.contains(LEGACY_STORAGE.store)) {
        db.close(); resolve({ exists: false, rows: [] }); return;
      }
      try {
        const transaction = db.transaction(LEGACY_STORAGE.store, 'readonly');
        const read = transaction.objectStore(LEGACY_STORAGE.store).getAll();
        let rows: LibraryRecord[] = [];
        read.onsuccess = () => { rows = read.result as LibraryRecord[]; };
        transaction.oncomplete = () => { db.close(); resolve({ exists: true, rows }); };
        const fail = () => { db.close(); reject(transaction.error ?? new Error('Legacy storage could not be read')); };
        transaction.onabort = fail;
        transaction.onerror = fail;
      } catch (error) { db.close(); reject(error); }
    };
  });
}

function copyMissingLocalValues(storage: Storage, prefixes: readonly typeof LEGACY_STORAGE.sources[number][], isComplete: () => boolean): void {
  const copy = (source: string, target: string) => {
    if (isComplete()) return;
    const value = storage.getItem(source);
    if (value !== null && storage.getItem(target) === null) storage.setItem(target, value);
  };
  copy(LEGACY_STORAGE.guestUserIdKey, TEMPORI_STORAGE.guestUserIdKey);
  const suffixes = ['last-bpm', 'last-measures-per-line', 'annotation-brush-sizes', 'auto-scroll-mode'];
  for (const source of prefixes) {
    for (const suffix of suffixes) copy(source.prefix + suffix, 'tempori:' + suffix);
    copy(source.prefix + source.guide, TEMPORI_STORAGE.preferences.viewerGuideSeen);
    const annotationKeys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith(source.prefix + 'annotations:')) annotationKeys.push(key);
    }
    for (const key of annotationKeys) copy(key, 'tempori:' + key.slice(source.prefix.length));
  }
}

async function copyMissingRecords(factory: IDBFactory, rows: LibraryRecord[], oldGuest: string | null, currentGuest: string | null, isComplete: () => boolean): Promise<void> {
  if (!rows.length || isComplete()) return;
  const db = await openTemporiDatabase(factory);
  try {
    if (isComplete()) return;
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(TEMPORI_STORAGE.database.store, 'readwrite');
      const store = transaction.objectStore(TEMPORI_STORAGE.database.store);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('Tempori storage migration was aborted'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Tempori storage migration failed'));
      for (const source of rows) {
        if (!source || typeof source.id !== 'string' || typeof source.userId !== 'string') {
          transaction.abort(); return;
        }
        // A single readwrite transaction serializes competing migrations. Existing data wins.
        const read = store.get(source.id);
        read.onsuccess = () => {
          if (isComplete() || read.result !== undefined) return;
          const row = oldGuest && currentGuest && source.userId === oldGuest
            ? { ...source, userId: currentGuest } : source;
          store.add(row);
        };
      }
    });
  } finally { db.close(); }
}

/** Each instance deduplicates concurrent work; failed attempts remain retryable. */
export function createTemporiStorageMigration(storage: Storage, factory: IDBFactory): () => Promise<void> {
  let pending: Promise<void> | undefined;
  const isComplete = () => storage.getItem(TEMPORI_STORAGE.migrationFlag) === '1';
  return () => {
    if (pending) return pending;
    pending = Promise.resolve().then(async () => {
      if (isComplete()) return;
      const currentSource = LEGACY_STORAGE.sources[0];
      const latest = await readLegacyDatabase(factory, currentSource.database);
      if (isComplete()) return;
      const sources: typeof LEGACY_STORAGE.sources[number][] = [currentSource];
      const snapshots = [latest];
      // An established newer snapshot is authoritative, including intentional deletions.
      // The old completion flag was premature, but cannot distinguish failure from deletion.
      if (!latest.exists && storage.getItem(LEGACY_STORAGE.completedFlag) !== '1') {
        sources.push(LEGACY_STORAGE.sources[1]);
        snapshots.push(await readLegacyDatabase(factory, LEGACY_STORAGE.sources[1].database));
        if (isComplete()) return;
      }
      copyMissingLocalValues(storage, sources, isComplete);
      for (const snapshot of snapshots) {
        await copyMissingRecords(factory, snapshot.rows,
          storage.getItem(LEGACY_STORAGE.guestUserIdKey), storage.getItem(TEMPORI_STORAGE.guestUserIdKey), isComplete);
      }
      // Never mark success until every transaction committed and all local writes succeeded.
      storage.setItem(TEMPORI_STORAGE.migrationFlag, '1');
    }).catch((error: unknown) => { pending = undefined; throw error; });
    return pending;
  };
}

let migrate: (() => Promise<void>) | undefined;
export function migrateTemporiStorageOnce(): Promise<void> {
  return Promise.resolve().then(() => {
    migrate ??= createTemporiStorageMigration(window.localStorage, window.indexedDB);
    return migrate();
  });
}
