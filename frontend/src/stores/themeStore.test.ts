// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme } from './themeStore';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
});

describe('themeStore', () => {
  it('applies data-theme and color-scheme on html', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});
