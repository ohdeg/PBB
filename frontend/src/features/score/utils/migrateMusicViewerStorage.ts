/**
 * music-viewer:* → score-viewer:* 로컬 키 이전 (1회).
 * IndexedDB도 새 이름으로 복사 시도.
 */
const LOCAL_PREFIX_OLD = 'music-viewer:';
const LOCAL_PREFIX_NEW = 'score-viewer:';
const MIGRATION_FLAG = 'score-viewer:storage-migrated-v1';

const IDB_OLD = 'music-viewer-local-scores';
const IDB_NEW = 'score-viewer-local-scores';
const IDB_STORE = 'scores';

export function migrateMusicViewerStorageOnce(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (window.localStorage.getItem(MIGRATION_FLAG) === '1') {
      return;
    }
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(LOCAL_PREFIX_OLD)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      const next = LOCAL_PREFIX_NEW + key.slice(LOCAL_PREFIX_OLD.length);
      if (window.localStorage.getItem(next) === null) {
        window.localStorage.setItem(next, window.localStorage.getItem(key) ?? '');
      }
    }
    window.localStorage.setItem(MIGRATION_FLAG, '1');
  } catch {
    // ignore quota / private mode
  }

  void migrateIndexedDb().catch(() => {
    // best-effort
  });
}

function migrateIndexedDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const openOld = indexedDB.open(IDB_OLD);
    openOld.onerror = () => resolve();
    openOld.onsuccess = () => {
      const oldDb = openOld.result;
      if (!oldDb.objectStoreNames.contains(IDB_STORE)) {
        oldDb.close();
        resolve();
        return;
      }
      const readTx = oldDb.transaction(IDB_STORE, 'readonly');
      const readReq = readTx.objectStore(IDB_STORE).getAll();
      readReq.onerror = () => {
        oldDb.close();
        resolve();
      };
      readReq.onsuccess = () => {
        const rows = readReq.result as unknown[];
        oldDb.close();
        if (!rows.length) {
          resolve();
          return;
        }
        const openNew = indexedDB.open(IDB_NEW, 1);
        openNew.onupgradeneeded = () => {
          const db = openNew.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            const store = db.createObjectStore(IDB_STORE, { keyPath: 'id' });
            store.createIndex('userId', 'userId', { unique: false });
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }
        };
        openNew.onerror = () => reject(openNew.error ?? new Error('idb open failed'));
        openNew.onsuccess = () => {
          const newDb = openNew.result;
          const writeTx = newDb.transaction(IDB_STORE, 'readwrite');
          const store = writeTx.objectStore(IDB_STORE);
          for (const row of rows) {
            store.put(row);
          }
          writeTx.oncomplete = () => {
            newDb.close();
            resolve();
          };
          writeTx.onerror = () => {
            newDb.close();
            reject(writeTx.error ?? new Error('idb write failed'));
          };
        };
      };
    };
  });
}
