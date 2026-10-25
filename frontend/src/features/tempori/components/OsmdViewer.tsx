import { useCallback, useEffect, useRef, useState } from 'react';
import type { TemporiRenderStatus } from '../utils/practiceInteraction';
import { useTranslation } from '../i18n/LanguageContext';
import TemporiPositionHighlight from './TemporiPositionHighlight';
import TemporiMeasureClickOverlay from './TemporiMeasureClickOverlay';
import TemporiAnnotationLayer from './TemporiAnnotationLayer';
import type { AnnotationBrushSizes, AnnotationToolMode } from '../types/temporiAnnotation';
import type { MeasureTiming } from '../types/temporiPractice';
import type { MeasureLayoutInContainer, PlayheadHighlight } from '../utils/measureTiming';
import {
  buildMeasureOffsetsInContainer,
  groupMeasureLayoutsByLine,
  parseMeasureTimingsFromMusicXml,
  resolveMeasureLayoutsInContainer,
  waitForDomLayout,
} from '../utils/measureTiming';
import { parsePlaybackSequenceFromMusicXml } from '../utils/musicXmlRepeats';
import { normalizeMusicXmlForOsmd } from '../utils/musicXml';
import { DEFAULT_ANNOTATION_BRUSH_SIZES } from '../constants/annotationBrush';
import {
  applyOsmdLayoutRules,
  clampMeasuresPerLine,
  DEFAULT_MEASURES_PER_LINE,
} from '../constants/temporiLayout';

export interface TemporiRenderSnapshot {
  timings: MeasureTiming[];
  playbackSequence: number[];
  measureOffsets: number[];
  measureLayoutsInContainer: MeasureLayoutInContainer[];
}

