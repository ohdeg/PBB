import assert from 'node:assert/strict';
import test from 'node:test';
import { selectPracticeMeasure, canStartPendingPlayback, getResumeMeasureIndex } from '../src/features/tempori/utils/practiceInteraction.ts';

test('ordinary navigation preserves practice range', () => {
  assert.deepEqual(selectPracticeMeasure('seek', null, 7), { seekIndex: 7, selectionStart: null, range: null });
});
test('range selection commits only on the second tap and sorts physical measures', () => {
  assert.deepEqual(selectPracticeMeasure('range', null, 7), { seekIndex: 7, selectionStart: 8, range: null });
  assert.deepEqual(selectPracticeMeasure('range', 8, 2), { seekIndex: 2, selectionStart: null, range: { startMeasure: 3, endMeasure: 8 } });
  assert.deepEqual(selectPracticeMeasure('range', 4, 3).range, { startMeasure: 4, endMeasure: 4 });
});
test('queued play waits for the exact ready revision and rejects stale or failed renders', () => {
  assert.equal(canStartPendingPlayback({ temporiId: 'a', revision: 2 }, 'a', 1, 'ready', true), false);
  assert.equal(canStartPendingPlayback({ temporiId: 'a', revision: 2 }, 'a', 2, 'loading', true), false);
  assert.equal(canStartPendingPlayback({ temporiId: 'a', revision: 2 }, 'a', 2, 'error', true), false);
  assert.equal(canStartPendingPlayback({ temporiId: 'a', revision: 2 }, 'b', 2, 'ready', true), false);
  assert.equal(canStartPendingPlayback({ temporiId: 'a', revision: 2 }, 'a', 2, 'ready', false), false);
  assert.equal(canStartPendingPlayback({ temporiId: 'a', revision: 2 }, 'a', 2, 'ready', true), true);
});
test('seeking outside a range returns playback to its physical start', () => {
  assert.equal(getResumeMeasureIndex(7, 2, 4, false), 2);
  assert.equal(getResumeMeasureIndex(3, 2, 4, false), 3);
  assert.equal(getResumeMeasureIndex(3, 2, 4, true), 2);
});

test('Korean and English practice messages expose the same accessible actions and recovery hints', async () => {
  const { PRACTICE_MESSAGES_KO: ko, PRACTICE_MESSAGES_EN: en } = await import('../src/features/tempori/i18n/messagesPractice.ts');
  for (const section of Object.keys(ko)) {
    assert.deepEqual(Object.keys(ko[section]).sort(), Object.keys(en[section]).sort());
    for (const value of Object.values(ko[section])) assert.equal(typeof value, 'string');
    for (const value of Object.values(en[section])) assert.equal(typeof value, 'string');
  }
  for (const tree of [ko, en]) {
    assert.ok(tree.viewer.retry);
    assert.ok(tree.viewer.selectRangeStart);
    assert.ok(tree.viewer.selectRangeEnd);
    assert.ok(tree.tempori.uploadTitleLabel);
    assert.ok(tree.tempori.renderFailed);
    assert.ok(tree.playback.applyAndPlay);
  }
});
