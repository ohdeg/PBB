import type { MeasureTiming } from '../types/scorePractice';
import {
    getActiveTempoChangeForMeasure,
    normalizeTempoChanges,
    type TempoChange,
} from '../types/tempoChange';
import { DEFAULT_MEASURES_PER_LINE, clampMeasuresPerLine } from '../constants/scoreLayout';
import {
    collectUnifiedMeasureGroups,
    getPrimaryMeasureElement,
    parseMusicXmlDocument,
} from './musicXmlMeasures';

export interface MeasureWindow {
    measureIndex: number;
    playbackStepIndex: number;
    startMs: number;
    durationMs: number;
    tempoBpm: number;
    beatsPerMeasure: number;
    beatType: number;
}

export interface MetronomeBeatContext {
    beatIntervalMs: number;
    beatInMeasure: number;
    beatsPerMeasure: number;
    tempoBpm: number;
}

const getAttributeNumber = (element: Element, attribute: string, fallback = 0) => {
    const raw = element.getAttribute(attribute);
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const extractDurationSum = (measureElement: Element) => getMeasureContentDuration(measureElement);

const getMeasureContentDuration = (measureElement: Element): number => {
    let position = 0;
    let maxPosition = 0;

    Array.from(measureElement.childNodes).forEach((child) => {
        if (child.nodeType !== 1) return;
        const element = child as Element;

        const tag = element.nodeName;
        if (tag === 'backup') {
            const backup = Number(element.querySelector('duration')?.textContent ?? 0);
            maxPosition = Math.max(maxPosition, position);
            position = Math.max(0, position - backup);
            return;
        }

        if (tag === 'forward') {
            position += Number(element.querySelector('duration')?.textContent ?? 0);
            maxPosition = Math.max(maxPosition, position);
            return;
        }

        if (tag === 'note' || tag === 'rest') {
            if (element.querySelector('grace')) return;
            const isChord = element.querySelector('chord') !== null;
            const duration = Number(element.querySelector('duration')?.textContent ?? 0);
            if (!isChord) {
                position += duration;
            }
            maxPosition = Math.max(maxPosition, position);
        }
    });

    return Math.max(maxPosition, position);
};

const BEAT_UNIT_TO_QUARTER_FACTOR: Record<string, number> = {
    whole: 0.25,
    half: 0.5,
    quarter: 1,
    eighth: 2,
    '16th': 4,
    '32nd': 8,
    '64th': 16,
    'dotted-half': 0.75,
    'dotted-quarter': 1.5,
    'dotted-eighth': 3,
    'dotted-16th': 6,
};

const FERMATA_HOLD_FACTOR = 2;

const parseMeasureNumber = (rawNumber: string | null): number | null => {
    if (!rawNumber) return null;
    const matched = rawNumber.match(/\d+/);
    if (!matched) return null;
    const parsed = Number(matched[0]);
    return Number.isFinite(parsed) ? parsed : null;
};

const parseTempoFromMeasure = (measureElements: Element[]): number | null => {
    for (const measureElement of measureElements) {
        const sounds = measureElement.querySelectorAll('direction sound[tempo]');
        for (let soundIndex = 0; soundIndex < sounds.length; soundIndex += 1) {
            const tempo = Number(sounds[soundIndex].getAttribute('tempo'));
            if (Number.isFinite(tempo) && tempo > 0) {
                return tempo;
            }
        }

        const metronomes = measureElement.querySelectorAll('direction direction-type metronome');
        for (let metronomeIndex = 0; metronomeIndex < metronomes.length; metronomeIndex += 1) {
            const metronome = metronomes[metronomeIndex];
            const perMinute = Number(metronome.querySelector('per-minute')?.textContent ?? '');
            if (!Number.isFinite(perMinute) || perMinute <= 0) continue;

            const beatUnit = metronome.querySelector('beat-unit')?.textContent?.trim().toLowerCase() ?? 'quarter';
            const isDotted = metronome.querySelector('beat-unit-dot') !== null;
            const beatKey = isDotted ? `dotted-${beatUnit}` : beatUnit;
            const quarterFactor = BEAT_UNIT_TO_QUARTER_FACTOR[beatKey] ?? 1;
            return perMinute * quarterFactor;
        }
    }

    return null;
};

const parseFermataFactor = (measureElements: Element[]): number => {
    let hasFermata = false;

    measureElements.forEach((measureElement) => {
        if (measureElement.querySelector('note notations fermata, rest notations fermata')) {
            hasFermata = true;
        }
    });

    return hasFermata ? FERMATA_HOLD_FACTOR : 1;
};

const getMaxDurationSumAcrossParts = (measureElements: Element[]): number => {
    const durations = measureElements.map((measureElement) => extractDurationSum(measureElement));
    return durations.length > 0 ? Math.max(...durations) : 0;
};

export const computeMeasureDurationMs = (
    timing: MeasureTiming,
    activeTempoBpm: number,
    tempoScale = 1,
): { durationMs: number; tempoUsed: number } => {
    const tempoUsed =
        timing.tempoBpm !== null ? timing.tempoBpm * tempoScale : activeTempoBpm;
    const safeTempo = tempoUsed > 0 ? tempoUsed : 120;
    const divisions = Math.max(timing.divisions, 1);
    const expectedQuarterNotes = timing.expectedDurationDivisions / divisions;
    const contentQuarterNotes = timing.durationSum / divisions;
    const quarterNotes =
        contentQuarterNotes > 0
            ? contentQuarterNotes
            : expectedQuarterNotes > 0
              ? expectedQuarterNotes
              : 1;
    const durationMs = quarterNotes * (60000 / safeTempo) * timing.fermataFactor;

    return {
        durationMs: Math.max(durationMs, 1),
        tempoUsed: safeTempo,
    };
};

export const parseMeasureTimingsFromMusicXml = (musicXmlText: string): MeasureTiming[] => {
    const xmlDoc = parseMusicXmlDocument(musicXmlText);
    const measureGroups = collectUnifiedMeasureGroups(xmlDoc);

    let activeDivisions = 1;
    let activeBeats = DEFAULT_TIME_SIGNATURE.beatsPerMeasure;
    let activeBeatType = DEFAULT_TIME_SIGNATURE.beatType;

    return measureGroups.map((group) => {
        group.elements.forEach((measureElement) => {
            const divisionsNode = measureElement.querySelector('attributes > divisions');
            if (divisionsNode?.textContent) {
                const parsedDivisions = Number(divisionsNode.textContent);
                if (Number.isFinite(parsedDivisions) && parsedDivisions > 0) {
                    activeDivisions = parsedDivisions;
                }
            }

            const beatsNode = measureElement.querySelector('attributes > time > beats');
            const beatTypeNode = measureElement.querySelector('attributes > time > beat-type');
            if (beatsNode?.textContent && beatTypeNode?.textContent) {
                const beats = Number(beatsNode.textContent);
                const beatType = Number(beatTypeNode.textContent);
                if (Number.isFinite(beats) && beats > 0 && Number.isFinite(beatType) && beatType > 0) {
                    activeBeats = beats;
                    activeBeatType = beatType;
                }
            }
        });

        const expectedDurationDivisions = getExpectedMeasureDuration(
            activeBeats,
            activeBeatType,
            activeDivisions,
        );
        const durationSum = getMaxDurationSumAcrossParts(group.elements);
        const pickupTolerance = Math.max(activeDivisions * 0.05, 1);
        const isPickup =
            group.measureIndex === 0 &&
            durationSum > 0 &&
            durationSum + pickupTolerance < expectedDurationDivisions;

        return {
            measureIndex: group.measureIndex,
            measureNumber: parseMeasureNumber(group.measureNumber),
            divisions: activeDivisions,
            durationSum,
            expectedDurationDivisions,
            beatsPerMeasure: activeBeats,
            beatType: activeBeatType,
            tempoBpm: parseTempoFromMeasure(group.elements),
            fermataFactor: parseFermataFactor(group.elements),
            isPickup,
        };
    });
};

export const getActiveMeasureWindow = (
    windows: MeasureWindow[],
    elapsedMs: number,
): MeasureWindow | null => {
    if (windows.length === 0) return null;
    for (let index = windows.length - 1; index >= 0; index -= 1) {
        if (elapsedMs >= windows[index].startMs) {
            return windows[index];
        }
    }
    return windows[0];
};

export const getMetronomeBeatContext = (
    windows: MeasureWindow[],
    elapsedMs: number,
    fallbackBpm: number,
    fallbackBeatsPerMeasure: number,
): MetronomeBeatContext => {
    const safeElapsed = Math.max(0, elapsedMs);
    const fallbackTempo = fallbackBpm > 0 ? fallbackBpm : 120;
    const fallbackBeats = Math.max(fallbackBeatsPerMeasure, 1);
    const fallbackBeatInterval = 60000 / fallbackTempo;

    if (windows.length === 0) {
        const globalBeatIndex = Math.floor(safeElapsed / fallbackBeatInterval);
        return {
            beatIntervalMs: fallbackBeatInterval,
            beatInMeasure: globalBeatIndex % fallbackBeats,
            beatsPerMeasure: fallbackBeats,
            tempoBpm: fallbackTempo,
        };
    }

    const activeWindow = getActiveMeasureWindow(windows, safeElapsed) ?? windows[0];
    const beatsPerMeasure = Math.max(activeWindow.beatsPerMeasure, 1);
    const tempoBpm = activeWindow.tempoBpm > 0 ? activeWindow.tempoBpm : fallbackTempo;
    const beatType = Math.max(activeWindow.beatType, 1);
    const beatIntervalMs = (60000 / tempoBpm) * (4 / beatType);
    const positionInWindow = safeElapsed - activeWindow.startMs;
    const beatInMeasure = Math.floor(positionInWindow / Math.max(beatIntervalMs, 1)) % beatsPerMeasure;

    return {
        beatIntervalMs: Math.max(beatIntervalMs, 1),
        beatInMeasure,
        beatsPerMeasure,
        tempoBpm,
    };
};

export const getMeasureIndexByElapsed = (windows: MeasureWindow[], elapsedMs: number): number => {
    if (windows.length === 0) return 0;
    const windowIndex = getWindowIndexByElapsed(windows, elapsedMs);
    return windows[windowIndex]?.measureIndex ?? 0;
};

export const getPlaybackStepByElapsed = (windows: MeasureWindow[], elapsedMs: number): number => {
    if (windows.length === 0) return 0;
    const windowIndex = getWindowIndexByElapsed(windows, elapsedMs);
    return windows[windowIndex]?.playbackStepIndex ?? 0;
};

export const getTotalDurationMs = (windows: MeasureWindow[]): number => {
    if (windows.length === 0) return 0;
    const lastWindow = windows[windows.length - 1];
    return lastWindow.startMs + lastWindow.durationMs;
};

export const getElapsedMsForMeasure = (windows: MeasureWindow[], measureIndex: number): number => {
    if (windows.length === 0) return 0;
    const window = windows.find((entry) => entry.measureIndex === measureIndex);
    if (window) return window.startMs;
    const clampedIndex = Math.max(0, Math.min(measureIndex, windows.length - 1));
    return windows[clampedIndex]?.startMs ?? 0;
};

export const getSectionPlaybackBounds = (
    windows: MeasureWindow[],
    startMeasureIndex: number,
    endMeasureIndex: number,
): { startMs: number; endMs: number } => {
    if (windows.length === 0) return { startMs: 0, endMs: 0 };

    const startIdx = Math.min(startMeasureIndex, endMeasureIndex);
    const endIdx = Math.max(startMeasureIndex, endMeasureIndex);
    const startMs = getElapsedMsForMeasure(windows, startIdx);

    let endMs = startMs;
    for (const window of windows) {
        if (window.startMs + 0.001 < startMs) continue;
        if (window.measureIndex > endIdx) break;
        if (window.measureIndex >= startIdx && window.measureIndex <= endIdx) {
            endMs = window.startMs + window.durationMs;
        }
    }

    return { startMs, endMs: Math.max(endMs, startMs) };
};

export const clampMeasureRange = (
    startMeasure: number,
    endMeasure: number,
    totalMeasures: number,
): { startMeasure: number; endMeasure: number } => {
    const total = Math.max(totalMeasures, 1);
    let start = Math.max(1, Math.min(Math.trunc(startMeasure) || 1, total));
    let end = Math.max(1, Math.min(Math.trunc(endMeasure) || total, total));
    if (start > end) {
        [start, end] = [end, start];
    }
    return { startMeasure: start, endMeasure: end };
};

export const getCountInDurationMs = (window: MeasureWindow): number => {
    const tempoBpm = window.tempoBpm > 0 ? window.tempoBpm : 120;
    const beatType = Math.max(window.beatType, 1);
    const beatsPerMeasure = Math.max(window.beatsPerMeasure, 1);
    const beatIntervalMs = (60000 / tempoBpm) * (4 / beatType);
    return beatsPerMeasure * beatIntervalMs;
};

export interface MeasureLayoutInContainer {
    measureIndex: number;
    topPx: number;
    leftPx: number;
    widthPx: number;
    heightPx: number;
    playheadLeftPx?: number;
    playheadWidthPx?: number;
    highlightLeftPx?: number;
    highlightWidthPx?: number;
}

export const getMeasureHighlightBounds = (
    layout: MeasureLayoutInContainer,
): { leftPx: number; widthPx: number } => ({
    leftPx: layout.highlightLeftPx ?? layout.leftPx,
    widthPx: layout.highlightWidthPx ?? layout.widthPx,
});

export interface PlayheadHighlight {
    measureIndex: number;
    lineTopPx: number;
    lineLeftPx: number;
    lineWidthPx: number;
    lineHeightPx: number;
    measureLeftPx: number;
    measureWidthPx: number;
    progressRatio: number;
}

export interface PlayheadHighlightLookup {
    layouts: MeasureLayoutInContainer[];
    windows: MeasureWindow[];
    layoutByMeasureIndex: Map<number, MeasureLayoutInContainer>;
    windowByMeasureIndex: Map<number, MeasureWindow>;
    lineBoundsByMeasureIndex: Map<number, { topPx: number; leftPx: number; widthPx: number; heightPx: number }>;
}

export const MEASURE_LINE_THRESHOLD_PX = 56;
const MAX_SINGLE_MEASURE_HEIGHT_PX = 260;
const MIN_EXTRACTED_LAYOUT_RATIO = 0.4;
const NOTE_CONTENT_SELECTORS = [
    '.vf-stavenote',
    '.vf-tabnote',
    '.vf-rest',
    '.vf-ghostnote',
    'g.vf-note',
].join(', ');
const HEADER_SELECTORS = [
    '.vf-clef',
    '.vf-clefs',
    '.vf-keysignature',
    '.vf-keysignatures',
    '.vf-keySig',
    '.vf-timesignature',
    '.vf-timesignatures',
    '.vf-timeSig',
    '.vf-repeat',
].join(', ');
const STAVE_DOM_SELECTOR = '.vf-stave';
const MIN_MEASURE_HIGHLIGHT_WIDTH_PX = 12;

export const waitForDomLayout = (): Promise<void> =>
    new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
        });
    });

