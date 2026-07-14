import type { MeasureTiming } from '../types/scorePractice';

export interface MeasureWindow {
    measureIndex: number;
    startMs: number;
    durationMs: number;
}

const getAttributeNumber = (element: Element, attribute: string, fallback = 0) => {
    const raw = element.getAttribute(attribute);
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const extractDurationSum = (measureElement: Element) => {
    let durationSum = 0;
    const durationNodes = measureElement.querySelectorAll('note > duration');
    durationNodes.forEach((durationNode) => {
        const parsed = Number(durationNode.textContent ?? '0');
        if (Number.isFinite(parsed)) {
            durationSum += parsed;
        }
    });
    return durationSum;
};

export const parseMeasureTimingsFromMusicXml = (musicXmlText: string): MeasureTiming[] => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(musicXmlText, 'application/xml');
    const measureNodes = Array.from(xmlDoc.querySelectorAll('part > measure'));

    let activeDivisions = 1;

    return measureNodes.map((measureNode, index) => {
        const divisionsNode = measureNode.querySelector('attributes > divisions');
        if (divisionsNode?.textContent) {
            const parsedDivisions = Number(divisionsNode.textContent);
            if (Number.isFinite(parsedDivisions) && parsedDivisions > 0) {
                activeDivisions = parsedDivisions;
            }
        }

        return {
            measureIndex: index,
            divisions: activeDivisions,
            durationSum: extractDurationSum(measureNode),
        };
    });
};

export const getMeasureIndexByElapsed = (windows: MeasureWindow[], elapsedMs: number): number => {
    if (windows.length === 0) return 0;
    for (let index = windows.length - 1; index >= 0; index -= 1) {
        if (elapsedMs >= windows[index].startMs) return windows[index].measureIndex;
    }
    return 0;
};

export const getTotalDurationMs = (windows: MeasureWindow[]): number => {
    if (windows.length === 0) return 0;
    const lastWindow = windows[windows.length - 1];
    return lastWindow.startMs + lastWindow.durationMs;
};

export const getElapsedMsForMeasure = (windows: MeasureWindow[], measureIndex: number): number => {
    if (windows.length === 0) return 0;
    const clampedIndex = Math.max(0, Math.min(measureIndex, windows.length - 1));
    const window =
        windows.find((entry) => entry.measureIndex === clampedIndex) ?? windows[clampedIndex];
    return window?.startMs ?? 0;
};

export interface MeasureLayoutInContainer {
    measureIndex: number;
    topPx: number;
    leftPx: number;
    widthPx: number;
    heightPx: number;
    playheadLeftPx?: number;
    playheadWidthPx?: number;
}

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

export const MEASURE_LINE_THRESHOLD_PX = 56;
const MAX_SINGLE_MEASURE_HEIGHT_PX = 260;
const STAFF_CLUSTER_GAP_PX = 120;
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
    '.vf-keysignature',
    '.vf-keySig',
    '.vf-timesignature',
    '.vf-timeSig',
    '.vf-repeat',
].join(', ');

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

const getLineBounds = (line: MeasureLayoutInContainer[]) => {
    const topPx = Math.min(...line.map((layout) => layout.topPx));
    const leftPx = Math.min(...line.map((layout) => layout.leftPx));
    const rightPx = Math.max(...line.map((layout) => layout.leftPx + layout.widthPx));
    const bottomPx = Math.max(...line.map((layout) => layout.topPx + layout.heightPx));

    return {
        topPx,
        leftPx,
        widthPx: Math.max(rightPx - leftPx, 1),
        heightPx: Math.max(bottomPx - topPx, 1),
    };
};

