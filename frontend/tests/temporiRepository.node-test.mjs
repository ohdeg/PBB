import assert from 'node:assert/strict';
import test from 'node:test';
import { saveLocalTempori, deleteLocalTempori, deleteAllLocalTemporiItems } from '../src/features/tempori/utils/localTempori.ts';
import { memoryIndexedDb, memoryStorage, legacyRow } from './storageFixtures.mjs';
const name = 'tempori-local-library';
test('a file save reports failure when its transaction aborts after the put request succeeded', async () => {
  const idb = memoryIndexedDb(); globalThis.indexedDB = idb;
  idb.faults.commit = name;
  await assert.rejects(saveLocalTempori('guest-test', new File(['music'], 'music.mxl'), 'My music'));
  assert.equal(idb.databases.get(name).get('tempori').size, 0);
  assert.ok(idb.closed.includes(name));
});
test('successful file save resolves only after its bytes are committed and connection closed', async () => {
  const idb = memoryIndexedDb(); globalThis.indexedDB = idb;
  const summary = await saveLocalTempori('guest-test', new File(['music'], 'music.mxl'), ' My music ');
  assert.ok(summary.id.startsWith('tempori-'));
  assert.equal(idb.databases.get(name).get('tempori').get(summary.id)?.title, 'My music');
  assert.ok(idb.closed.includes(name));
});

const prepareDeletion = () => {
  const rows = [legacyRow('tempori-a', 'guest-test'), legacyRow('tempori-b', 'guest-test')];
  const idb = memoryIndexedDb({ [name]: { tempori: rows } }); globalThis.indexedDB = idb;
  globalThis.localStorage = memoryStorage(rows.flatMap(({ id }) => [[`tempori:annotations:${id}`, 'wrapped'], [`tempori:annotations:horizontal:${id}`, 'horizontal']]));
  return idb;
};
test('successful deletion cleans both annotation namespaces only for the deleted score', async () => {
  prepareDeletion(); await deleteLocalTempori('guest-test', 'tempori-a');
  assert.equal(localStorage.getItem('tempori:annotations:tempori-a'), null);
  assert.equal(localStorage.getItem('tempori:annotations:horizontal:tempori-a'), null);
  assert.equal(localStorage.getItem('tempori:annotations:tempori-b'), 'wrapped');
});
test('failed DB commit preserves both annotation documents', async () => {
  const idb = prepareDeletion(); idb.faults.commit = name;
  await assert.rejects(deleteLocalTempori('guest-test', 'tempori-a'));
  assert.equal(localStorage.getItem('tempori:annotations:tempori-a'), 'wrapped');
  assert.equal(localStorage.getItem('tempori:annotations:horizontal:tempori-a'), 'horizontal');
});
test('cleanup failure identifies the already-deleted ID and permits cleanup-only retry', async () => {
  const idb = prepareDeletion(); const remove = localStorage.removeItem;
  localStorage.removeItem = key => { if (key.includes(':horizontal:tempori-a')) throw Error('denied'); remove(key); };
  await assert.rejects(deleteLocalTempori('guest-test', 'tempori-a'), error => {
    assert.deepEqual(error.temporiIds, ['tempori-a']); return true;
  });
  assert.equal(idb.databases.get(name).get('tempori').has('tempori-a'), false);
  localStorage.removeItem = remove;
  const { cleanupDeletedTemporiAnnotations } = await import('../src/features/tempori/utils/temporiAnnotations.ts');
  cleanupDeletedTemporiAnnotations(['tempori-a']);
  assert.equal(localStorage.getItem('tempori:annotations:horizontal:tempori-a'), null);
  assert.equal(localStorage.getItem('tempori:annotations:horizontal:tempori-b'), 'horizontal');
});
test('bulk deletion cleans each committed ID and preserves untouched documents after partial cleanup failure', async () => {
  const idb = prepareDeletion(); const remove = localStorage.removeItem;
  localStorage.removeItem = key => { if (key.includes(':horizontal:tempori-a')) throw Error('denied'); remove(key); };
  await assert.rejects(deleteAllLocalTemporiItems('guest-test'));
  assert.equal(idb.databases.get(name).get('tempori').has('tempori-a'), false);
  assert.equal(idb.databases.get(name).get('tempori').has('tempori-b'), true);
  assert.equal(localStorage.getItem('tempori:annotations:horizontal:tempori-b'), 'horizontal');
});