const MEASURE_DOM_SELECTORS = [
    'g.vf-measure',
    'g[id*="measure"]',
    'g[id*="Measure"]',
    '[id^="measure-"]',
].join(', ');

export const groupMeasureLayoutsByLine = (
    layouts: MeasureLayoutInContainer[],
    thresholdPx = MEASURE_LINE_THRESHOLD_PX,
): MeasureLayoutInContainer[][] => {
    const sorted = [...layouts].sort((a, b) => a.topPx - b.topPx || a.leftPx - b.leftPx);
    const lines: MeasureLayoutInContainer[][] = [];

    sorted.forEach((layout) => {
        const matchedLine = lines.find(
            (line) => Math.abs(line[0].topPx - layout.topPx) <= thresholdPx,
        );
        if (matchedLine) {
            matchedLine.push(layout);
            return;
        }
        lines.push([layout]);
    });

    return lines;
};

export const getLineIndexForMeasure = (
    measureIndex: number,
    layouts: MeasureLayoutInContainer[],
): number => {
    const lines = groupMeasureLayoutsByLine(layouts);
    return lines.findIndex((line) => line.some((layout) => layout.measureIndex === measureIndex));
};

const getLineBounds = (line: MeasureLayoutInContainer[]) => {
    const topPx = Math.min(...line.map((layout) => layout.topPx));
    const leftPx = Math.min(...line.map((layout) => getMeasureHighlightBounds(layout).leftPx));
    const rightPx = Math.max(
        ...line.map((layout) => {
            const bounds = getMeasureHighlightBounds(layout);
            return bounds.leftPx + bounds.widthPx;
        }),
    );
    const bottomPx = Math.max(...line.map((layout) => layout.topPx + layout.heightPx));

    return {
        topPx,
        leftPx,
        widthPx: Math.max(rightPx - leftPx, 1),
        heightPx: Math.max(bottomPx - topPx, 1),
    };
};

