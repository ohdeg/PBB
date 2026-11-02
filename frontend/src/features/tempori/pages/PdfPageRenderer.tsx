import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { PageDocument, ScorePage } from './types';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
export function boundedCanvasScale(width: number, height: number, deviceScale: number) {
  // Current/adjacent cache plus visible/destination surfaces stay below16MP.
  return Math.min(2, deviceScale, 4096 / Math.max(width, height), Math.sqrt(3_000_000 / (width * height)));
}
export async function createPdfPageDocument(blob: Blob, signal: AbortSignal): Promise<PageDocument> {
  const pdfjs = await import('pdfjs-dist'); pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const assetRoot = new URL(`${import.meta.env.BASE_URL}tempori/pdfjs/6.4.299/`, window.location.href).href;
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), cMapUrl: `${assetRoot}cmaps/`, cMapPacked: true, standardFontDataUrl: `${assetRoot}standard_fonts/`, wasmUrl: `${assetRoot}wasm/` });
  task.onPassword = () => { void task.destroy(); };
  const abort = () => { void task.destroy(); }; signal.addEventListener('abort', abort, { once: true });
  const cache = new Map<number, HTMLCanvasElement>(); const scales = new Map<number, number>(); const inflight = new Map<number, Promise<HTMLCanvasElement>>(); const tasks = new Set<RenderTask>(); let disposed = false; let center = 0;
  const dispose = () => { if (disposed) return; disposed = true; tasks.forEach((render) => render.cancel()); for (const canvas of cache.values()) { canvas.width = 0; canvas.height = 0; } cache.clear(); signal.removeEventListener('abort', abort); void task.destroy(); };
  try {
    const pdf: PDFDocumentProxy = await task.promise;
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const pages: ScorePage[] = [];
    for (let index = 0; index < pdf.numPages; index += 1) {
      const page = await pdf.getPage(index + 1); const viewport = page.getViewport({ scale: 1 });
      pages.push({ index, width: viewport.width, height: viewport.height });
    }
    function prune() { for (const [key, value] of cache) if (Math.abs(key - center) > 1) { value.width = 0; value.height = 0; cache.delete(key); } }
    function canvasFor(index: number, zoom: number): Promise<HTMLCanvasElement> {
      const size = pages[index]; const scale = boundedCanvasScale(size.width, size.height, (window.devicePixelRatio || 1) * zoom);
      if (cache.has(index) && (scales.get(index) ?? 0) >= scale) return Promise.resolve(cache.get(index)!);
      const previous = cache.get(index); if (previous) { previous.width = 0; previous.height = 0; cache.delete(index); }
      if (inflight.has(index)) return inflight.get(index)!;
      const pending = (async () => {
        const page = await pdf.getPage(index + 1); if (disposed) throw new DOMException('Cancelled', 'AbortError');
        const viewport = page.getViewport({ scale }); const canvas = document.createElement('canvas'); canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height);
        const render = page.render({ canvas, viewport }); tasks.add(render);
        try {
          await render.promise; if (disposed) throw new DOMException('Cancelled', 'AbortError');
          if (Math.abs(index - center) <= 1) { cache.set(index, canvas); scales.set(index, scale); } return canvas;
        } finally { tasks.delete(render); }
      })().finally(() => inflight.delete(index));
      inflight.set(index, pending); return pending;
    }
    return { pages,
      async render(index, target, zoom = 1) {
        center = index; prune();
        const canvas = await canvasFor(index, zoom); if (disposed) throw new DOMException('Cancelled', 'AbortError');
        const display = document.createElement('canvas'); display.width = canvas.width; display.height = canvas.height;
        display.getContext('2d')!.drawImage(canvas, 0, 0); display.style.width = '100%'; display.style.height = '100%'; target.replaceChildren(display);
        // Render on demand; adjacent completed pages remain cached, never queue background canvases.
        prune();
      }, dispose,
    };
  } catch (failure) { dispose(); if (signal.aborted) throw failure; throw new Error('PDF를 열 수 없습니다. 암호화·손상된 파일은 지원하지 않습니다.'); }
}
