import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTemporiScoreSurface, isTemporiViewerPath } from '../src/features/tempori/utils/focusMode.ts';
import { getScoreViewport, setScoreDockBounds } from '../src/features/tempori/utils/scoreViewport.ts';
import { getAnchoredScrollTop, resetScrollAnchorCache, scrollToAnchoredMeasure } from '../src/features/tempori/utils/scrollAnchor.ts';

test('only an exact Tempori score route enters focus mode', () => {
  for (const path of ['/hobbies/tempori/local-1', '/hobbies/tempori/12/', '/HOBBIES/TEMPORI/12']) {
    assert.equal(isTemporiViewerPath(path), true, path);
  }
  for (const path of ['/', '/hobbies/tempori', '/hobbies/tempori/', '/hobbies/tempori/library', '/hobbies/tempori/library/', '/hobbies/tempori/LIBRARY', '/hobbies/tempori/lib%72ary', '/hobbies/tempori/12/edit', '/hobbies/veveno/12', '/hobbies/tempo/12']) {
    assert.equal(isTemporiViewerPath(path), false, path);
  }
});

function surfaceDocument(colors = []) {
  const classes = new Set();
  const makeMeta = (content) => {
    const attributes = new Map(content === null ? [] : [['content', content]]);
    const meta = {
      getAttribute: (name) => attributes.get(name) ?? null,
      setAttribute: (name, value) => attributes.set(name, value),
      removeAttribute: (name) => attributes.delete(name),
      remove: () => { metas.splice(metas.indexOf(meta), 1); },
    };
    return meta;
  };
  const metas = colors.map(makeMeta);
  return {
    metas,
    documentElement: {
      style: { colorScheme: 'dark' },
      dataset: { theme: 'dark' },
      classList: { contains: (name) => classes.has(name), add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
    },
    querySelectorAll: () => metas,
    createElement: () => makeMeta(null),
    head: { append: (meta) => metas.push(meta) },
  };
}

test('score paper surface restores every browser theme hint and preserves saved theme', () => {
  const doc = surfaceDocument(['#111111', null, '#222222']);
  const cleanup = applyTemporiScoreSurface(doc);
  assert.equal(doc.documentElement.classList.contains('tempori-score-mode'), true);
  assert.equal(doc.documentElement.style.colorScheme, 'light');
  assert.equal(doc.documentElement.dataset.theme, 'dark');
  assert.deepEqual(doc.metas.map((meta) => meta.getAttribute('content')), ['#ffffff', '#ffffff', '#ffffff']);
  cleanup();
  assert.equal(doc.documentElement.classList.contains('tempori-score-mode'), false);
  assert.equal(doc.documentElement.style.colorScheme, 'dark');
  assert.deepEqual(doc.metas.map((meta) => meta.getAttribute('content')), ['#111111', null, '#222222']);
});

test('a browser theme hint created for the score is removed when leaving', () => {
  const doc = surfaceDocument();
  const cleanup = applyTemporiScoreSurface(doc);
  assert.equal(doc.metas.length, 1);
  assert.equal(doc.metas[0].getAttribute('content'), '#ffffff');
  cleanup();
  assert.equal(doc.metas.length, 0);
});

test('cleanup preserves theme hints updated by another owner while the viewer was open', () => {
  const doc = surfaceDocument(['#111111']);
  const cleanup = applyTemporiScoreSurface(doc);
  doc.documentElement.style.colorScheme = 'dark';
  doc.metas[0].setAttribute('content', '#abcdef');
  cleanup();
  assert.equal(doc.documentElement.style.colorScheme, 'dark');
  assert.equal(doc.metas[0].getAttribute('content'), '#abcdef');
});

test('score surface setup survives StrictMode setup, cleanup, setup sequence', () => {
  const doc = surfaceDocument();
  applyTemporiScoreSurface(doc)();
  const cleanup = applyTemporiScoreSurface(doc);
  assert.equal(doc.metas.length, 1);
  assert.equal(doc.documentElement.style.colorScheme, 'light');
  cleanup();
  assert.equal(doc.metas.length, 0);
  assert.equal(doc.documentElement.style.colorScheme, 'dark');
});

test('leaving preserves a newer application light-theme choice even though the temporary scheme was already light', () => {
  const doc = surfaceDocument();
  const cleanup = applyTemporiScoreSurface(doc);
  doc.documentElement.dataset.theme = 'light';
  doc.documentElement.style.colorScheme = 'light';
  cleanup();
  assert.equal(doc.documentElement.style.colorScheme, 'light');
  assert.equal(doc.documentElement.dataset.theme, 'light');
});

function withViewport(run) {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const scrolls = [];
  globalThis.window = { innerHeight: 900, visualViewport: { height: 800, offsetTop: 20 }, scrollY: 0, scrollTo: (options) => scrolls.push(options) };
  globalThis.document = {
    documentElement: { scrollTop: 0 },
  };
  setScoreDockBounds({ top: 700, bottom: 800, safeTop: 0 });
  resetScrollAnchorCache();
  try { run({ scrolls, setDockTop: (value) => { setScoreDockBounds({ top: value, bottom: value + 100, safeTop: 0 }); } }); }
  finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    resetScrollAnchorCache();
    setScoreDockBounds(null);
  }
}

test('score anchors use visible space above the dock including Safari viewport offset', () => {
  withViewport(({ setDockTop }) => {
    assert.deepEqual(getScoreViewport(), { top: 20, height: 680 });
    assert.equal(getAnchoredScrollTop(1000, 0.5), 640);
    assert.equal(getAnchoredScrollTop(1000, 0.25), 810);
    window.visualViewport.height = 500;
    setDockTop(420);
    assert.deepEqual(getScoreViewport(), { top: 20, height: 400 });
    assert.equal(getAnchoredScrollTop(1000, 0.5), 780);
  });
});

test('a dock outside the visible viewport reserves no extra space and safe top is applied once', () => {
  withViewport(() => {
    setScoreDockBounds({ top: 850, bottom: 900, safeTop: 40 });
    assert.deepEqual(getScoreViewport(), { top: 40, height: 780 });
    setScoreDockBounds({ top: -100, bottom: 10, safeTop: 40 });
    assert.deepEqual(getScoreViewport(), { top: 40, height: 780 });
    setScoreDockBounds(null);
    assert.deepEqual(getScoreViewport(), { top: 20, height: 800 });
    window.visualViewport = undefined;
    assert.deepEqual(getScoreViewport(), { top: 0, height: 900 });
  });
});

test('page alignment respects visible top and early measures never scroll negative', () => {
  withViewport(({ scrolls }) => {
    scrollToAnchoredMeasure(1000, 'auto', { anchorRatio: 0 });
    assert.deepEqual(scrolls, [{ top: 980, behavior: 'auto' }]);
    assert.equal(getAnchoredScrollTop(10), 0);
  });
});