const getWindowIndexByElapsed = (windows: MeasureWindow[], elapsedMs: number): number => {
    if (windows.length === 0) return 0;

    let left = 0;
    let right = windows.length - 1;
    let matched = 0;
    const clampedElapsedMs = Math.max(0, elapsedMs);

    while (left <= right) {
        const middle = Math.floor((left + right) / 2);
        if (windows[middle].startMs <= clampedElapsedMs) {
            matched = middle;
            left = middle + 1;
        } else {
            right = middle - 1;
        }
    }

    return matched;
};

export const createPlayheadHighlightLookup = (
    measureLayouts: MeasureLayoutInContainer[],
    windows: MeasureWindow[],
): PlayheadHighlightLookup => {
    const layoutByMeasureIndex = new Map<number, MeasureLayoutInContainer>();
    measureLayouts.forEach((layout) => {
        layoutByMeasureIndex.set(layout.measureIndex, layout);
    });

    const windowByMeasureIndex = new Map<number, MeasureWindow>();
    windows.forEach((window) => {
        if (!windowByMeasureIndex.has(window.measureIndex)) {
            windowByMeasureIndex.set(window.measureIndex, window);
        }
    });

    const lineBoundsByMeasureIndex = new Map<
        number,
        { topPx: number; leftPx: number; widthPx: number; heightPx: number }
    >();
    groupMeasureLayoutsByLine(measureLayouts).forEach((line) => {
        const lineBounds = getLineBounds(line);
        line.forEach((layout) => {
            lineBoundsByMeasureIndex.set(layout.measureIndex, lineBounds);
        });
    });

    return {
        layouts: measureLayouts,
        windows,
        layoutByMeasureIndex,
        windowByMeasureIndex,
        lineBoundsByMeasureIndex,
    };
};

