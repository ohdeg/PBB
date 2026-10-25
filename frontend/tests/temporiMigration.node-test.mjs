import assert from 'node:assert/strict';
import test from 'node:test';
import { createTemporiStorageMigration } from '../src/features/tempori/utils/migrateTemporiStorage.ts';
import { memoryStorage, memoryIndexedDb, legacyRow } from './storageFixtures.mjs';
const oldDb = 'score-viewer-local-scores';
const oldestDb = 'music-viewer-local-scores';
const newDb = 'tempori-local-library';
const flag = 'tempori:storage-migrated-v1';
const oldFlag = 'score-viewer:storage-migrated-v1';
const drawing = JSON.stringify({ version: 1, strokes: [{ id: 'pen', points: [{ x: 3, y: 8 }] }] });
const fixture = (entries = [], dbs = {}) => {
  const storage = memoryStorage(entries), idb = memoryIndexedDb(dbs);
  return { storage, idb, migrate: createTemporiStorageMigration(storage, idb) };
};
test('fresh install completes without creating either legacy database', async () => {
  const { storage, idb, migrate } = fixture(); await migrate();
  assert.equal(storage.getItem(flag), '1'); assert.equal(idb.databases.size, 0);
});
test('copies identity, preferences, annotations, bytes and stable IDs while retaining every source', async () => {
  const row = legacyRow();
  const { storage, idb, migrate } = fixture([
    ['tempoflow:guest-user-id', 'guest-old'], ['score-viewer:last-bpm', '75'],
    ['score-viewer:guide:score-viewer-seen', '1'], ['score-viewer:annotations:local-existing', drawing],
  ], { [oldDb]: { scores: [row] } });
  await migrate();
  assert.equal(storage.getItem('tempori:guest-user-id'), 'guest-old');
  assert.equal(storage.getItem('tempori:last-bpm'), '75');
  assert.equal(storage.getItem('tempori:guide:tempori-seen'), '1');
  assert.equal(storage.getItem('tempori:annotations:local-existing'), drawing);
  assert.equal(storage.getItem('score-viewer:annotations:local-existing'), drawing);
  assert.deepEqual(idb.databases.get(newDb).get('tempori').get(row.id), row);
  assert.deepEqual(idb.databases.get(oldDb).get('scores').get(row.id), row);
});
test('existing target values and records win; copied old guest records follow current identity', async () => {
  const existing = { ...legacyRow(), title: 'Newer edit', userId: 'guest-new' };
  const { storage, idb, migrate } = fixture([
    ['tempoflow:guest-user-id', 'guest-old'], ['tempori:guest-user-id', 'guest-new'],
    ['score-viewer:last-bpm', '75'], ['tempori:last-bpm', '99'],
    ['score-viewer:annotations:local-existing', drawing], ['tempori:annotations:local-existing', 'new drawing'],
  ], { [oldDb]: { scores: [legacyRow(), legacyRow('local-other'), legacyRow('local-foreign', 'other-owner')] }, [newDb]: { tempori: [existing] } });
  await migrate();
  const rows = idb.databases.get(newDb).get('tempori');
  assert.deepEqual(rows.get('local-existing'), existing);
  assert.equal(rows.get('local-other').userId, 'guest-new');
  assert.equal(rows.get('local-foreign').userId, 'other-owner');
  assert.equal(storage.getItem('tempori:last-bpm'), '99');
  assert.equal(storage.getItem('tempori:annotations:local-existing'), 'new drawing');
});
test('uses music-viewer fallback only without a newer store and without its old completion flag', async () => {
  const { storage, idb, migrate } = fixture([
    ['music-viewer:last-bpm', '60'], ['music-viewer:guide:music-viewer-seen', '1'],
    ['music-viewer:annotations:local-existing', drawing],
  ], { [oldestDb]: { scores: [legacyRow()] } });
  await migrate();
  assert.equal(storage.getItem('tempori:last-bpm'), '60');
  assert.equal(storage.getItem('tempori:guide:tempori-seen'), '1');
  assert.equal(storage.getItem('tempori:annotations:local-existing'), drawing);
  assert.ok(idb.databases.get(newDb).get('tempori').has('local-existing'));
});
for (const [label, entries, dbs] of [
  ['old flag', [[oldFlag, '1']], {}], ['empty newer store', [], { [oldDb]: { scores: [] } }],
]) test(`${label} prevents resurrecting deleted old rows, annotations and preferences`, async () => {
  const { storage, idb, migrate } = fixture([...entries,
    ['music-viewer:last-bpm', '60'], ['music-viewer:annotations:local-existing', drawing],
  ], { ...dbs, [oldestDb]: { scores: [legacyRow()] } });
  await migrate();
  assert.equal(storage.getItem('tempori:last-bpm'), null);
  assert.equal(storage.getItem('tempori:annotations:local-existing'), null);
  assert.equal(idb.databases.has(newDb), false);
  assert.ok(idb.databases.get(oldestDb).get('scores').has('local-existing'));
});
for (const kind of ['open', 'read', 'write', 'commit', 'blocked']) test(`${kind} failure leaves no completion flag and retries successfully`, async () => {
  const { storage, idb, migrate } = fixture([], { [oldDb]: { scores: [legacyRow()] } });
  idb.faults[kind] = ['open', 'read'].includes(kind) ? oldDb : newDb;
  await assert.rejects(migrate());
  assert.equal(storage.getItem(flag), null);
  await new Promise(setImmediate);
  if (kind === 'blocked') assert.ok(idb.closed.includes(newDb));
  idb.faults[kind] = null; await migrate();
  assert.equal(storage.getItem(flag), '1');
  assert.ok(idb.databases.get(newDb).get('tempori').has('local-existing'));
});
test('flag write failure retries idempotently and never overwrites a subsequent edit', async () => {
  const { storage, idb, migrate } = fixture([], { [oldDb]: { scores: [legacyRow()] } });
  storage.faults.key = flag; await assert.rejects(migrate());
  const row = idb.databases.get(newDb).get('tempori').get('local-existing'); row.title = 'Edited after partial copy';
  storage.faults.key = null; await migrate();
  assert.equal(idb.databases.get(newDb).get('tempori').get(row.id).title, 'Edited after partial copy');
});
test('preference quota failure retries without discarding copied or source preferences', async () => {
  const { storage, migrate } = fixture([['score-viewer:last-bpm', '75']]);
  storage.faults.key = 'tempori:last-bpm'; await assert.rejects(migrate());
  assert.equal(storage.getItem(flag), null);
  storage.faults.key = null; await migrate(); assert.equal(storage.getItem('tempori:last-bpm'), '75');
});
test('concurrent callers share completion and later calls never reimport deleted target data', async () => {
  const { storage, idb, migrate } = fixture([], { [oldDb]: { scores: [legacyRow()] } });
  const a = migrate(), b = migrate(); assert.equal(a, b); await Promise.all([a, b]);
  idb.databases.get(newDb).get('tempori').delete('local-existing');
  await createTemporiStorageMigration(storage, idb)();
  assert.equal(idb.databases.get(newDb).get('tempori').size, 0);
});

