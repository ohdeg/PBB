import { useCallback, useEffect, useRef, useState } from 'react';
import ScorePositionHighlight from './ScorePositionHighlight';
import ScoreMeasureClickOverlay from './ScoreMeasureClickOverlay';
import type { MeasureTiming } from '../types/scorePractice';
import type { MeasureLayoutInContainer, PlayheadHighlight } from '../utils/measureTiming';
import {
  buildMeasureOffsetsInContainer,
  parseMeasureTimingsFromMusicXml,
  resolveMeasureLayoutsInContainer,
  waitForDomLayout,
} from '../utils/measureTiming';
import { normalizeMusicXmlForOsmd } from '../utils/musicXml';

export interface ScoreRenderSnapshot {
  timings: MeasureTiming[];
  measureOffsets: number[];
  measureLayoutsInContainer: MeasureLayoutInContainer[];
}

const snapshotsEqual = (left: ScoreRenderSnapshot, right: ScoreRenderSnapshot): boolean => {
  if (left.timings.length !== right.timings.length) return false;
  if (left.measureOffsets.length !== right.measureOffsets.length) return false;
  if (left.measureLayoutsInContainer.length !== right.measureLayoutsInContainer.length) return false;

  for (let index = 0; index < left.timings.length; index += 1) {
    const a = left.timings[index];
    const b = right.timings[index];
    if (
      a.measureIndex !== b.measureIndex ||
      a.divisions !== b.divisions ||
      a.durationSum !== b.durationSum
    ) {
      return false;
    }
  }

  for (let index = 0; index < left.measureOffsets.length; index += 1) {
    if (left.measureOffsets[index] !== right.measureOffsets[index]) return false;
  }

  for (let index = 0; index < left.measureLayoutsInContainer.length; index += 1) {
    const a = left.measureLayoutsInContainer[index];
    const b = right.measureLayoutsInContainer[index];
    if (
      a.measureIndex !== b.measureIndex ||
      a.topPx !== b.topPx ||
      a.leftPx !== b.leftPx ||
      a.widthPx !== b.widthPx ||
      a.heightPx !== b.heightPx
    ) {
      return false;
    }
  }

  return true;
};

interface OsmdSheet {
  Transpose: number;
}

interface OsmdEngravingRules {
  StretchLastSystemLine: boolean;
  RenderXMeasuresPerLineAkaSystem: number;
}

interface OsmdInstance {
  load: (content: string) => Promise<unknown>;
  render: () => void;
  updateGraphic: () => void;
  clear: () => void;
  TransposeCalculator: unknown;
  Sheet: OsmdSheet;
  EngravingRules: OsmdEngravingRules;
}

interface OsmdModule {
  OpenSheetMusicDisplay: new (
    container: HTMLElement,
    options: Record<string, unknown>,
  ) => OsmdInstance;
  TransposeCalculator: new () => unknown;
}

interface OsmdViewerProps {
  musicXml: string;
  transposeSemitones?: number;
  /** 0이면 자동 줄바꿈 */
  measuresPerLine?: number;
  positionHighlight?: PlayheadHighlight | null;
  showMeasureHighlight?: boolean;
  measureClickEnabled?: boolean;
  onMeasureClick?: (measureIndex: number) => void;
  onSnapshot?: (snapshot: ScoreRenderSnapshot) => void;
}

const LAYOUT_RESYNC_DEBOUNCE_MS = 150;