export const computePlayheadHighlight = (
    measureLayouts: MeasureLayoutInContainer[],
    windows: MeasureWindow[],
    elapsedMs: number,
): PlayheadHighlight | null => {
    if (measureLayouts.length === 0 || windows.length === 0) return null;

    const measureIndex = getMeasureIndexByElapsed(windows, elapsedMs);
    const layout =
        measureLayouts.find((entry) => entry.measureIndex === measureIndex) ??
        measureLayouts.reduce<MeasureLayoutInContainer | null>((closest, entry) => {
            if (!closest) return entry;
            const closestDistance = Math.abs(closest.measureIndex - measureIndex);
            const entryDistance = Math.abs(entry.measureIndex - measureIndex);
            return entryDistance < closestDistance ? entry : closest;
        }, null);
    if (!layout) return null;
    const window =
        windows.find((entry) => entry.measureIndex === measureIndex) ??
        windows[Math.min(measureIndex, windows.length - 1)];

    const progressRatio =
        window.durationMs > 0
            ? Math.min(1, Math.max(0, (elapsedMs - window.startMs) / window.durationMs))
            : 0;

    const measureLeftPx = layout.playheadLeftPx ?? layout.leftPx;
    const measureWidthPx = layout.playheadWidthPx ?? layout.widthPx;

    const lines = groupMeasureLayoutsByLine(measureLayouts);
    const activeLine =
        lines.find((line) => line.some((entry) => entry.measureIndex === measureIndex)) ?? [layout];
    const lineBounds = getLineBounds(activeLine);

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

export const parseTimeSignatureFromMusicXml = (
    musicXmlText: string,
    fallback: TimeSignature = DEFAULT_TIME_SIGNATURE,
): TimeSignature => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(musicXmlText, 'application/xml');
    const beatsNode = xmlDoc.querySelector('attributes time beats');
    const beatTypeNode = xmlDoc.querySelector('attributes time beat-type');

    const beats = Number(beatsNode?.textContent ?? fallback.beatsPerMeasure);
    const beatType = Number(beatTypeNode?.textContent ?? fallback.beatType);

    return {
        beatsPerMeasure: Number.isFinite(beats) && beats > 0 ? beats : fallback.beatsPerMeasure,
        beatType: Number.isFinite(beatType) && beatType > 0 ? beatType : fallback.beatType,
    };
};

export const formatTimeSignature = (signature: TimeSignature): string =>
    `${signature.beatsPerMeasure}/${signature.beatType}`;

export const buildMeasureWindows = (
    timings: MeasureTiming[],
    bpm: number,
    beatsPerMeasure: number,
): MeasureWindow[] => {
    const safeBpm = bpm > 0 ? bpm : 120;
    const safeBeats = beatsPerMeasure > 0 ? beatsPerMeasure : DEFAULT_TIME_SIGNATURE.beatsPerMeasure;
    const beatsPerSecond = safeBpm / 60;
    const durationMs = (safeBeats / beatsPerSecond) * 1000;
    const windows: MeasureWindow[] = [];
    let cursorMs = 0;

    timings.forEach((timing, index) => {
        windows.push({
            measureIndex: Number.isFinite(timing.measureIndex) ? timing.measureIndex : index,
            startMs: cursorMs,
            durationMs,
        });
        cursorMs += durationMs;
    });

    return windows;
};

export const parseMeasureIndexFromId = (rawId: string) => {
    const numeric = rawId.match(/\d+/);
    if (!numeric) return null;
    const parsed = Number(numeric[0]);
    if (!Number.isFinite(parsed)) return null;
    return parsed - 1;
};


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
    return parseMeasureIndexFromId(rawId);
};

const isMeasureLayoutCandidate = (element: Element, rect: DOMRect): boolean => {
    if (element.classList.contains('measure-number')) return false;
    if (rect.width < 6 || rect.height < 6) return false;
    if (rect.height > MAX_SINGLE_MEASURE_HEIGHT_PX && rect.width > 320) return false;
    return true;
};

