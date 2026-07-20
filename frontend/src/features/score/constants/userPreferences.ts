export type AutoScrollMode = 'line' | 'page';

export const AUTO_SCROLL_MODE_STORAGE_KEY = 'music-viewer:auto-scroll-mode';

export const AUTO_SCROLL_MODE_LABELS: Record<AutoScrollMode, string> = {
  line: '줄 단위',
  page: '페이지 단위',
};

export function readAutoScrollMode(): AutoScrollMode {
  const stored = localStorage.getItem(AUTO_SCROLL_MODE_STORAGE_KEY);
  return stored === 'page' ? 'page' : 'line';
}

export function writeAutoScrollMode(mode: AutoScrollMode): void {
  localStorage.setItem(AUTO_SCROLL_MODE_STORAGE_KEY, mode);
}