const playbackSequencesEqual = (left: number[], right: number[]): boolean => {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

const snapshotsEqual = (left: TemporiRenderSnapshot, right: TemporiRenderSnapshot): boolean => {
  if (left.timings.length !== right.timings.length) return false;
  if (!playbackSequencesEqual(left.playbackSequence, right.playbackSequence)) return false;
  if (left.measureOffsets.length !== right.measureOffsets.length) return false;
  if (left.measureLayoutsInContainer.length !== right.measureLayoutsInContainer.length) return false;

  for (let index = 0; index < left.timings.length; index += 1) {
    const a = left.timings[index];
    const b = right.timings[index];
    if (
      a.measureIndex !== b.measureIndex ||
      a.divisions !== b.divisions ||
      a.durationSum !== b.durationSum ||
      a.expectedDurationDivisions !== b.expectedDurationDivisions ||
      a.beatsPerMeasure !== b.beatsPerMeasure ||
      a.beatType !== b.beatType ||
      a.tempoBpm !== b.tempoBpm ||
      a.fermataFactor !== b.fermataFactor ||
      a.isPickup !== b.isPickup
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
      a.heightPx !== b.heightPx ||
      a.highlightLeftPx !== b.highlightLeftPx ||
      a.highlightWidthPx !== b.highlightWidthPx
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
  RenderXMeasuresPerLineAkaSystem: number;
  NewSystemAtXMLNewSystemAttribute: boolean;
  NewSystemAtXMLNewPageAttribute: boolean;
  NewPageAtXMLNewPageAttribute: boolean;
}

interface OsmdInstance {
  load: (content: string) => Promise<unknown>;
  render: () => void;
  updateGraphic: () => void;
  clear: () => void;
  Zoom: number;
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
  renderRevision?: number;
  onRenderStatusChange?: (status: TemporiRenderStatus, revision: number) => void;
  temporiId?: string;
  measuresPerLine?: number;
  transposeSemitones?: number;
  positionHighlight?: PlayheadHighlight | null;
  selectionHighlight?: PlayheadHighlight | null;
  showMeasureHighlight?: boolean;
  measureClickEnabled?: boolean;
  annotationTool?: AnnotationToolMode;
  annotationBrushSizes?: AnnotationBrushSizes;
  annotationsEnabled?: boolean;
  freezeLayout?: boolean;
  onMeasureClick?: (measureIndex: number) => void;
  onSnapshot?: (snapshot: TemporiRenderSnapshot) => void;
}

const LAYOUT_RESYNC_DEBOUNCE_MS = 120;
const ORIENTATION_RESYNC_DEBOUNCE_MS = 240;
const MIN_LAYOUT_RESYNC_DELTA_PX = 2;
const MAJOR_LAYOUT_RESYNC_DELTA_PX = 24;
const MIN_OSMD_ZOOM = 0.5;
const MAX_ZOOM_ADJUSTMENT_TRIES = 6;

export default function OsmdViewer({
  musicXml,
  renderRevision = 0,
  onRenderStatusChange,
  temporiId = '',
  measuresPerLine = DEFAULT_MEASURES_PER_LINE,
  transposeSemitones = 0,
  positionHighlight = null,
  selectionHighlight = null,
  showMeasureHighlight = true,
  measureClickEnabled = false,
  annotationTool = 'none',
  annotationBrushSizes = DEFAULT_ANNOTATION_BRUSH_SIZES,
  annotationsEnabled = false,
  freezeLayout = false,
  onMeasureClick,
  onSnapshot,
}: OsmdViewerProps) {
  const t = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onMeasureClickRef = useRef(onMeasureClick);
  const onSnapshotRef = useRef(onSnapshot);
  const onRenderStatusRef = useRef(onRenderStatusChange);
  onRenderStatusRef.current = onRenderStatusChange;
  const lastEmittedSnapshotRef = useRef<TemporiRenderSnapshot | null>(null);
  const lastGoodLayoutsRef = useRef<MeasureLayoutInContainer[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeTimerRef = useRef<number | null>(null);
  const lastObservedContainerSizeRef = useRef<{ width: number; height: number } | null>(null);
  const lastViewportWidthRef = useRef<number>(window.innerWidth);
  const osmdRef = useRef<OsmdInstance | null>(null);
  const freezeLayoutRef = useRef(freezeLayout);
  const [measureLayouts, setMeasureLayouts] = useState<MeasureLayoutInContainer[]>([]);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [hasRenderError, setHasRenderError] = useState(false);
  const normalizedMeasuresPerLine = clampMeasuresPerLine(measuresPerLine);

  freezeLayoutRef.current = freezeLayout;
  onSnapshotRef.current = onSnapshot;
  onMeasureClickRef.current = onMeasureClick;

  const handleMeasureClick = useCallback((measureIndex: number) => {
    onMeasureClickRef.current?.(measureIndex);
  }, []);

  const publishSnapshot = useCallback((container: HTMLElement, osmdXml: string) => {
    const timings = parseMeasureTimingsFromMusicXml(osmdXml);
    if (timings.length === 0) return false;

    const playbackSequence = parsePlaybackSequenceFromMusicXml(osmdXml);
    const measureLayoutsInContainer = resolveMeasureLayoutsInContainer(
      container,
      timings.length,
      normalizedMeasuresPerLine,
    );
    if (measureLayoutsInContainer.length === 0) {
      return false;
    }

    const measureOffsets = buildMeasureOffsetsInContainer(
      container,
      timings.length,
      normalizedMeasuresPerLine,
    );
    const snapshot: TemporiRenderSnapshot = {
      timings,
      playbackSequence,
      measureOffsets,
      measureLayoutsInContainer,
    };

    lastGoodLayoutsRef.current = measureLayoutsInContainer;
    setMeasureLayouts(measureLayoutsInContainer);

    const previous = lastEmittedSnapshotRef.current;
    if (previous && snapshotsEqual(previous, snapshot)) return true;

    lastEmittedSnapshotRef.current = snapshot;
    onSnapshotRef.current?.(snapshot);
    return true;
  }, [normalizedMeasuresPerLine]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !musicXml.trim()) return;

    let cancelled = false;
    onRenderStatusRef.current?.('loading', renderRevision);
    lastEmittedSnapshotRef.current = null;
    lastGoodLayoutsRef.current = [];
    setMeasureLayouts([]);
    let osmdInstance: { clear: () => void } | null = null;
    let osmdXml = '';

    const reportError = (error: unknown) => {
      if (cancelled) return;
      console.error('OSMD 렌더링 실패:', error);
      setHasRenderError(true);
      setIsRendering(false);
      onRenderStatusRef.current?.('error', renderRevision);
    };

    const syncLayout = async () => {
      if (cancelled) return;
      await waitForDomLayout();
      if (cancelled) return;
      return publishSnapshot(container, osmdXml);
    };

    const rerenderTempori = async () => {
      const osmd = osmdRef.current;
      if (!osmd || cancelled) return;

      osmd.updateGraphic();
      osmd.render();
      await syncLayout();
    };

    const scheduleLayoutSync = (options?: { force?: boolean; debounceMs?: number }) => {
      const force = options?.force ?? false;
      if (cancelled || (!force && freezeLayoutRef.current)) return;

      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current);
      }

      const debounceMs = options?.debounceMs ?? LAYOUT_RESYNC_DEBOUNCE_MS;
      resizeTimerRef.current = window.setTimeout(() => {
        if (force) {
          void rerenderTempori().catch(reportError);
          return;
        }
        void syncLayout().catch(reportError);
      }, debounceMs);
    };

    const handleOrientationChange = () => {
      const nextViewportWidth = window.innerWidth;
      const widthDelta = Math.abs(nextViewportWidth - lastViewportWidthRef.current);
      lastViewportWidthRef.current = nextViewportWidth;
      scheduleLayoutSync({
        force: widthDelta >= MAJOR_LAYOUT_RESYNC_DELTA_PX,
        debounceMs: ORIENTATION_RESYNC_DEBOUNCE_MS,
      });
    };

    const render = async () => {
      try {
        osmdXml = normalizeMusicXmlForOsmd(musicXml, normalizedMeasuresPerLine);
        setHasRenderError(false);
        setIsRendering(true);
        container.innerHTML = '';
        const module = (await import('opensheetmusicdisplay')) as OsmdModule;
        if (cancelled) return;
        const osmd = new module.OpenSheetMusicDisplay(container, {
          drawingParameters: 'compact',
          backend: 'svg',
          autoResize: true,
          pageFormat: 'Endless',
          renderSingleHorizontalStaffline: false,
          drawPartAbbreviations: false,
          drawPartNames: false,
          newSystemFromXML: true,
          newSystemFromNewPageInXML: false,
          newPageFromXML: false,
        });
        applyOsmdLayoutRules(osmd.EngravingRules, normalizedMeasuresPerLine, true);
        osmdInstance = osmd;
        osmdRef.current = osmd;
        await osmd.load(osmdXml);
        if (cancelled) return;
        applyOsmdLayoutRules(osmd.EngravingRules, normalizedMeasuresPerLine, true);
        osmd.TransposeCalculator = new module.TransposeCalculator();
        if (transposeSemitones !== 0) {
          osmd.Sheet.Transpose = transposeSemitones;
        }
        osmd.updateGraphic();
        osmd.render();

        if (cancelled) return;

        await waitForDomLayout();
        if (cancelled) return;

        const hasUniformMeasuresPerSystem = (
          lines: MeasureLayoutInContainer[][],
          measureCount: number,
        ): boolean => {
          if (lines.length === 0) return false;
          const renderedMeasureCount = lines.reduce((sum, line) => sum + line.length, 0);
          if (renderedMeasureCount < measureCount) return false;

          const nonLastLines = lines.slice(0, -1);
          const allNonLastFixed = nonLastLines.every((line) => line.length === normalizedMeasuresPerLine);
          if (!allNonLastFixed) return false;

          const lastLineCount = lines[lines.length - 1]?.length ?? 0;
          if (lastLineCount <= 0 || lastLineCount > normalizedMeasuresPerLine) return false;

          if (measureCount > normalizedMeasuresPerLine && lines.length === 1) return false;

          return true;
        };

        const evaluateSystemLayout = (measureCount: number) => {
          const layouts = resolveMeasureLayoutsInContainer(
            container,
            measureCount,
            normalizedMeasuresPerLine,
          );
          const lines = groupMeasureLayoutsByLine(layouts);
          const isUniform = hasUniformMeasuresPerSystem(lines, measureCount);
          return { isUniform, lines };
        };

        const tuneLayoutForFixedSystems = async () => {
          const timings = parseMeasureTimingsFromMusicXml(osmdXml);
          if (timings.length < normalizedMeasuresPerLine) return;

          let layoutState = evaluateSystemLayout(timings.length);
          if (layoutState.isUniform) return;

          for (
            let tryIndex = 0;
            tryIndex < MAX_ZOOM_ADJUSTMENT_TRIES;
            tryIndex += 1
          ) {
            if (cancelled) return;
            layoutState = evaluateSystemLayout(timings.length);
            if (layoutState.isUniform) {
              break;
            }

            const currentZoom = osmd.Zoom > 0 ? osmd.Zoom : 1;
            const nextZoom = Math.max(MIN_OSMD_ZOOM, currentZoom * 0.9);
            if (nextZoom === currentZoom) {
              break;
            }

            osmd.Zoom = nextZoom;
            osmd.updateGraphic();
            osmd.render();
            await waitForDomLayout();
          }

          if (cancelled) return;
          layoutState = evaluateSystemLayout(timings.length);
          if (layoutState.isUniform) return;

          // Fallback: ignore XML new-system markers if they conflict with fixed system sizing.
          applyOsmdLayoutRules(osmd.EngravingRules, normalizedMeasuresPerLine, false);
          osmd.updateGraphic();
          osmd.render();
          await waitForDomLayout();

          for (
            let tryIndex = 0;
            tryIndex < Math.max(2, MAX_ZOOM_ADJUSTMENT_TRIES - 2);
            tryIndex += 1
          ) {
            if (cancelled) return;
            layoutState = evaluateSystemLayout(timings.length);
            if (layoutState.isUniform) {
              break;
            }

            const currentZoom = osmd.Zoom > 0 ? osmd.Zoom : 1;
            const nextZoom = Math.max(MIN_OSMD_ZOOM, currentZoom * 0.92);
            if (nextZoom === currentZoom) {
              break;
            }
            osmd.Zoom = nextZoom;
            osmd.updateGraphic();
            osmd.render();
            await waitForDomLayout();
          }
        };

        await tuneLayoutForFixedSystems();
        if (cancelled) return;
        const hasSnapshot = await syncLayout();
        if (cancelled) return;
        if (!hasSnapshot) throw new Error('No playable score layout');

        if (cancelled) return;

        resizeObserverRef.current?.disconnect();
        resizeObserverRef.current = new ResizeObserver((entries) => {
          const observedEntry = entries[0];
          const contentRect = observedEntry?.contentRect;
          if (!contentRect) {
            scheduleLayoutSync();
            return;
          }

          const nextSize = { width: contentRect.width, height: contentRect.height };
          const previousSize = lastObservedContainerSizeRef.current;
          lastObservedContainerSizeRef.current = nextSize;

          if (!previousSize) {
            scheduleLayoutSync();
            return;
          }

          const widthDelta = Math.abs(nextSize.width - previousSize.width);
          const heightDelta = Math.abs(nextSize.height - previousSize.height);
          if (
            widthDelta < MIN_LAYOUT_RESYNC_DELTA_PX &&
            heightDelta < MIN_LAYOUT_RESYNC_DELTA_PX
          ) {
            return;
          }

          scheduleLayoutSync({
            force: widthDelta >= MAJOR_LAYOUT_RESYNC_DELTA_PX,
          });
        });
        resizeObserverRef.current.observe(container);
        window.addEventListener('orientationchange', handleOrientationChange);
        window.visualViewport?.addEventListener('resize', handleOrientationChange);
        if (!cancelled) {
          setIsRendering(false);
          onRenderStatusRef.current?.('ready', renderRevision);
        }
      } catch (error) {
        reportError(error);
      }
    };

    void render();

    return () => {
      cancelled = true;
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
      lastObservedContainerSizeRef.current = null;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.visualViewport?.removeEventListener('resize', handleOrientationChange);
      osmdRef.current = null;
      osmdInstance?.clear();
      container.innerHTML = '';
    };
  }, [musicXml, normalizedMeasuresPerLine, transposeSemitones, renderRevision, publishSnapshot]);

  const activeLayouts =
    measureLayouts.length > 0 ? measureLayouts : lastGoodLayoutsRef.current;

  return (
    <div className="osmd-viewer">
      {hasRenderError && <p className="tempori-error" role="alert">{t('tempori.renderFailed')}</p>}
      <div className={`osmd-viewer-stage${isRendering ? ' osmd-viewer-stage--rendering' : ''}`}>
        {isRendering && (
          <div className="osmd-viewer-loading" role="status" aria-live="polite">
            <span className="osmd-viewer-loading-spinner" aria-hidden />
            <span className="osmd-viewer-loading-text">{t('tempori.rendering')}</span>
          </div>
        )}
        <div ref={containerRef} className="osmd-viewer-canvas" />
        <div className="osmd-viewer-overlay">
          <TemporiPositionHighlight highlight={positionHighlight} visible={showMeasureHighlight} />
          <TemporiPositionHighlight
            highlight={selectionHighlight}
            visible={selectionHighlight !== null}
            variant="selection"
          />
          <TemporiMeasureClickOverlay
            layouts={activeLayouts}
            enabled={measureClickEnabled}
            onMeasureClick={handleMeasureClick}
          />
          <TemporiAnnotationLayer
            temporiId={temporiId}
            containerRef={containerRef}
            tool={annotationTool}
            brushSizes={annotationBrushSizes}
            enabled={annotationsEnabled}
          />
        </div>
      </div>
    </div>
  );
}