const mergeMeasureLayouts = (layouts: MeasureLayoutInContainer[]): MeasureLayoutInContainer[] => {
    const grouped = new Map<number, MeasureLayoutInContainer[]>();

    layouts.forEach((layout) => {
        const existing = grouped.get(layout.measureIndex) ?? [];
        existing.push(layout);
        grouped.set(layout.measureIndex, existing);
    });

    return Array.from(grouped.entries())
        .map(([measureIndex, parts]) => {
            const sortedParts = [...parts].sort((a, b) => a.topPx - b.topPx);
            const clusters: MeasureLayoutInContainer[][] = [];

            sortedParts.forEach((part) => {
                const matchedCluster = clusters.find(
                    (cluster) => Math.abs(cluster[0].topPx - part.topPx) <= STAFF_CLUSTER_GAP_PX,
                );
                if (matchedCluster) {
                    matchedCluster.push(part);
                    return;
                }
                clusters.push([part]);
            });

            const bestCluster =
                clusters.reduce<MeasureLayoutInContainer[] | null>((best, cluster) => {
                    if (!best) return cluster;
                    const bestArea = best.reduce((sum, item) => sum + item.widthPx * item.heightPx, 0);
                    const clusterArea = cluster.reduce((sum, item) => sum + item.widthPx * item.heightPx, 0);
                    return clusterArea > bestArea ? cluster : best;
                }, null) ?? sortedParts;

            const topPx = Math.min(...bestCluster.map((part) => part.topPx));
            const leftPx = Math.min(...bestCluster.map((part) => part.leftPx));
            const rightPx = Math.max(...bestCluster.map((part) => part.leftPx + part.widthPx));
            const bottomPx = Math.max(...bestCluster.map((part) => part.topPx + part.heightPx));

            return {
                measureIndex,
                topPx,
                leftPx,
                widthPx: Math.max(rightPx - leftPx, 1),
                heightPx: Math.max(Math.min(bottomPx - topPx, MAX_SINGLE_MEASURE_HEIGHT_PX), 1),
            };
        })
        .sort((a, b) => a.measureIndex - b.measureIndex);
};

const collectMeasureTopPairs = (
    container: HTMLElement,
    toTop: (element: Element) => number,
): number[] => {
    const candidates = Array.from(
        container.querySelectorAll<SVGGraphicsElement>(MEASURE_DOM_SELECTORS),
    );

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
    const candidates = Array.from(
        container.querySelectorAll<SVGGraphicsElement>(MEASURE_DOM_SELECTORS),
    );

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
    const candidates = Array.from(
        container.querySelectorAll<SVGGraphicsElement>(MEASURE_DOM_SELECTORS),
    );

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
    let contentStartPx = layout.leftPx;

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

    const maxStartPx = layout.leftPx + layout.widthPx * 0.85;
    const playheadLeftPx = Math.min(Math.max(contentStartPx, layout.leftPx), maxStartPx);
    const playheadWidthPx = Math.max(measureRightPx - playheadLeftPx, 1);

    return { playheadLeftPx, playheadWidthPx };
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
): MeasureLayoutInContainer[] => {
    if (measureCount <= 0) return [];

    const extractedLayouts = extractMeasureLayoutsInContainer(container);
    const minReliableCount = Math.max(1, Math.ceil(measureCount * MIN_EXTRACTED_LAYOUT_RATIO));

    const layouts =
        extractedLayouts.length >= minReliableCount
            ? extractedLayouts
            : estimateMeasureLayoutsInContainer(container, measureCount);

    return refinePlayheadLayouts(container, layouts);
};

export const buildMeasureOffsetsInContainer = (
    container: HTMLElement,
    measureCount: number,
): number[] => {
    const extractedOffsets = extractMeasureOffsets(container);
    const rawMeasureOffsets =
        extractedOffsets.length > 0
            ? extractedOffsets
            : estimateMeasureOffsetsInContainer(container, measureCount);
    return normalizeMeasureScrollOffsets(rawMeasureOffsets);
};

export const estimateMeasureLayoutsInContainer = (
    container: HTMLElement,
    measureCount: number,
): MeasureLayoutInContainer[] => {
    if (measureCount <= 0) return [];

    const totalHeight = Math.max(container.scrollHeight, container.clientHeight, 1);
    const totalWidth = Math.max(container.scrollWidth, container.clientWidth, 1);
    const step = totalHeight / measureCount;

    return Array.from({ length: measureCount }, (_, index) => ({
        measureIndex: index,
        topPx: step * index,
        leftPx: 0,
        widthPx: totalWidth,
        heightPx: step,
    }));
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
