import { describe, expect, it } from 'vitest';
import { detectBrowserLocale, parseVevenoLocale } from './detect';

describe('parseVevenoLocale', () => {
  it('maps language tags', () => {
    expect(parseVevenoLocale('ko-KR')).toBe('ko');
    expect(parseVevenoLocale('en-US')).toBe('en');
    expect(parseVevenoLocale('ja')).toBe('ja');
    expect(parseVevenoLocale('zh-CN')).toBeNull();
  });
});

describe('detectBrowserLocale', () => {
  it('picks the first supported language', () => {
    expect(detectBrowserLocale(['fr-FR', 'ja-JP', 'en'], 'fr-FR')).toBe('ja');
  });

  it('falls back to Korean', () => {
    expect(detectBrowserLocale(['zh-CN'], 'zh-CN')).toBe('ko');
  });
});
