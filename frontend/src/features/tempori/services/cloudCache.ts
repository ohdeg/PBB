/** Separate database: no schema migration or mutation of legacy local originals. */
export async function cloudCache<T>(key: string, value?: T | null): Promise<T | undefined> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('tempori-account-cache', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const transaction = db.transaction('records', value === undefined ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('records');
      const request = value === undefined ? store.get(key) : value === null ? store.delete(key) : store.put(value, key);
      transaction.oncomplete = () => resolve(value === undefined ? request.result as T | undefined : undefined);
      transaction.onerror = transaction.onabort = () => reject(request.error ?? transaction.error ?? new Error('기기 저장 공간을 확인해 주세요.'));
    });
  } finally { db.close(); }
}

/** A single read/write transaction serializes jobs across tabs, including initial idempotency keys. */
export async function updateCloudCache<T>(key: string, update: (current: T | undefined) => T): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('tempori-account-cache', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction('records', 'readwrite'); const store = transaction.objectStore('records'); let next: T;
      const request = store.get(key);
      request.onsuccess = () => { try { next = update(request.result as T | undefined); store.put(next, key); } catch (error) { transaction.abort(); reject(error); } };
      transaction.oncomplete = () => resolve(next);
      transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error('계정 저장 작업을 기록하지 못했습니다.'));
    });
  } finally { db.close(); }
}
