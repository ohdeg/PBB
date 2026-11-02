// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCameraPageTurn } from './useCameraPageTurn';
class WorkerStub {
  static instances: WorkerStub[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn(); postMessage = vi.fn();
  constructor() { WorkerStub.instances.push(this); }
}
const getUserMedia = vi.fn();
const originalWorker = globalThis.Worker, originalCanvas = globalThis.OffscreenCanvas, originalBitmap = globalThis.createImageBitmap;
beforeEach(() => {
  vi.stubGlobal('localStorage', window.localStorage); vi.useFakeTimers(); WorkerStub.instances = [];
  vi.stubGlobal('Worker', WorkerStub); vi.stubGlobal('OffscreenCanvas', class {}); vi.stubGlobal('createImageBitmap', vi.fn());
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  getUserMedia.mockReset();
});
afterEach(() => { vi.useRealTimers(); vi.stubGlobal('Worker', originalWorker); vi.stubGlobal('OffscreenCanvas', originalCanvas); vi.stubGlobal('createImageBitmap', originalBitmap); });
function video() {
  const element = document.createElement('video'); element.play = vi.fn().mockResolvedValue(undefined);
  Object.defineProperties(element, { readyState: { value: 2 }, videoWidth: { value: 1280 }, videoHeight: { value: 720 } }); return element;
}
it('stops tracks from a permission request that resolves after OFF', async () => {
  let resolve!: (value: unknown) => void; const stop = vi.fn();
  getUserMedia.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const { result, unmount } = renderHook(() => useCameraPageTurn(vi.fn(), false, 0)); result.current.videoRef.current = video();
  let pending!: Promise<void>; act(() => { pending = result.current.start(); }); act(() => result.current.stop());
  await act(async () => { resolve({ getTracks: () => [{ stop }] }); await pending; });
  expect(stop).toHaveBeenCalledOnce(); expect(WorkerStub.instances).toHaveLength(0); expect(result.current.status).toBe('off'); unmount();
});
it('ignores a stale capture rejection after a new camera session starts', async () => {
  const firstStop = vi.fn(), secondStop = vi.fn(); let reject!: (reason: unknown) => void;
  getUserMedia.mockResolvedValueOnce({ getTracks: () => [{ stop: firstStop }] }).mockResolvedValueOnce({ getTracks: () => [{ stop: secondStop }] });
  vi.mocked(createImageBitmap).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  const { result, unmount } = renderHook(() => useCameraPageTurn(vi.fn(), false, 0)); result.current.videoRef.current = video();
  await act(() => result.current.start());
  act(() => WorkerStub.instances[0].onmessage?.({ data: { type: 'ready' } } as MessageEvent));
  expect(createImageBitmap).toHaveBeenCalledWith(expect.anything(), { resizeWidth: 640, resizeHeight: 360 });
  await act(() => result.current.start());
  await act(async () => { reject(new Error('old stopped frame')); await Promise.resolve(); });
  expect(result.current.status).toBe('requesting'); expect(secondStop).not.toHaveBeenCalled(); expect(WorkerStub.instances[1].terminate).not.toHaveBeenCalled(); unmount();
});
