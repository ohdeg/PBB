/** Mirror the viewer route, excluding the sibling library route. */
export function isTemporiViewerPath(pathname: string): boolean {
  const match = /^\/hobbies\/tempori\/([^/]+)\/?$/i.exec(pathname);
  if (!match) return false;
  try {
    return decodeURIComponent(match[1]).toLowerCase() !== 'library';
  } catch {
    return false;
  }
}

/** Temporary browser chrome hint; never change the user's persisted theme. */
export function applyTemporiScoreSurface(doc: Document): () => void {
  const root = doc.documentElement;
  const hadClass = root.classList.contains('tempori-score-mode');
  const previousColorScheme = root.style.colorScheme;
  const previousTheme = root.dataset.theme;
  const existingMetas = Array.from(doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  const previousColors = existingMetas.map((meta) => meta.getAttribute('content'));
  const createdMeta = existingMetas.length === 0 ? doc.createElement('meta') : null;
  if (createdMeta) {
    createdMeta.setAttribute('name', 'theme-color');
    doc.head.append(createdMeta);
  }
  const metas = createdMeta ? [createdMeta] : existingMetas;
  root.classList.add('tempori-score-mode');
  root.style.colorScheme = 'light';
  for (const meta of metas) meta.setAttribute('content', '#ffffff');

  return () => {
    if (!hadClass) root.classList.remove('tempori-score-mode');
    if (root.style.colorScheme === 'light' && root.dataset.theme === previousTheme) {
      root.style.colorScheme = previousColorScheme;
    }
    for (const [index, meta] of metas.entries()) {
      if (meta.getAttribute('content') !== '#ffffff') continue;
      if (meta === createdMeta) meta.remove();
      else if (previousColors[index] === null) meta.removeAttribute('content');
      else meta.setAttribute('content', previousColors[index]);
    }
  };
}
