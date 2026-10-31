import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computePlayheadHighlight,
  createPlayheadHighlightLookup,
  getMeasureHighlightBounds,
  resolveMeasureLayoutsInContainer,
} from '../src/features/tempori/utils/measureTiming.ts';

// OSMD draws separate vf-measure groups with the same id for the two staves.
// These fixtures provide its DOM/rectangle boundary without loading the renderer.
function makeScore({
  lateHeader = null,
  noteClass = 'vf-stavenote',
  notes = true,
  noteWidth = 10,
  scale = 1,
  staffTops = [80, 160],
  firstNoteLefts = [80, 80],
  duplicateOffset = null,
  positions = [[40, 200], [240, 180], [420, 180], [600, 180]],
  containerWidth = 1000,
} = {}) {
  const viewportLeft = 64;
  const viewportTop = 120;
  const rect = (left, top, width, height) => ({
    left: viewportLeft + left * scale,
    top: viewportTop + top * scale,
    right: viewportLeft + (left + width) * scale,
    bottom: viewportTop + (top + height) * scale,
    width: width * scale,
    height: height * scale,
  });
  const element = (classes, bounds, children = [], id = '') => ({
    getAttribute: (name) => name === 'id' ? id : null,
    classList: { contains: (name) => classes.includes(name) },
    getBoundingClientRect: () => bounds,
    querySelectorAll(selector) {
      const selectors = selector.split(',').map((part) => part.trim().replace(/^g/, ''));
      const matches = (child) => selectors.some((part) => part.startsWith('.') && child.classList.contains(part.slice(1)));
      return children.flatMap((child) => [
        ...(matches(child) ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    },
  });
  const symbol = (className, left, top, width = 10) => element([className], rect(left, top, width, 20));
  const groups = [];
  for (const top of staffTops) {
    positions.forEach(([left, width], index) => {
      const children = [element(['vf-stave'], rect(left, top, width, 40))];
      if (index === 0) {
        children.push(symbol('vf-clef', 42, top, 14), symbol('vf-keysignature', 58, top, 6), symbol('vf-timesignature', 66, top, 8));
        if (lateHeader && top === 80) children.push(symbol(lateHeader.className, lateHeader.left, top, lateHeader.width));
      }
      if (notes) {
        children.push(symbol(noteClass, index === 0 ? firstNoteLefts[top === 80 ? 0 : 1] : left + 20, top, noteWidth));
        children.push(symbol('vf-stavenote', index === 0 ? 130 : left + 70, top, noteWidth));
      }
      groups.push(element(['vf-measure'], rect(left, top, width, 40), children, String(index + 1)));
    });
  }
  if (duplicateOffset !== null) {
    const shiftedCopy = (original) => ({
      ...original,
      getBoundingClientRect() {
        const originalRect = original.getBoundingClientRect();
        return { ...originalRect, left: originalRect.left + duplicateOffset, right: originalRect.right + duplicateOffset };
      },
      querySelectorAll: (selector) => original.querySelectorAll(selector).map(shiftedCopy),
    });
    groups.push(shiftedCopy(groups[0]));
  }
  return element([], rect(0, 0, containerWidth, 300), groups);
}

const resolve = (options) => resolveMeasureLayoutsInContainer(makeScore(options), options?.positions?.length ?? 4, 4);

test('a single-staff line retains ordinary opening-header exclusion', () => {
  const [first] = resolve({ staffTops: [80] });
  assert.deepEqual(getMeasureHighlightBounds(first), { leftPx: 80, widthPx: 160 });
  assert.equal(first.heightPx, 40);
});

test('ordinary leading clef, key and time signatures stay outside the grand-staff content wrapper', () => {
  const [first, second] = resolve();
  assert.deepEqual(getMeasureHighlightBounds(first), { leftPx: 80, widthPx: 160 });
  assert.equal(first.topPx, 80);
  assert.equal(first.heightPx, 120);
  assert.equal(first.playheadLeftPx, 80);
  assert.equal(first.playheadWidthPx, 160);
  assert.deepEqual(getMeasureHighlightBounds(second), { leftPx: 240, widthPx: 180 });
});

test('a trailing clef cannot collapse the current first-on-line measure wrapper around itself', () => {
  const layouts = resolve({ lateHeader: { className: 'vf-clef', left: 218, width: 16 } });
  assert.deepEqual(getMeasureHighlightBounds(layouts[0]), { leftPx: 80, widthPx: 160 });
  assert.equal(layouts[0].playheadLeftPx, 80);
  assert.equal(layouts[0].playheadWidthPx, 160);
  const windows = [{ measureIndex: 0, playbackStepIndex: 0, startMs: 0, durationMs: 2000, tempoBpm: 120, beatsPerMeasure: 4, beatType: 4 }];
  const lookup = createPlayheadHighlightLookup(layouts, windows);
  for (const elapsedMs of [0, 500]) {
    const highlight = computePlayheadHighlight(layouts, windows, elapsedMs, lookup);
    assert.equal(highlight.measureLeftPx, 80);
    assert.equal(highlight.measureWidthPx, 160);
    assert.equal(highlight.lineTopPx, 80);
    assert.equal(highlight.lineHeightPx, 120);
  }
  assert.deepEqual(layouts.slice(1).map(getMeasureHighlightBounds), [
    { leftPx: 240, widthPx: 180 },
    { leftPx: 420, widthPx: 180 },
    { leftPx: 600, widthPx: 180 },
  ]);
});

for (const className of ['vf-clefs', 'vf-keysignature', 'vf-timesignature', 'vf-repeat']) {
  test(`a mid-measure ${className} cannot exclude a preceding rest`, () => {
    const [first] = resolve({ noteClass: 'vf-rest', lateHeader: { className, left: 120, width: 10 } });
    assert.deepEqual(getMeasureHighlightBounds(first), { leftPx: 80, widthPx: 160 });
    assert.equal(first.playheadLeftPx, 80);
  });
}

test('missing note rectangles keep the full measure instead of guessing from a trailing clef', () => {
  const [first] = resolve({ notes: false, lateHeader: { className: 'vf-clef', left: 218, width: 16 } });
  assert.deepEqual(getMeasureHighlightBounds(first), { leftPx: 40, widthPx: 200 });
  assert.equal(first.playheadLeftPx, 40);
  assert.equal(first.playheadWidthPx, 200);
});

test('unmeasurable notes also preserve the full measure boundary', () => {
  const [first] = resolve({ noteWidth: 0, lateHeader: { className: 'vf-clef', left: 218, width: 16 } });
  assert.deepEqual(getMeasureHighlightBounds(first), { leftPx: 40, widthPx: 200 });
});

test('fractional mobile scale and viewport offsets preserve content width and grand-staff height', () => {
  const [first, second] = resolve({ scale: 0.625, lateHeader: { className: 'vf-clef', left: 218, width: 16 } });
  assert.deepEqual(getMeasureHighlightBounds(first), { leftPx: 50, widthPx: 100 });
  assert.equal(first.topPx, 50);
  assert.equal(first.heightPx, 75);
  assert.equal(first.playheadLeftPx, 50);
  assert.equal(first.playheadWidthPx, 100);
  assert.deepEqual(getMeasureHighlightBounds(second), { leftPx: 150, widthPx: 112.5 });
});

for (const staffTops of [[80, 160], [160, 80]]) {
  test(`the earliest music across both staves controls the wrapper with DOM order ${staffTops.join(', ')}`, () => {
    const [first] = resolve({ staffTops, firstNoteLefts: [110, 80] });
    assert.deepEqual(getMeasureHighlightBounds(first), { leftPx: 80, widthPx: 160 });
    assert.equal(first.playheadLeftPx, 80);
    assert.equal(first.topPx, 80);
    assert.equal(first.heightPx, 120);
  });
}

test('a disjoint same-ID group cannot expand the selected measure cluster or push its neighbors', () => {
  const layouts = resolve({ staffTops: [80], duplicateOffset: 800 });
  assert.deepEqual(layouts.map(getMeasureHighlightBounds), [
    { leftPx: 80, widthPx: 160 },
    { leftPx: 240, widthPx: 180 },
    { leftPx: 420, widthPx: 180 },
    { leftPx: 600, widthPx: 180 },
  ]);
  assert.equal(layouts[0].playheadLeftPx, 80);
  assert.equal(layouts[0].playheadWidthPx, 160);
});

test('nearby parts in the original selected cluster survive subsequent layout width clamping', () => {
  const [first] = resolve({ staffTops: [80], positions: [[40, 200]], containerWidth: 300, duplicateOffset: 220 });
  assert.equal(first.widthPx, 156);
  assert.deepEqual(getMeasureHighlightBounds(first), { leftPx: 80, widthPx: 380 });
});

test('horizontal layout never fabricates missing measures from a wrapped estimate', () => {
  const container = makeScore({ positions: [[40, 200]], containerWidth: 300 });
  assert.deepEqual(resolveMeasureLayoutsInContainer(container, 300, 4, 'horizontal'), []);
});