export default function OsmdViewer({
  musicXml,
  transposeSemitones = 0,
  measuresPerLine = 0,
  positionHighlight = null,
  showMeasureHighlight = true,
  measureClickEnabled = false,
  onMeasureClick,
  onSnapshot,
}: OsmdViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onMeasureClickRef = useRef(onMeasureClick);
  const onSnapshotRef = useRef(onSnapshot);
  const lastEmittedSnapshotRef = useRef<ScoreRenderSnapshot | null>(null);
  const lastGoodLayoutsRef = useRef<MeasureLayoutInContainer[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeTimerRef = useRef<number | null>(null);
  const [measureLayouts, setMeasureLayouts] = useState<MeasureLayoutInContainer[]>([]);
  const [renderError, setRenderError] = useState<string | null>(null);

  onSnapshotRef.current = onSnapshot;
  onMeasureClickRef.current = onMeasureClick;

  const handleMeasureClick = useCallback((measureIndex: number) => {
    onMeasureClickRef.current?.(measureIndex);
  }, []);

  const publishSnapshot = useCallback((container: HTMLElement, osmdXml: string) => {
    const timings = parseMeasureTimingsFromMusicXml(osmdXml);
    if (timings.length === 0) return;

    const measureLayoutsInContainer = resolveMeasureLayoutsInContainer(container, timings.length);
    if (measureLayoutsInContainer.length === 0) {
      return;
    }

    const measureOffsets = buildMeasureOffsetsInContainer(container, timings.length);
    const snapshot: ScoreRenderSnapshot = {
      timings,
      measureOffsets,
      measureLayoutsInContainer,
    };

    lastGoodLayoutsRef.current = measureLayoutsInContainer;
    setMeasureLayouts(measureLayoutsInContainer);

    const previous = lastEmittedSnapshotRef.current;
    if (previous && snapshotsEqual(previous, snapshot)) return;

    lastEmittedSnapshotRef.current = snapshot;
    onSnapshotRef.current?.(snapshot);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !musicXml.trim()) return;

    let cancelled = false;
    let osmdInstance: OsmdInstance | null = null;
    const osmdXml = normalizeMusicXmlForOsmd(musicXml);
    let lastKnownWidth = 0;

    const syncLayout = async () => {
      if (cancelled) return;
      await waitForDomLayout();
      if (cancelled) return;
      publishSnapshot(container, osmdXml);
    };

    const scheduleRelayout = () => {
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current);
      }
      resizeTimerRef.current = window.setTimeout(() => {
        if (cancelled || !osmdInstance) return;
        const nextWidth = container.clientWidth;
        if (nextWidth > 0 && Math.abs(nextWidth - lastKnownWidth) >= 1) {
          lastKnownWidth = nextWidth;
          try {
            osmdInstance.render();
          } catch (error) {
            console.error('OSMD 리사이즈 렌더 실패:', error);
          }
        }
        void syncLayout();
      }, LAYOUT_RESYNC_DEBOUNCE_MS);
    };

    const render = async () => {
      try {
        setRenderError(null);
        container.innerHTML = '';
        const module = (await import('opensheetmusicdisplay')) as OsmdModule;
        const osmd = new module.OpenSheetMusicDisplay(container, {
          drawingParameters: 'compacttight',
          backend: 'svg',
          autoResize: true,
          renderSingleHorizontalStaffline: false,
        });
        osmdInstance = osmd;
        osmd.EngravingRules.StretchLastSystemLine = true;
        osmd.EngravingRules.RenderXMeasuresPerLineAkaSystem =
          measuresPerLine > 0 ? measuresPerLine : 0;
        await osmd.load(osmdXml);
        osmd.TransposeCalculator = new module.TransposeCalculator();
        if (transposeSemitones !== 0) {
          osmd.Sheet.Transpose = transposeSemitones;
          osmd.updateGraphic();
        }
        osmd.render();
        lastKnownWidth = container.clientWidth;

        if (cancelled) return;

        await syncLayout();

        if (cancelled) return;

        resizeObserverRef.current?.disconnect();
        resizeObserverRef.current = new ResizeObserver(() => {
          scheduleRelayout();
        });
        resizeObserverRef.current.observe(container);
      } catch (error) {
        console.error('OSMD 렌더링 실패:', error);
        if (!cancelled) {
          setRenderError('악보 렌더링에 실패했습니다.');
        }
      }
    };

    void render();

    return () => {
      cancelled = true;
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      osmdInstance?.clear();
      container.innerHTML = '';
    };
  }, [musicXml, transposeSemitones, measuresPerLine, publishSnapshot]);

  const activeLayouts =
    measureLayouts.length > 0 ? measureLayouts : lastGoodLayoutsRef.current;

  return (
    <div className="osmd-viewer">
      {renderError && <p className="score-viewer-error">{renderError}</p>}
      <div className="osmd-viewer-stage">
        <div ref={containerRef} className="osmd-viewer-canvas" />
        <div className="osmd-viewer-overlay">
          <ScorePositionHighlight highlight={positionHighlight} visible={showMeasureHighlight} />
        </div>
        <ScoreMeasureClickOverlay
          layouts={activeLayouts}
          enabled={measureClickEnabled}
          onMeasureClick={handleMeasureClick}
        />
      </div>
    </div>
  );
}
