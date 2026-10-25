import type { HobbyApp } from '../../data/hobbies';

const MAX_RECENT_APPS = 20;

function storageKey(userId: string): string {
  return `pbb:recent-apps:v1:${encodeURIComponent(userId)}`;
}

export function readRecentAppIds(userId: string): string[] {
  if (!userId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== 'object' || !('version' in saved)
      || saved.version !== 1 || !('appIds' in saved)
      || !Array.isArray(saved.appIds)
      || !saved.appIds.every((id: unknown) => typeof id === 'string')) return [];
    return [...new Set<string>(saved.appIds.filter((id: string) => id.trim()))].slice(0, MAX_RECENT_APPS);
  } catch {
    // Storage is optional (private browsing, SSR, malformed data).
    return [];
  }
}

export function recordRecentApp(userId: string, appId: string): string[] {
  if (!userId) return [];
  const previous = readRecentAppIds(userId);
  if (!appId.trim()) return previous;
  const appIds = [appId, ...previous.filter((id) => id !== appId)].slice(0, MAX_RECENT_APPS);
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify({ version: 1, appIds }));
  } catch {
    // A history write must never block opening an app.
  }
  return appIds;
}

export function getVisibleRecentApps(
  ids: readonly string[], visibleApps: readonly HobbyApp[], limit = 2,
): HobbyApp[] {
  const byId = new Map(visibleApps.map((app) => [app.id, app]));
  return [...new Set(ids)]
    .map((id) => byId.get(id))
    .filter((app): app is HobbyApp => Boolean(app))
    .slice(0, Math.max(0, limit));
}

/** Match registered execution routes, never a loose app-prefix match. */
export function findVisitedApp(pathname: string, visibleApps: readonly HobbyApp[]): HobbyApp | undefined {
  const normalized = pathname.replace(/\/$/, '').toLowerCase();
  const segments = normalized.split('/');
  return visibleApps.find((app) => {
    if (normalized === app.path?.toLowerCase()) return false;
    const paths = app.usagePaths ?? (app.startPath ? [app.startPath] : []);
    return paths.some((path) => {
      const pattern = path.toLowerCase().split('/');
      return pattern.length === segments.length
        && pattern.every((part, i) => part.startsWith(':') ? Boolean(segments[i]) : part === segments[i]);
    });
  });
}
