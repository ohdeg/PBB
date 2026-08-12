const STORAGE_KEY = 'sranko_viewer_id';

/** Stable anonymous viewer id for view-count dedupe (localStorage). */
export function getSrankoViewerId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,80}$/.test(existing)) {
      return existing;
    }
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replace(/-/g, '')
        : `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return `v${Date.now().toString(36)}`;
  }
}