export const computePlayheadHighlight = (
    measureLayouts: MeasureLayoutInContainer[],
    windows: MeasureWindow[],
    elapsedMs: number,
    lookup?: PlayheadHighlightLookup,
): PlayheadHighlight | null => {
    if (measureLayouts.length === 0 || windows.length === 0) return null;

    const resolvedLayouts = lookup?.layouts ?? measureLayouts;
    const resolvedWindows = lookup?.windows ?? windows;
    const measureIndex = getMeasureIndexByElapsed(resolvedWindows, elapsedMs);
    const layout =
        lookup?.layoutByMeasureIndex.get(measureIndex) ??
        resolvedLayouts.find((entry) => entry.measureIndex === measureIndex) ??
        resolvedLayouts.reduce<MeasureLayoutInContainer | null>((closest, entry) => {
            if (!closest) return entry;
            const closestDistance = Math.abs(closest.measureIndex - measureIndex);
            const entryDistance = Math.abs(entry.measureIndex - measureIndex);
            return entryDistance < closestDistance ? entry : closest;
        }, null);
    if (!layout) return null;
    const window =
        lookup?.windowByMeasureIndex.get(measureIndex) ??
        resolvedWindows.find((entry) => entry.measureIndex === measureIndex) ??
        resolvedWindows[Math.min(measureIndex, resolvedWindows.length - 1)];

    const progressRatio =
        window.durationMs > 0
            ? Math.min(1, Math.max(0, (elapsedMs - window.startMs) / window.durationMs))
            : 0;

    const highlightBounds = getMeasureHighlightBounds(layout);
    const measureLeftPx = highlightBounds.leftPx;
    const measureWidthPx = highlightBounds.widthPx;

    const lineBounds = lookup?.lineBoundsByMeasureIndex.get(measureIndex) ?? getLineBounds([layout]);

    return {
        measureIndex,
        lineTopPx: lineBounds.topPx,
        lineLeftPx: lineBounds.leftPx,
        lineWidthPx: lineBounds.widthPx,
        lineHeightPx: lineBounds.heightPx,
        measureLeftPx,
        measureWidthPx,
        progressRatio,
    };
};

export interface TimeSignature {
    beatsPerMeasure: number;
    beatType: number;
}

export const DEFAULT_TIME_SIGNATURE: TimeSignature = {
    beatsPerMeasure: 4,
    beatType: 4,
};

export const TIME_SIGNATURE_PRESETS: TimeSignature[] = [
    { beatsPerMeasure: 4, beatType: 4 },
    { beatsPerMeasure: 3, beatType: 4 },
    { beatsPerMeasure: 2, beatType: 4 },
    { beatsPerMeasure: 6, beatType: 8 },
    { beatsPerMeasure: 2, beatType: 2 },
];

const getExpectedMeasureDuration = (
    beatsPerMeasure: number,
    beatType: number,
    divisions: number,
): number => beatsPerMeasure * divisions * (4 / beatType);

const TIME_SIGNATURE_INFERENCE_CANDIDATES: TimeSignature[] = [
    ...TIME_SIGNATURE_PRESETS,
    { beatsPerMeasure: 3, beatType: 8 },
    { beatsPerMeasure: 9, beatType: 8 },
    { beatsPerMeasure: 12, beatType: 8 },
    { beatsPerMeasure: 5, beatType: 4 },
    { beatsPerMeasure: 7, beatType: 4 },
    { beatsPerMeasure: 5, beatType: 8 },
    { beatsPerMeasure: 7, beatType: 8 },
];

const inferTimeSignatureFromMeasures = (
    measureNodes: Element[],
    fallback: TimeSignature,
): TimeSignature => {
    let activeDivisions = 1;
    const durations: number[] = [];

    measureNodes.forEach((measureNode) => {
        const divisionsNode = measureNode.querySelector('attributes > divisions');
        if (divisionsNode?.textContent) {
            const parsedDivisions = Number(divisionsNode.textContent);
            if (Number.isFinite(parsedDivisions) && parsedDivisions > 0) {
                activeDivisions = parsedDivisions;
            }
        }

        const duration = getMeasureContentDuration(measureNode);
        if (duration > 0) {
            durations.push(duration);
        }
    });

    if (durations.length === 0 || activeDivisions <= 0) {
        return fallback;
    }

    const sortedDurations = [...durations].sort((left, right) => left - right);
    const medianDuration = sortedDurations[Math.floor(sortedDurations.length / 2)];
    const completeDurations = durations.filter((duration) => duration >= medianDuration * 0.6);
    if (completeDurations.length === 0) {
        return fallback;
    }

    const durationBuckets = new Map<number, number>();
    completeDurations.forEach((duration) => {
        const bucket = Math.round(duration / activeDivisions) * activeDivisions;
        durationBuckets.set(bucket, (durationBuckets.get(bucket) ?? 0) + 1);
    });

    let modalDuration = completeDurations[0];
    let modalCount = 0;
    durationBuckets.forEach((count, duration) => {
        if (count > modalCount) {
            modalCount = count;
            modalDuration = duration;
        }
    });

    let bestMatch = fallback;
    let bestError = Number.POSITIVE_INFINITY;

    TIME_SIGNATURE_INFERENCE_CANDIDATES.forEach((candidate) => {
        const expectedDuration = getExpectedMeasureDuration(
            candidate.beatsPerMeasure,
            candidate.beatType,
            activeDivisions,
        );
        const error = Math.abs(modalDuration - expectedDuration);
        if (error < bestError) {
            bestError = error;
            bestMatch = candidate;
        }
    });

    if (bestError > activeDivisions * 0.5) {
        const quarterNoteCount = modalDuration / activeDivisions;
        const roundedBeats = Math.max(1, Math.min(16, Math.round(quarterNoteCount)));
        return { beatsPerMeasure: roundedBeats, beatType: 4 };
    }

    return bestMatch;
};

export const parseTimeSignatureFromMusicXml = (
    musicXmlText: string,
    fallback: TimeSignature = DEFAULT_TIME_SIGNATURE,
): TimeSignature => {
    const xmlDoc = parseMusicXmlDocument(musicXmlText);
    const beatsNode = xmlDoc.querySelector('attributes time beats');
    const beatTypeNode = xmlDoc.querySelector('attributes time beat-type');

    if (beatsNode?.textContent && beatTypeNode?.textContent) {
        const beats = Number(beatsNode.textContent);
        const beatType = Number(beatTypeNode.textContent);
        if (Number.isFinite(beats) && beats > 0 && Number.isFinite(beatType) && beatType > 0) {
            return {
                beatsPerMeasure: beats,
                beatType,
            };
        }
    }

    const measureGroups = collectUnifiedMeasureGroups(xmlDoc);
    const measureNodes = measureGroups.map((group) => getPrimaryMeasureElement(group));
    return inferTimeSignatureFromMeasures(measureNodes, fallback);
};

export const formatTimeSignature = (signature: TimeSignature): string =>
    `${signature.beatsPerMeasure}/${signature.beatType}`;

