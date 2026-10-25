import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { getNavHobbies } from '../src/data/hobbies.ts';
import {
  readRecentAppIds, recordRecentApp, getVisibleRecentApps, findVisitedApp,
} from '../src/features/home/homeRecentStorage.ts';

let values;
beforeEach(() => {
  values = new Map();
  globalThis.window = { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  } };
});

test('public and DEV catalogs preserve access and order', () => {
  assert.deepEqual(getNavHobbies(false).map(a => a.id), ['veveno', 'sranko', 'tempori']);
  assert.deepEqual(getNavHobbies(true).map(a => a.id), ['veveno', 'sranko', 'tempori', '6pick', 'dieta']);
});

test('recording promotes a repeated app without duplicates and isolates accounts', () => {
  recordRecentApp('A', 'veveno');
  recordRecentApp('A', 'tempori');
  recordRecentApp('A', 'veveno');
  recordRecentApp('B', 'sranko');
  assert.deepEqual(readRecentAppIds('A'), ['veveno', 'tempori']);
  assert.deepEqual(readRecentAppIds('B'), ['sranko']);
  assert.deepEqual(JSON.parse(values.get('pbb:recent-apps:v1:A')), { version: 1, appIds: ['veveno', 'tempori'] });
});

test('keeps the twenty most recent app IDs and handles encoded account identifiers', () => {
  for (let i = 0; i < 25; i++) recordRecentApp('a/b', `app-${i}`);
  const ids = readRecentAppIds('a/b');
  assert.equal(ids.length, 20);
  assert.equal(ids[0], 'app-24');
  assert.equal(ids[19], 'app-5');
  assert.equal(values.has('pbb:recent-apps:v1:a%2Fb'), true);
});

test('invalid storage formats are ignored without crashing', () => {
  for (const value of ['{', 'null', '[]', '{"version":2,"appIds":[]}', '{"version":1,"appIds":"veveno"}', '{"version":1,"appIds":[42]}']) {
    values.set('pbb:recent-apps:v1:A', value);
    assert.deepEqual(readRecentAppIds('A'), []);
  }
});

test('normalizes duplicates and rejects empty IDs from stored records', () => {
  values.set('pbb:recent-apps:v1:A', JSON.stringify({ version: 1, appIds: ['tempori', 'tempori', '', 'veveno'] }));
  assert.deepEqual(readRecentAppIds('A'), ['tempori', 'veveno']);
  assert.deepEqual(recordRecentApp('', 'veveno'), []);
  assert.deepEqual(recordRecentApp('A', ''), ['tempori', 'veveno']);
});

test('blocked reads and writes do not prevent navigation', () => {
  Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  assert.deepEqual(readRecentAppIds('A'), []);
  assert.doesNotThrow(() => recordRecentApp('A', 'veveno'));
});

test('quota failure leaves the readable previous record intact', () => {
  recordRecentApp('A', 'tempori');
  window.localStorage.setItem = () => { throw new Error('quota'); };
  assert.doesNotThrow(() => recordRecentApp('A', 'veveno'));
  assert.deepEqual(readRecentAppIds('A'), ['tempori']);
});

test('recent shortcuts filter current permissions before limiting and deduplicate', () => {
  const ids = ['6pick', 'removed-app', 'tempori', 'tempori', 'sranko', 'veveno'];
  assert.deepEqual(getVisibleRecentApps(ids, getNavHobbies(false)).map(a => a.id), ['tempori', 'sranko']);
  assert.deepEqual(getVisibleRecentApps(ids, getNavHobbies(true)).map(a => a.id), ['6pick', 'tempori']);
  assert.deepEqual(getVisibleRecentApps(ids, [], 2), []);
  assert.deepEqual(getVisibleRecentApps(ids, getNavHobbies(true), 0), []);
});

test('tracking matches executable route boundaries, not introductions or denied apps', () => {
  for (const [path, expected] of [
    ['/hobbies/veveno', undefined],
    ['/hobbies/veveno/hub', 'veveno'],
    ['/hobbies/veveno/hub/today', undefined],
    ['/hobbies/veveno/hub-other', undefined],
    ['/hobbies/tempori/library/', 'tempori'],
    ['/hobbies/veveno/stores/42', 'veveno'],
    ['/hobbies/veveno/pos/store/42/tools', 'veveno'],
    ['/hobbies/sranko/looks', 'sranko'],
    ['/hobbies/sranko/community/42', 'sranko'],
    ['/hobbies/tempori/score-123', 'tempori'],
    ['/hobbies/tempori/score-123/unknown', undefined],
    ['/hobbies/6pick/play', undefined],
    ['/', undefined],
  ]) assert.equal(findVisitedApp(path, getNavHobbies(false))?.id, expected, path);
});

test('apps without a separate executable route do not count landing visits', () => {
  const app = { ...getNavHobbies(false)[0], startPath: undefined, usagePaths: undefined };
  assert.equal(findVisitedApp('/hobbies/veveno', [app]), undefined);
});

test('DEV-only deep links only record for the permitted catalog', () => {
  assert.equal(findVisitedApp('/hobbies/dieta/meals', getNavHobbies(true))?.id, 'dieta');
  assert.equal(findVisitedApp('/hobbies/dieta/meals', getNavHobbies(false)), undefined);
  assert.equal(findVisitedApp('/hobbies/dieta/missing', getNavHobbies(true)), undefined);
});

test('static route segments follow React Router case-insensitive matching', () => {
  assert.equal(findVisitedApp('/HOBBIES/VEVENO/HUB', getNavHobbies(false))?.id, 'veveno');
  assert.equal(findVisitedApp('/HOBBIES/VEVENO', getNavHobbies(false)), undefined);
});
