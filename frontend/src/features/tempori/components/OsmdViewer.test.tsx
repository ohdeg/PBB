// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OsmdViewer from './OsmdViewer';
const renderer = vi.hoisted(() => ({ deferred: false, fail: false, loads: [] as Array<() => void>, instance: 0, layouts: true }));
vi.mock('opensheetmusicdisplay', () => ({
  TransposeCalculator: class {},
  OpenSheetMusicDisplay: class {
    Zoom = 1; Sheet = { Transpose: 0 }; EngravingRules = {}; TransposeCalculator: unknown;
    id = ++renderer.instance;
    constructor(private container: HTMLElement) {}
    async load() {
      if (renderer.fail) throw new Error('render load failed');
      if (renderer.deferred) await new Promise<void>((resolve) => renderer.loads.push(resolve));
    }
    updateGraphic() {}
    render() { this.container.textContent = `Rendered ${this.id}`; }
    clear() { this.container.textContent = ''; }
  },
}));
vi.mock('../utils/measureTiming', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/measureTiming')>();
  return { ...actual, waitForDomLayout: async () => {}, resolveMeasureLayoutsInContainer: () => renderer.layouts ? [{ measureIndex: 0, topPx: 0, leftPx: 0, widthPx: 300, heightPx: 100 }] : [], buildMeasureOffsetsInContainer: () => [0] };
});
const xml = '<score-partwise><part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes><note><rest/><duration>4</duration></note></measure></part></score-partwise>';
beforeEach(() => {
  renderer.fail = false; renderer.deferred = false; renderer.loads = []; renderer.instance = 0; renderer.layouts = true;
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('OSMD readiness contract', () => {
  it('publishes a valid snapshot before ready, after the load completes', async () => {
    renderer.deferred = true;
    const order: string[] = [];
    render(<OsmdViewer musicXml={xml} renderRevision={3} onSnapshot={() => order.push('snapshot')} onRenderStatusChange={(status, revision) => order.push(`${status}:${revision}`)} />);
    await waitFor(() => expect(renderer.loads).toHaveLength(1));
    expect(order).toEqual(['loading:3']);
    await act(async () => renderer.loads[0]());
    await waitFor(() => expect(order).toEqual(['loading:3', 'snapshot', 'ready:3']));
  });
  it('reports invalid layouts as an error rather than making playback ready', async () => {
    renderer.layouts = false; const status = vi.fn();
    render(<OsmdViewer musicXml={xml} onRenderStatusChange={status} />);
    await screen.findByRole('alert');
    expect(status).toHaveBeenLastCalledWith('error', 0);
    expect(status).not.toHaveBeenCalledWith('ready', 0);
  });
  it('recovers from a load error when the render revision changes', async () => {
    renderer.fail = true; const status = vi.fn();
    const result = render(<OsmdViewer musicXml={xml} renderRevision={0} onRenderStatusChange={status} />);
    await screen.findByRole('alert'); renderer.fail = false;
    result.rerender(<OsmdViewer musicXml={xml} renderRevision={1} onRenderStatusChange={status} />);
    await waitFor(() => expect(status).toHaveBeenLastCalledWith('ready', 1));
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('ignores a cancelled load without rendering into the new score container', async () => {
    renderer.deferred = true; const status = vi.fn(); const snapshot = vi.fn();
    const result = render(<OsmdViewer musicXml={xml} renderRevision={0} onSnapshot={snapshot} onRenderStatusChange={status} />);
    await waitFor(() => expect(renderer.loads).toHaveLength(1));
    result.rerender(<OsmdViewer musicXml={xml} renderRevision={1} onSnapshot={snapshot} onRenderStatusChange={status} />);
    await waitFor(() => expect(renderer.loads).toHaveLength(2));
    await act(async () => renderer.loads[1]());
    await waitFor(() => expect(status).toHaveBeenLastCalledWith('ready', 1));
    await act(async () => renderer.loads[0]());
    expect(screen.getByText('Rendered 2')).toBeInTheDocument();
    expect(status).not.toHaveBeenCalledWith('ready', 0);
    expect(snapshot).toHaveBeenCalledOnce();
  });
});