export const buildMeasureWindows = (
    timings: MeasureTiming[],
    playbackSequence: number[],
    defaultBpm: number,
    tempoChanges: TempoChange[] = [],
): MeasureWindow[] => {
    const windows: MeasureWindow[] = [];
    let cursorMs = 0;
    let activeTempo = defaultBpm > 0 ? defaultBpm : 120;
    const scoreBaseTempo =
        timings.find((timing) => timing.tempoBpm !== null)?.tempoBpm ?? activeTempo;
    let tempoScale =
        scoreBaseTempo > 0 ? activeTempo / scoreBaseTempo : 1;
    const normalizedTempoChanges = normalizeTempoChanges(
        tempoChanges,
        Math.max(timings.length, 1),
    );

    const sequence =
        playbackSequence.length > 0
            ? playbackSequence
            : timings.map((timing) => timing.measureIndex);

    sequence.forEach((sourceIndex, playbackStepIndex) => {
        const timing =
            timings[sourceIndex] ??
            timings[0] ?? {
                measureIndex: sourceIndex,
                measureNumber: sourceIndex + 1,
                divisions: 1,
                durationSum: 0,
                expectedDurationDivisions: 4,
                beatsPerMeasure: DEFAULT_TIME_SIGNATURE.beatsPerMeasure,
                beatType: DEFAULT_TIME_SIGNATURE.beatType,
                tempoBpm: null,
                fermataFactor: 1,
                isPickup: false,
            };

        const measureNumber = timing.measureNumber ?? sourceIndex + 1;
        const activeTempoChange = getActiveTempoChangeForMeasure(
            normalizedTempoChanges,
            measureNumber,
        );
        let timingForDuration = timing;

        if (activeTempoChange) {
            activeTempo = activeTempoChange.bpm;
            tempoScale = scoreBaseTempo > 0 ? activeTempoChange.bpm / scoreBaseTempo : 1;
            const expectedDurationDivisions = getExpectedMeasureDuration(
                activeTempoChange.beatsPerMeasure,
                activeTempoChange.beatType,
                Math.max(timing.divisions, 1),
            );
            timingForDuration = {
                ...timing,
                tempoBpm: null,
                beatsPerMeasure: activeTempoChange.beatsPerMeasure,
                beatType: activeTempoChange.beatType,
                expectedDurationDivisions,
            };
        }

        const { durationMs, tempoUsed } = computeMeasureDurationMs(
            activeTempoChange ? timingForDuration : timing,
            activeTempo,
            activeTempoChange ? 1 : tempoScale,
        );
        if (timing.tempoBpm !== null && !activeTempoChange) {
            activeTempo = tempoUsed;
        }

        windows.push({
            measureIndex: sourceIndex,
            playbackStepIndex,
            startMs: cursorMs,
            durationMs,
            tempoBpm: tempoUsed,
            beatsPerMeasure: timingForDuration.beatsPerMeasure,
            beatType: timingForDuration.beatType,
        });
        cursorMs += durationMs;
    });

    return windows;
};

export const parseMeasureIndexFromId = (rawId: string): number | null => {
    const trimmed = rawId.trim();
    if (!/^\d+$/.test(trimmed)) return null;

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed - 1;
};

const MEASURE_CLUSTER_GAP_PX = 48;


export const normalizeMeasureScrollOffsets = (offsets: number[]): number[] => {
    if (offsets.length === 0) return [];

    const normalized = [...offsets];
    let lineStart = 0;

    for (let index = 1; index <= normalized.length; index += 1) {
        const isNewLine =
            index === normalized.length ||
            Math.abs(normalized[index] - normalized[lineStart]) > MEASURE_LINE_THRESHOLD_PX;

        if (!isNewLine) continue;

        const lineTop = Math.min(...normalized.slice(lineStart, index));
        for (let lineIndex = lineStart; lineIndex < index; lineIndex += 1) {
            normalized[lineIndex] = lineTop;
        }
        lineStart = index;
    }

    return normalized;
};

export const normalizeMeasureLayoutsByLine = (
    layouts: MeasureLayoutInContainer[],
): MeasureLayoutInContainer[] => {
    if (layouts.length === 0) return [];

    const normalized = layouts
        .map((layout) => ({ ...layout }))
        .sort((a, b) => a.measureIndex - b.measureIndex);

    let lineStart = 0;

    for (let index = 1; index <= normalized.length; index += 1) {
        const isNewLine =
            index === normalized.length ||
            Math.abs(normalized[index].topPx - normalized[lineStart].topPx) > MEASURE_LINE_THRESHOLD_PX;

        if (!isNewLine) continue;

        const lineSlice = normalized.slice(lineStart, index);
        const topPx = Math.min(...lineSlice.map((layout) => layout.topPx));
        const bottomPx = Math.max(...lineSlice.map((layout) => layout.topPx + layout.heightPx));
        const heightPx = Math.max(bottomPx - topPx, 1);

        for (let lineIndex = lineStart; lineIndex < index; lineIndex += 1) {
            normalized[lineIndex] = {
                ...normalized[lineIndex],
                topPx,
                heightPx,
            };
        }

        lineStart = index;
    }

    return normalized;
};

const parseMeasureIndexFromElement = (element: Element): number | null => {
    const rawId = element.getAttribute('id') ?? '';
    const measureMatch = rawId.match(/measure[^\d]*(\d+)/i);
    if (measureMatch) {
        const parsed = Number(measureMatch[1]);
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed - 1;
        }
    }

    if (element.classList.contains('vf-measure')) {
        return parseMeasureIndexFromId(rawId);
    }

    return null;
};

const collectMeasureDomCandidates = (container: HTMLElement): SVGGraphicsElement[] => {
    const vfMeasures = Array.from(container.querySelectorAll<SVGGraphicsElement>('g.vf-measure'));
    const validVfMeasures = vfMeasures.filter((element) => {
        const id = element.getAttribute('id') ?? '';
        return /^\d+$/.test(id) && parseMeasureIndexFromId(id) !== null;
    });

    if (validVfMeasures.length > 0) {
        return validVfMeasures;
    }

    return Array.from(container.querySelectorAll<SVGGraphicsElement>(MEASURE_DOM_SELECTORS));
};

const isMeasureLayoutCandidate = (element: Element, rect: DOMRect): boolean => {
    if (element.classList.contains('measure-number')) return false;
    if (rect.width < 6 || rect.height < 6) return false;
    if (rect.height > MAX_SINGLE_MEASURE_HEIGHT_PX && rect.width > 320) return false;
    return true;
};

