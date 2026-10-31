// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OsmdViewer from './OsmdViewer';
const renderer = vi.hoisted(() => ({ deferred: false, fail: false, loads: [] as Array<() => void>, instance: 0, layouts: true, left: 0, options: [] as Record<string, unknown>[], loadedXml: [] as string[] }));
vi.mock('opensheetmusicdisplay', () => ({
  TransposeCalculator: class {},
  OpenSheetMusicDisplay: class {
    Zoom = 1; Sheet = { Transpose: 0 }; EngravingRules = {}; TransposeCalculator: unknown;
    id = ++renderer.instance;
    constructor(private container: HTMLElement, options: Record<string, unknown>) { renderer.options.push(options); }
    async load(xml: string) {
      renderer.loadedXml.push(xml);
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
  return { ...actual, waitForDomLayout: async () => {}, resolveMeasureLayoutsInContainer: () => renderer.layouts ? [{ measureIndex: 0, topPx: 0, leftPx: renderer.left, widthPx: 300, heightPx: 100 }] : [], buildMeasureOffsetsInContainer: () => [0] };
});
const xml = '<score-partwise><part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes><note><rest/><duration>4</duration></note></measure></part></score-partwise>';
beforeEach(() => {
  renderer.fail = false; renderer.deferred = false; renderer.loads = []; renderer.instance = 0; renderer.layouts = true; renderer.left = 0; renderer.options = []; renderer.loadedXml = [];
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('OSMD readiness contract', () => {
  it('realigns horizontal playback after controls collapse, without vertical following on every measure', async () => {
    const status = vi.fn();
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const { rerender } = render(<OsmdViewer musicXml={xml} viewMode="horizontal" onRenderStatusChange={status} />);
    await waitFor(() => expect(status).toHaveBeenLastCalledWith('ready', 0));
    const viewport = screen.getByRole('region');
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ top: -80 } as DOMRect);
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(200);
    scroll.mockClear();
    rerender(<OsmdViewer musicXml={xml} viewMode="horizontal" freezeLayout onRenderStatusChange={status} />);
    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ top: 120, behavior: 'auto' }));
    scroll.mockClear();
    rerender(<OsmdViewer musicXml={xml} viewMode="horizontal" freezeLayout currentMeasureIndex={1} onRenderStatusChange={status} />);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    expect(scroll).not.toHaveBeenCalled();
  });
  it('sets horizontal mode before loading and strips XML system breaks', async () => {
    const status = vi.fn();
    render(<OsmdViewer musicXml={xml.replace('<note>', '<print new-system="yes" new-page="yes"/><note>')} viewMode="horizontal" onRenderStatusChange={status} />);
    await waitFor(() => expect(status).toHaveBeenLastCalledWith('ready', 0));
    expect(renderer.options[0].renderSingleHorizontalStaffline).toBe(true);
    expect(renderer.loadedXml[0]).not.toContain('new-system');
    expect(renderer.loadedXml[0]).not.toContain('new-page');
  });
  it('converts Shift+wheel locally with cancellation, leaving ordinary vertical wheel and control zoom native', async () => {
    const status = vi.fn(); const manual = vi.fn();
    render(<OsmdViewer musicXml={xml} viewMode="horizontal" onManualNavigation={manual} onRenderStatusChange={status} />);
    await waitFor(() => expect(status).toHaveBeenLastCalledWith('ready', 0));
    const viewport = screen.getByRole('region');
    const shift = new WheelEvent('wheel', { bubbles: true, cancelable: true, shiftKey: true, deltaY: 90 });
    fireEvent(viewport, shift);
    expect(shift.defaultPrevented).toBe(true); expect(viewport.scrollLeft).toBe(90);
    const vertical = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 30 });
    fireEvent(viewport, vertical); expect(vertical.defaultPrevented).toBe(false); expect(viewport.scrollLeft).toBe(90);
    const zoom = new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, shiftKey: true, deltaY: 30 });
    fireEvent(viewport, zoom); expect(zoom.defaultPrevented).toBe(false); expect(viewport.scrollLeft).toBe(90);
    expect(manual).toHaveBeenCalledTimes(2);
  });
  it('honors an explicit current-measure request with automatic following off', async () => {
    renderer.left = 900; const status = vi.fn();
    const { rerender } = render(<OsmdViewer musicXml={xml} viewMode="horizontal" followEnabled={false} followRequestKey={0} onRenderStatusChange={status} />);
    await waitFor(() => expect(status).toHaveBeenLastCalledWith('ready', 0));
    const viewport = screen.getByRole('region');
    Object.defineProperties(viewport, { clientWidth: { value: 600 }, scrollWidth: { value: 3000 } });
    rerender(<OsmdViewer musicXml={xml} viewMode="horizontal" followEnabled={true} followRequestKey={0} onRenderStatusChange={status} />);
    expect(viewport.scrollLeft).toBe(700);
    rerender(<OsmdViewer musicXml={xml} viewMode="horizontal" followEnabled={false} followRequestKey={0} onRenderStatusChange={status} />);
    viewport.scrollLeft = 50;
    rerender(<OsmdViewer musicXml={xml} viewMode="horizontal" followEnabled={false} followRequestKey={1} onRenderStatusChange={status} />);
    expect(viewport.scrollLeft).toBe(700);
    viewport.scrollLeft = 75;
    rerender(<OsmdViewer musicXml={xml} viewMode="horizontal" followEnabled={false} followRequestKey={1} onRenderStatusChange={status} />);
    expect(viewport.scrollLeft).toBe(75);
  });
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
