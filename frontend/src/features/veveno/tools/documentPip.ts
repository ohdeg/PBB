interface DocumentPictureInPicture {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
}

export function getDocumentPictureInPicture(): DocumentPictureInPicture | null {
  const api = (window as Window & {
    documentPictureInPicture?: DocumentPictureInPicture;
  }).documentPictureInPicture;
  return api && typeof api.requestWindow === 'function' ? api : null;
}

function copyRootVars(pip: Document): void {
  const src = getComputedStyle(document.documentElement);
  for (const name of Array.from(src)) {
    if (name.startsWith('--')) {
      pip.documentElement.style.setProperty(name, src.getPropertyValue(name));
    }
  }
}

function copyHead(pip: Document): void {
  const root = document.documentElement;
  pip.documentElement.lang = root.lang;
  pip.documentElement.className = root.className;
  const theme = root.getAttribute('data-theme');
  if (theme) {
    pip.documentElement.setAttribute('data-theme', theme);
  }
  copyRootVars(pip);
  const adopted = document.adoptedStyleSheets;
  if (adopted.length > 0) {
    try {
      pip.adoptedStyleSheets = [...adopted];
    } catch {
      /* PiP document may reject shared sheets */
    }
  }
  for (const node of Array.from(
    document.head.querySelectorAll('style, link[rel="stylesheet"]'),
  )) {
    pip.head.appendChild(node.cloneNode(true));
  }
}

export async function openDocumentPip(size: {
  width: number;
  height: number;
}): Promise<{ win: Window; root: HTMLElement } | null> {
  const api = getDocumentPictureInPicture();
  if (!api) {
    return null;
  }
  const win = await api.requestWindow(size);
  copyHead(win.document);
  win.document.documentElement.style.background = 'var(--veveno-paper, #f5f5f7)';
  win.document.body.className = 'veveno-tools-pip';
  const root = win.document.createElement('div');
  root.id = 'veveno-tools-pip-root';
  win.document.body.appendChild(root);
  return { win, root };
}
