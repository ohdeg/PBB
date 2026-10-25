const LEGACY_BASE = '/hobbies/score-viewer';

/** Keep the raw encoded suffix, query and fragment of existing bookmarks. */
export function getTemporiRedirectTarget(location: { pathname: string; search: string; hash: string }): string {
  return '/hobbies/tempori' + location.pathname.slice(LEGACY_BASE.length) + location.search + location.hash;
}
