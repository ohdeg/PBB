import assert from 'node:assert/strict';
import test from 'node:test';
import { getOrCreateGuestUserId } from '../src/features/tempori/utils/libraryUserId.ts';
import { loadTemporiAnnotations, saveTemporiAnnotations } from '../src/features/tempori/utils/temporiAnnotations.ts';
import { isLocalTemporiId } from '../src/features/tempori/utils/localTempori.ts';
import { createTemporiStorageMigration } from '../src/features/tempori/utils/migrateTemporiStorage.ts';
import { getTemporiRedirectTarget } from '../src/features/tempori/utils/legacyTemporiRoute.ts';
import { memoryStorage, memoryIndexedDb } from './storageFixtures.mjs';

test('after migration consumers reuse identity and read/write annotations under Tempori keys', async () => {
  const drawing = { version: 1, strokes: [{ id: 'stroke-1', points: [{ x: 3, y: 8 }] }] };
  globalThis.localStorage = memoryStorage([
    ['tempoflow:guest-user-id', 'guest-existing'],
    ['score-viewer:annotations:local-existing', JSON.stringify(drawing)],
  ]);
  await createTemporiStorageMigration(localStorage, memoryIndexedDb())();
  assert.equal(getOrCreateGuestUserId(), 'guest-existing');
  assert.deepEqual(loadTemporiAnnotations('local-existing'), drawing);
  saveTemporiAnnotations('local-existing', { version: 1, strokes: [] });
  assert.deepEqual(JSON.parse(localStorage.getItem('tempori:annotations:local-existing')), { version: 1, strokes: [] });
  assert.equal(localStorage.getItem('score-viewer:annotations:local-existing'), JSON.stringify(drawing));
});
test('new and existing local IDs both resolve without modifying their values', () => {
  assert.equal(isLocalTemporiId('tempori-abc'), true);
  assert.equal(isLocalTemporiId('local-abc'), true);
  assert.equal(isLocalTemporiId('unrelated-abc'), false);
});
for (const [suffix, search, hash] of [
  ['', '', ''], ['/', '', ''], ['/library', '?q=one%20two', '#item'],
  ['/local-a', '?from=bookmark', '#m4'], ['/local-a%2Fb%20c', '?q=%26', '#a%2Fb'],
]) test(`legacy bookmark preserves raw suffix/query/hash: ${suffix || 'base'}`, () => {
  assert.equal(getTemporiRedirectTarget({ pathname: '/hobbies/score-viewer' + suffix, search, hash }), '/hobbies/tempori' + suffix + search + hash);
});
