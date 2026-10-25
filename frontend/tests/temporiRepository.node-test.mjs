import assert from 'node:assert/strict';
import test from 'node:test';
import { saveLocalTempori } from '../src/features/tempori/utils/localTempori.ts';
import { memoryIndexedDb } from './storageFixtures.mjs';
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