const mergeMeasureLayoutParts = (parts: MeasureLayoutInContainer[]): MeasureLayoutInContainer => {
    if (parts.length === 1) return parts[0];

    const sorted = [...parts].sort((left, right) => left.leftPx - right.leftPx);
    const clusters: MeasureLayoutInContainer[][] = [];

    sorted.forEach((part) => {
        const lastCluster = clusters[clusters.length - 1];
        if (!lastCluster) {
            clusters.push([part]);
            return;
        }

        const clusterRight = Math.max(...lastCluster.map((entry) => entry.leftPx + entry.widthPx));
        if (part.leftPx - clusterRight <= MEASURE_CLUSTER_GAP_PX) {
            lastCluster.push(part);
            return;
        }

        clusters.push([part]);
    });

    const mergedClusters = clusters.map((cluster) => {
        const topPx = Math.min(...cluster.map((part) => part.topPx));
        const leftPx = Math.min(...cluster.map((part) => part.leftPx));
        const rightPx = Math.max(...cluster.map((part) => part.leftPx + part.widthPx));
        const bottomPx = Math.max(...cluster.map((part) => part.topPx + part.heightPx));

        return {
            measureIndex: cluster[0].measureIndex,
            topPx,
            leftPx,
            widthPx: Math.max(rightPx - leftPx, 1),
            heightPx: Math.max(bottomPx - topPx, 1),
        };
    });

    const [firstCluster, ...remainingClusters] = mergedClusters;
    return remainingClusters.reduce<MeasureLayoutInContainer>((best, candidate) => {
        if (candidate.leftPx < best.leftPx - 4) return candidate;
        if (best.leftPx < candidate.leftPx - 4) return best;
        return candidate.widthPx < best.widthPx ? candidate : best;
    }, firstCluster);
};

const mergeMeasureLayouts = (layouts: MeasureLayoutInContainer[]): MeasureLayoutInContainer[] => {
    const grouped = new Map<number, MeasureLayoutInContainer[]>();

    layouts.forEach((layout) => {
        const existing = grouped.get(layout.measureIndex) ?? [];
        existing.push(layout);
        grouped.set(layout.measureIndex, existing);
    });

    return Array.from(grouped.entries())
        .map(([, parts]) => mergeMeasureLayoutParts(parts))
        .sort((left, right) => left.measureIndex - right.measureIndex);
};

const clampOutlierMeasureWidths = (
    layouts: MeasureLayoutInContainer[],
    containerWidth: number,
): MeasureLayoutInContainer[] => {
    if (layouts.length === 0 || containerWidth <= 0) return layouts;

    const lines = groupMeasureLayoutsByLine(layouts);
    const clampedByIndex = new Map<number, MeasureLayoutInContainer>();

    lines.forEach((line) => {
        const sortedWidths = [...line.map((layout) => layout.widthPx)].sort((left, right) => left - right);
        const medianWidth = sortedWidths[Math.floor(sortedWidths.length / 2)] ?? sortedWidths[0] ?? containerWidth;
        const perMeasureBudget = containerWidth / Math.max(line.length, 1);
        const maxReasonableWidth = Math.min(
            containerWidth * 0.52,
            Math.max(
                medianWidth * 2.25,
                perMeasureBudget * 1.35,
                MIN_MEASURE_HIGHLIGHT_WIDTH_PX,
            ),
        );

        line.forEach((layout) => {
            if (layout.widthPx <= maxReasonableWidth) {
                clampedByIndex.set(layout.measureIndex, layout);
                return;
            }

            clampedByIndex.set(layout.measureIndex, {
                ...layout,
                widthPx: Math.min(layout.widthPx, maxReasonableWidth),
            });
        });
    });

    return layouts.map((layout) => clampedByIndex.get(layout.measureIndex) ?? layout);
};

const collectMeasureTopPairs = (
    container: HTMLElement,
    toTop: (element: Element) => number,
): number[] => {
    const candidates = collectMeasureDomCandidates(container);

    const pairs: Array<{ index: number; top: number }> = [];

    candidates.forEach((element) => {
        const guessedIndex = parseMeasureIndexFromElement(element);
        if (guessedIndex === null || guessedIndex < 0) return;

        const rect = element.getBoundingClientRect();
        if (!isMeasureLayoutCandidate(element, rect)) return;

        pairs.push({ index: guessedIndex, top: toTop(element) });
    });

    if (pairs.length === 0) return [];

    const deduplicated = new Map<number, number>();
    pairs.forEach(({ index, top }) => {
        const existing = deduplicated.get(index);
        if (existing === undefined || top < existing) {
            deduplicated.set(index, top);
        }
    });

    return Array.from(deduplicated.entries())
        .sort((a, b) => a[0] - b[0])
        .map((entry) => entry[1]);
};

export const extractMeasureOffsets = (container: HTMLElement): number[] => {
    return collectMeasureTopPairs(container, (element) => {
        const rect = element.getBoundingClientRect();
        return rect.top + window.scrollY;
    });
};

const collectMeasureLayoutsInContainer = (container: HTMLElement): MeasureLayoutInContainer[] => {
    const containerRect = container.getBoundingClientRect();
    const candidates = collectMeasureDomCandidates(container);

    const pairs: MeasureLayoutInContainer[] = [];

    candidates.forEach((element) => {
        const guessedIndex = parseMeasureIndexFromElement(element);
        if (guessedIndex === null || guessedIndex < 0) return;

        const rect = element.getBoundingClientRect();
        if (!isMeasureLayoutCandidate(element, rect)) return;

        pairs.push({
            measureIndex: guessedIndex,
            topPx: rect.top - containerRect.top,
            leftPx: rect.left - containerRect.left,
            widthPx: Math.max(rect.width, 1),
            heightPx: Math.max(rect.height, 1),
        });
    });

    if (pairs.length === 0) return [];

    return mergeMeasureLayouts(pairs);
};

export const extractMeasureLayoutsInContainer = (container: HTMLElement): MeasureLayoutInContainer[] =>
    collectMeasureLayoutsInContainer(container);

const getLineStartMeasureIndices = (layouts: MeasureLayoutInContainer[]): Set<number> => {
    const lines = groupMeasureLayoutsByLine(layouts);
    const indices = new Set<number>();

    lines.forEach((line) => {
        if (line.length === 0) return;
        const leftmost = line.reduce(
            (best, entry) => (entry.leftPx < best.leftPx ? entry : best),
            line[0],
        );
        indices.add(leftmost.measureIndex);
    });

    return indices;
};