function delaySuccessfulOpen(idb, database) {
  let release;
  let reportPaused;
  const paused = new Promise(resolve => { reportPaused = resolve; });
  const factory = { open(name, version) {
    const request = idb.open(name, version);
    if (name === database) {
      let callback;
      Object.defineProperty(request, 'onsuccess', {
        set(value) { callback = value; },
        get() { return () => { release = () => callback?.(); reportPaused(); }; },
      });
    }
    return request;
  } };
  return { factory, paused, resume: () => release() };
}
for (const [label, database] of [['source', oldDb], ['target', newDb]]) {
  test(`independent delayed ${label} migration cannot revive records or drawings deleted after completion`, async () => {
    const storage = memoryStorage([['score-viewer:annotations:local-existing', drawing]]);
    const idb = memoryIndexedDb({ [oldDb]: { scores: [legacyRow()] } });
    const delayed = delaySuccessfulOpen(idb, database);
    const stale = createTemporiStorageMigration(storage, delayed.factory)();
    await delayed.paused;
    await createTemporiStorageMigration(storage, idb)();
    storage.removeItem('tempori:annotations:local-existing');
    idb.databases.get(newDb).get('tempori').delete('local-existing');
    delayed.resume(); await stale;
    assert.equal(storage.getItem('tempori:annotations:local-existing'), null);
    assert.equal(idb.databases.get(newDb).get('tempori').has('local-existing'), false);
    assert.equal(storage.getItem('score-viewer:annotations:local-existing'), drawing);
  });
}
