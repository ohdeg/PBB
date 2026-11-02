// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPageAnnotations, savePageAnnotations, pageAnnotationKey, clearPageAnnotations } from './pageAnnotations';
describe('page annotation isolation', () => {
  beforeEach(() => localStorage.clear());
  it('preserves corrupt documents instead of overwriting them', () => {
    localStorage.setItem(pageAnnotationKey('a', 'layout'), '{broken');
    expect(loadPageAnnotations('a', 'layout').ok).toBe(false);
    expect(localStorage.getItem(pageAnnotationKey('a', 'layout'))).toBe('{broken');
  });
  it('retains failed writes in a session draft and clears all layout keys on deletion', () => {
    const document = { version: 1 as const, pages: [] };
    const write = vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => { throw new Error('quota'); });
    expect(() => savePageAnnotations('b', 'transpose-0', document)).toThrow(); write.mockRestore();
    expect(loadPageAnnotations('b', 'transpose-0')).toEqual({ ok: true, document });
    savePageAnnotations('b', 'transpose-1', document); clearPageAnnotations('b');
    expect(loadPageAnnotations('b', 'transpose-0')).toEqual({ ok: true, document: { version: 1, pages: [] } });
  });
});