const findMeasureElement = (
    container: HTMLElement,
    measureIndex: number,
): SVGGraphicsElement | null => {
    const candidates = collectMeasureDomCandidates(container);

    for (const element of candidates) {
        if (parseMeasureIndexFromElement(element) === measureIndex) {
            return element;
        }
    }

    return null;
};

const computePlayheadBounds = (
    measureElement: Element,
    containerRect: DOMRect,
    layout: MeasureLayoutInContainer,
): { playheadLeftPx: number; playheadWidthPx: number } => {
    const measureRightPx = layout.leftPx + layout.widthPx;
    const contentStartPx = getContentStartAfterHeaders(measureElement, containerRect, layout.leftPx);
    const maxStartPx = layout.leftPx + layout.widthPx * 0.85;
    const playheadLeftPx = Math.min(Math.max(contentStartPx, layout.leftPx), maxStartPx);
    const playheadWidthPx = Math.max(measureRightPx - playheadLeftPx, 1);

    return { playheadLeftPx, playheadWidthPx };
};

const getContentStartAfterHeaders = (
    measureElement: Element,
    containerRect: DOMRect,
    layoutLeftPx: number,
): number => {
    let contentStartPx = layoutLeftPx;

    measureElement.querySelectorAll(HEADER_SELECTORS).forEach((header) => {
        const rect = header.getBoundingClientRect();
        if (rect.width > 0) {
            contentStartPx = Math.max(contentStartPx, rect.right - containerRect.left);
        }
    });

    let minNoteLeftPx = Infinity;
    measureElement.querySelectorAll(NOTE_CONTENT_SELECTORS).forEach((note) => {
        const rect = note.getBoundingClientRect();
        if (rect.width < 2) return;
        minNoteLeftPx = Math.min(minNoteLeftPx, rect.left - containerRect.left);
    });

    if (Number.isFinite(minNoteLeftPx)) {
        contentStartPx = Math.max(contentStartPx, minNoteLeftPx);
    }

    return contentStartPx;
};

const computeHighlightBoundsFromMeasureElement = (
    measureElement: Element,
    containerRect: DOMRect,
    layout: MeasureLayoutInContainer,
    isLineStart: boolean,
): { highlightLeftPx: number; highlightWidthPx: number } => {
    const measureRightPx = layout.leftPx + layout.widthPx;
    let rightPx = measureRightPx;

    const staves = measureElement.querySelectorAll(STAVE_DOM_SELECTOR);
    if (staves.length > 0) {
        let staveRight = -Infinity;

        staves.forEach((stave) => {
            const rect = stave.getBoundingClientRect();
            if (rect.width < 4 || rect.height < 4) return;
            staveRight = Math.max(staveRight, rect.right - containerRect.left);
        });

        if (staveRight > layout.leftPx) {
            rightPx = staveRight;
        }
    }

    let leftPx = layout.leftPx;

    if (isLineStart) {
        const contentStartPx = getContentStartAfterHeaders(measureElement, containerRect, layout.leftPx);
        const maxStartPx = layout.leftPx + layout.widthPx * 0.85;
        leftPx = Math.min(Math.max(contentStartPx, layout.leftPx), maxStartPx);
    } else if (staves.length > 0) {
        let staveLeft = Infinity;

        staves.forEach((stave) => {
            const rect = stave.getBoundingClientRect();
            if (rect.width < 4 || rect.height < 4) return;
            staveLeft = Math.min(staveLeft, rect.left - containerRect.left);
        });

        if (Number.isFinite(staveLeft)) {
            leftPx = staveLeft;
        }
    }

    rightPx = Math.max(rightPx, leftPx + MIN_MEASURE_HIGHLIGHT_WIDTH_PX);

    return {
        highlightLeftPx: leftPx,
        highlightWidthPx: Math.max(rightPx - leftPx, MIN_MEASURE_HIGHLIGHT_WIDTH_PX),
    };
};

const snapHighlightBoundsOnLine = (line: MeasureLayoutInContainer[]): MeasureLayoutInContainer[] => {
    const sorted = [...line].sort((a, b) => a.measureIndex - b.measureIndex);
    const entries = sorted.map((layout) => {
        const bounds = getMeasureHighlightBounds(layout);
        return {
            layout,
            left: bounds.leftPx,
            right: bounds.leftPx + bounds.widthPx,
        };
    });

    for (let index = 1; index < entries.length; index += 1) {
        entries[index].left = Math.max(entries[index].left, entries[index - 1].right);
        entries[index].right = Math.max(
            entries[index].right,
            entries[index].left + MIN_MEASURE_HIGHLIGHT_WIDTH_PX,
        );
    }

    for (let index = entries.length - 2; index >= 0; index -= 1) {
        entries[index].right = Math.min(entries[index].right, entries[index + 1].left);
        entries[index].left = Math.min(
            entries[index].left,
            entries[index].right - MIN_MEASURE_HIGHLIGHT_WIDTH_PX,
        );
    }

    return entries.map(({ layout, left, right }) => ({
        ...layout,
        highlightLeftPx: left,
        highlightWidthPx: Math.max(right - left, MIN_MEASURE_HIGHLIGHT_WIDTH_PX),
    }));
};

const refineMeasureVerticalBounds = (
    container: HTMLElement,
    layouts: MeasureLayoutInContainer[],
): MeasureLayoutInContainer[] => {
    if (layouts.length === 0) return layouts;

    const containerRect = container.getBoundingClientRect();

    return layouts.map((layout) => {
        const measureElement = findMeasureElement(container, layout.measureIndex);
        if (!measureElement) return layout;

        const staves = measureElement.querySelectorAll(STAVE_DOM_SELECTOR);
        if (staves.length === 0) return layout;

        let topPx = Infinity;
        let bottomPx = -Infinity;

        staves.forEach((stave) => {
            const rect = stave.getBoundingClientRect();
            if (rect.height < 4) return;
            topPx = Math.min(topPx, rect.top - containerRect.top);
            bottomPx = Math.max(bottomPx, rect.bottom - containerRect.top);
        });

        if (!Number.isFinite(topPx) || bottomPx <= topPx) return layout;

        return {
            ...layout,
            topPx,
            heightPx: Math.max(bottomPx - topPx, 1),
        };
    });
};

