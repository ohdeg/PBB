// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadHorizontalAnnotations, saveHorizontalAnnotations, clearTemporiAnnotations, saveTemporiAnnotations, loadTemporiAnnotations } from './temporiAnnotations';
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
describe('view-specific annotation persistence', () => {
  it('keeps v1 wrapped documents untouched while writing horizontal v2', () => {
    saveTemporiAnnotations('a', { version: 1, strokes: [] });
    const original = localStorage.getItem('tempori:annotations:a');
    saveHorizontalAnnotations('a', { version: 2, strokes: [] });
    expect(loadHorizontalAnnotations('a')).toEqual({ ok: true, document: { version: 2, strokes: [] } });
    expect(localStorage.getItem('tempori:annotations:a')).toBe(original);
  });
  it('retains failed saves by ID and mode across unmount/load and removes pending data after successful clearing', () => {
    const wrapped = { version: 1 as const, strokes: [{ id: 'draft', tool: 'pen' as const, color: '#000', width: 2, points: [{ x: .1, y: .1 }, { x: .2, y: .2 }] }] };
    const save = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw Error('quota'); });
    expect(() => saveTemporiAnnotations('draft-score', wrapped)).toThrow();
    expect(loadTemporiAnnotations('draft-score')).toEqual(wrapped);
    expect(loadHorizontalAnnotations('draft-score')).toEqual({ ok: true, document: { version: 2, strokes: [] } });
    save.mockRestore();
    saveTemporiAnnotations('draft-score', { version: 1, strokes: [] });
    expect(loadTemporiAnnotations('draft-score').strokes).toHaveLength(0);
    clearTemporiAnnotations('draft-score');
  });
  it('reports invalid or unreadable v2 without replacing it with an editable empty document', () => {
    localStorage.setItem('tempori:annotations:horizontal:a', '{broken');
    expect(loadHorizontalAnnotations('a').ok).toBe(false);
    expect(localStorage.getItem('tempori:annotations:horizontal:a')).toBe('{broken');
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw Error('denied'); });
    expect(loadHorizontalAnnotations('a').ok).toBe(false);
  });
  it('deletes only the requested ID from both namespaces and can retry a partially failed cleanup', () => {
    for (const id of ['a', 'b']) {
      saveTemporiAnnotations(id, { version: 1, strokes: [] });
      saveHorizontalAnnotations(id, { version: 2, strokes: [] });
    }
    const original = localStorage.removeItem.bind(localStorage);
    vi.spyOn(localStorage, 'removeItem').mockImplementation(function (this: Storage, key) {
      if (key === 'tempori:annotations:horizontal:a') throw Error('blocked');
      return original(key);
    });
    expect(() => clearTemporiAnnotations('a')).toThrow();
    vi.restoreAllMocks(); clearTemporiAnnotations('a');
    expect(localStorage.getItem('tempori:annotations:a')).toBeNull();
    expect(localStorage.getItem('tempori:annotations:horizontal:a')).toBeNull();
    expect(localStorage.getItem('tempori:annotations:b')).not.toBeNull();
    expect(localStorage.getItem('tempori:annotations:horizontal:b')).not.toBeNull();
  });
});
