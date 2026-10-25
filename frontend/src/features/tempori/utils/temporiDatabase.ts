import { TEMPORI_STORAGE } from '../constants/temporiStorage';

/** Reject blocked opens and close handles that may arrive after the rejection. */
export function openTemporiDatabase(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(TEMPORI_STORAGE.database.name, TEMPORI_STORAGE.database.version);
    let failed = false;
    const fail = (error: Error) => { failed = true; reject(error); };
    request.onblocked = () => fail(new Error('Tempori storage is busy'));
    request.onerror = () => fail(request.error ?? new Error('Tempori storage is unavailable'));
    request.onupgradeneeded = () => {
      if (failed) { request.transaction?.abort(); return; }
      const db = request.result;
      const { store, keyPath, userIndex, createdAtIndex } = TEMPORI_STORAGE.database;
      if (!db.objectStoreNames.contains(store)) {
        const records = db.createObjectStore(store, { keyPath });
        records.createIndex(userIndex, userIndex, { unique: false });
        records.createIndex(createdAtIndex, createdAtIndex, { unique: false });
      }
    };
    request.onsuccess = () => {
      if (failed) request.result.close();
      else resolve(request.result);
    };
  });
}
