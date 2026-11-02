// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
const boundary = vi.hoisted(() => ({ document: vi.fn(), destroy: vi.fn(), page: vi.fn() }));
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: boundary.document }));
import { boundedCanvasScale, createPdfPageDocument } from './PdfPageRenderer';
beforeEach(() => { vi.clearAllMocks(); boundary.destroy.mockResolvedValue(undefined); boundary.document.mockReturnValue({ promise: Promise.resolve({ numPages: 2, getPage: boundary.page }), destroy: boundary.destroy }); });
describe('PDF worker lifecycle and memory bounds', () => {
  it('destroys the loading task and removes its abort listener when page metadata fails', async () => {
    boundary.page.mockRejectedValue(new Error('bad page dictionary'));
    const controller = new AbortController(); const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const blob = { arrayBuffer: async () => new ArrayBuffer(4) } as Blob;
    await expect(createPdfPageDocument(blob, controller.signal)).rejects.toThrow('PDF');
    expect(boundary.destroy).toHaveBeenCalledOnce(); expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });
  it('caps extreme pages and zoom hints under3MP,4096px and2x', () => {
    for (const [width, height] of [[595, 842], [10000, 100], [2500, 3500], [200, 200]]) {
      const scale = boundedCanvasScale(width, height, 4);
      expect(scale).toBeLessThanOrEqual(2); expect(width * height * scale * scale).toBeLessThanOrEqual(3_000_001); expect(Math.max(width, height) * scale).toBeLessThanOrEqual(4096);
    }
  });
});
