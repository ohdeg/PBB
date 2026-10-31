export function memoryStorage(entries = []) {
  const values = new Map(entries);
  const faults = { key: null };
  return {
    values, faults,
    get length() { return values.size; }, key(i) { return [...values.keys()][i] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { if (faults.key === key) throw new Error('quota'); values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}
// Event-level IndexedDB substitute: asynchronous requests, transactional snapshots,
// aborted writes, and completion after request callbacks. No external dependency.
export function memoryIndexedDb(initial = {}) {
  const databases = new Map(Object.entries(initial).map(([name, stores]) => [name,
    new Map(Object.entries(stores).map(([store, rows]) => [store, new Map(rows.map(row => [row.id, structuredClone(row)]))]))]));
  const faults = { open: null, read: null, write: null, commit: null, blocked: null };
  const closed = [];
  const factory = { databases, faults, closed, open(name) {
    const req = {};
    setImmediate(() => {
      if (faults.open === name) { req.error = new Error('open'); req.onerror?.(); return; }
      const exists = databases.has(name);
      const stores = exists ? databases.get(name) : new Map();
      let aborted = false;
      const db = {
        objectStoreNames: { contains: key => stores.has(key) }, close() { closed.push(name); },
        createObjectStore(key) { stores.set(key, new Map()); return { createIndex() {} }; },
        transaction(key, mode) {
          if (!stores.has(key)) throw new Error('missing store');
          const snapshot = new Map(stores.get(key));
          let pending = 0, ended = false;
          const tx = { error: null, abort() { fail(new Error('abort')); }, objectStore() { return store; } };
          const fail = error => { if (ended) return; ended = true; tx.error = error; tx.onabort?.(); };
          const finish = () => setImmediate(() => {
            if (ended || pending) return;
            if (faults.commit === name && mode === 'readwrite') { fail(new Error('commit')); return; }
            ended = true;
            if (mode === 'readwrite') stores.set(key, snapshot);
            tx.oncomplete?.();
          });
          const request = (action, kind) => {
            const r = {}; pending++;
            setImmediate(() => {
              if (ended) return;
              try {
                if (faults[kind] === name) throw new Error(kind);
                r.result = action(); r.onsuccess?.();
              } catch (error) { r.error = error; r.onerror?.(); fail(error); }
              pending--; finish();
            });
            return r;
          };
          const store = {
            index: field => ({ getAll: value => request(() => structuredClone([...snapshot.values()].filter(row => row[field] === value)), 'read') }),
            delete: id => request(() => { snapshot.delete(id); }, 'write'),
            getAll: () => request(() => structuredClone([...snapshot.values()]), 'read'),
            get: id => request(() => structuredClone(snapshot.get(id)), 'read'),
            put: row => request(() => { snapshot.set(row.id, structuredClone(row)); return row.id; }, 'write'),
            add: row => request(() => { if (snapshot.has(row.id)) throw new Error('collision'); snapshot.set(row.id, structuredClone(row)); return row.id; }, 'write'),
          };
          finish(); return tx;
        },
      };
      req.result = db;
      req.transaction = { abort() { aborted = true; } };
      if (faults.blocked === name) { req.onblocked?.(); setImmediate(() => req.onsuccess?.()); return; }
      if (!exists) req.onupgradeneeded?.();
      if (aborted) { req.error = new Error('aborted upgrade'); req.onerror?.(); return; }
      if (!exists) databases.set(name, stores);
      req.onsuccess?.();
    });
    return req;
  } };
  return factory;
}
export const legacyRow = (id = 'local-existing', userId = 'guest-old') => ({
  id, userId, title: 'My music', artist: null, fileName: 'music.mxl',
  mimeType: 'application/octet-stream', fileData: Uint8Array.from([1, 2, 3]).buffer, createdAt: '2026-01-01',
});