const refineMeasureHighlightLayouts = (
    container: HTMLElement,
    layouts: MeasureLayoutInContainer[],
): MeasureLayoutInContainer[] => {
    if (layouts.length === 0) return layouts;

    const lineStartIndices = getLineStartMeasureIndices(layouts);
    const containerRect = container.getBoundingClientRect();
    const withHighlight = layouts.map((layout) => {
        const measureElement = findMeasureElement(container, layout.measureIndex);
        if (!measureElement) {
            return {
                ...layout,
                highlightLeftPx: layout.leftPx,
                highlightWidthPx: layout.widthPx,
            };
        }

        const bounds = computeHighlightBoundsFromMeasureElement(
            measureElement,
            containerRect,
            layout,
            lineStartIndices.has(layout.measureIndex),
        );
        return {
            ...layout,
            highlightLeftPx: bounds.highlightLeftPx,
            highlightWidthPx: bounds.highlightWidthPx,
        };
    });

    const lines = groupMeasureLayoutsByLine(withHighlight);
    const snappedByIndex = new Map<number, MeasureLayoutInContainer>();
    lines.forEach((line) => {
        snapHighlightBoundsOnLine(line).forEach((layout) => {
            snappedByIndex.set(layout.measureIndex, layout);
        });
    });

    return withHighlight.map((layout) => snappedByIndex.get(layout.measureIndex) ?? layout);
};

const refinePlayheadLayouts = (
    container: HTMLElement,
    layouts: MeasureLayoutInContainer[],
): MeasureLayoutInContainer[] => {
    if (layouts.length === 0) return layouts;

    const lineStartIndices = getLineStartMeasureIndices(layouts);
    const containerRect = container.getBoundingClientRect();

    return layouts.map((layout) => {
        if (!lineStartIndices.has(layout.measureIndex)) {
            return layout;
        }

        const measureElement = findMeasureElement(container, layout.measureIndex);
        if (!measureElement) {
            return layout;
        }

        const bounds = computePlayheadBounds(measureElement, containerRect, layout);
        return {
            ...layout,
            playheadLeftPx: bounds.playheadLeftPx,
            playheadWidthPx: bounds.playheadWidthPx,
        };
    });
};

export const resolveMeasureLayoutsInContainer = (
    container: HTMLElement,
    measureCount: number,
    measuresPerLine: number = DEFAULT_MEASURES_PER_LINE,
): MeasureLayoutInContainer[] => {
    if (measureCount <= 0) return [];

    const extractedLayouts = extractMeasureLayoutsInContainer(container);
    const minReliableCount = Math.max(1, Math.ceil(measureCount * MIN_EXTRACTED_LAYOUT_RATIO));

    const layouts =
        extractedLayouts.length >= minReliableCount
            ? extractedLayouts
            : estimateMeasureLayoutsInContainer(container, measureCount, measuresPerLine);

    const normalizedLayouts = clampOutlierMeasureWidths(
        normalizeMeasureLayoutsByLine(refineMeasureVerticalBounds(container, layouts)),
        container.getBoundingClientRect().width,
    );

    return refineMeasureHighlightLayouts(container, refinePlayheadLayouts(container, normalizedLayouts));
};

export const buildMeasureOffsetsInContainer = (
    container: HTMLElement,
    measureCount: number,
    measuresPerLine: number = DEFAULT_MEASURES_PER_LINE,
): number[] => {
    const layouts = resolveMeasureLayoutsInContainer(container, measureCount, measuresPerLine);
    if (layouts.length > 0) {
        const normalizedLayouts = normalizeMeasureLayoutsByLine(layouts);
        const containerDocTop = container.getBoundingClientRect().top + window.scrollY;
        const offsets = Array.from({ length: measureCount }, (_, index) => {
            const layout = normalizedLayouts.find((entry) => entry.measureIndex === index);
            if (layout) {
                return containerDocTop + layout.topPx;
            }
            return 0;
        });

        let lastKnownOffset = offsets.find((offset) => offset > 0) ?? 0;
        for (let index = 0; index < offsets.length; index += 1) {
            if (offsets[index] > 0) {
                lastKnownOffset = offsets[index];
                continue;
            }
            offsets[index] = lastKnownOffset;
        }

        return normalizeMeasureScrollOffsets(offsets);
    }

    const extractedOffsets = extractMeasureOffsets(container);
    const rawMeasureOffsets =
        extractedOffsets.length > 0
            ? extractedOffsets
            : estimateMeasureOffsets(container, measureCount);
    return normalizeMeasureScrollOffsets(rawMeasureOffsets);
};

export const estimateMeasureLayoutsInContainer = (
    container: HTMLElement,
    measureCount: number,
    measuresPerLine: number = DEFAULT_MEASURES_PER_LINE,
): MeasureLayoutInContainer[] => {
    if (measureCount <= 0) return [];

    const totalHeight = Math.max(container.scrollHeight, container.clientHeight, 1);
    const totalWidth = Math.max(container.scrollWidth, container.clientWidth, 1);
    const normalizedMeasuresPerLine = clampMeasuresPerLine(measuresPerLine);
    const lineCount = Math.max(1, Math.ceil(measureCount / normalizedMeasuresPerLine));
    const lineHeight = totalHeight / lineCount;
    const measureWidth = totalWidth / normalizedMeasuresPerLine;

    return Array.from({ length: measureCount }, (_, index) => {
        const lineIndex = Math.floor(index / normalizedMeasuresPerLine);
        const columnIndex = index % normalizedMeasuresPerLine;

        return {
            measureIndex: index,
            topPx: lineHeight * lineIndex,
            leftPx: measureWidth * columnIndex,
            widthPx: measureWidth,
            heightPx: lineHeight,
        };
    });
};

export const extractMeasureOffsetsInContainer = (container: HTMLElement): number[] =>
    collectMeasureLayoutsInContainer(container).map((layout) => layout.topPx);

export const estimateMeasureOffsetsInContainer = (container: HTMLElement, measureCount: number): number[] => {
    if (measureCount <= 0) return [];
    const totalHeight = Math.max(container.scrollHeight, container.clientHeight, 1);
    const step = totalHeight / measureCount;
    return Array.from({ length: measureCount }, (_, index) => step * index);
};

export const estimateMeasureOffsets = (container: HTMLElement, measureCount: number): number[] => {
    if (measureCount <= 0) return [];
    const rect = container.getBoundingClientRect();
    const startY = rect.top + window.scrollY;
    const totalHeight = Math.max(rect.height, 1);
    const step = totalHeight / measureCount;
    return Array.from({ length: measureCount }, (_, index) => startY + step * index);
};

export const getOsmdZoom = (container: HTMLElement, fallback = 1) => {
    const zoom = getAttributeNumber(container, 'data-osmd-zoom', fallback);
    return zoom > 0 ? zoom : fallback;
};
