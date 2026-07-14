import { clampBeatCount } from './beatStrength';

export type BeatSubdivisionId =
  | 'quarter'
  | 'eighth-pair'
  | 'eighth-rest-eighth'
  | 'triplet-three'
  | 'triplet-rest-two'
  | 'triplet-one-rest-one'
  | 'triplet-two-rest'
  | 'sixteenth-four'
  | 'sixteenth-syncopated'
  | 'two-sixteenth-eighth'
  | 'eighth-two-sixteenth'
  | 'dotted-eighth-sixteenth'
  | 'sixteenth-dotted-eighth'
  | 'triplet-beam';

export interface SubdivisionSlot {
  offset: number;
  play: boolean;
}

export interface SubdivisionPattern {
  id: BeatSubdivisionId;
  label: string;
  page: 0 | 1;
  slots: SubdivisionSlot[];
}

export const BEAT_SUBDIVISION_PATTERNS: SubdivisionPattern[] = [
  {
    id: 'quarter',
    label: '4분음표',
    page: 0,
    slots: [{ offset: 0, play: true }],
  },
  {
    id: 'eighth-pair',
    label: '8분 2개',
    page: 0,
    slots: [
      { offset: 0, play: true },
      { offset: 0.5, play: true },
    ],
  },
  {
    id: 'eighth-rest-eighth',
    label: '8분쉼 + 8분',
    page: 0,
    slots: [
      { offset: 0, play: false },
      { offset: 0.5, play: true },
    ],
  },
  {
    id: 'triplet-three',
    label: '8분 3연음',
    page: 0,
    slots: [
      { offset: 0, play: true },
      { offset: 1 / 3, play: true },
      { offset: 2 / 3, play: true },
    ],
  },
  {
    id: 'triplet-rest-two',
    label: '3연음 쉼+2음',
    page: 0,
    slots: [
      { offset: 0, play: false },
      { offset: 1 / 3, play: true },
      { offset: 2 / 3, play: true },
    ],
  },
  {
    id: 'triplet-one-rest-one',
    label: '3연음 1-쉼-1',
    page: 0,
    slots: [
      { offset: 0, play: true },
      { offset: 1 / 3, play: false },
      { offset: 2 / 3, play: true },
    ],
  },
  {
    id: 'triplet-two-rest',
    label: '3연음 2음+쉼',
    page: 0,
    slots: [
      { offset: 0, play: true },
      { offset: 1 / 3, play: true },
      { offset: 2 / 3, play: false },
    ],
  },
  {
    id: 'two-sixteenth-eighth',
    label: '16분2 + 8분',
    page: 0,
    slots: [
      { offset: 0, play: true },
      { offset: 0.25, play: true },
      { offset: 0.5, play: true },
    ],
  },
  {
    id: 'sixteenth-syncopated',
    label: '16분 싱코페이션',
    page: 1,
    slots: [
      { offset: 0, play: false },
      { offset: 0.25, play: true },
      { offset: 0.5, play: false },
      { offset: 0.75, play: true },
    ],
  },
  {
    id: 'sixteenth-four',
    label: '16분 4개',
    page: 1,
    slots: [
      { offset: 0, play: true },
      { offset: 0.25, play: true },
      { offset: 0.5, play: true },
      { offset: 0.75, play: true },
    ],
  },
  {
    id: 'eighth-two-sixteenth',
    label: '8분 + 16분2',
    page: 1,
    slots: [
      { offset: 0, play: true },
      { offset: 0.5, play: true },
      { offset: 0.75, play: true },
    ],
  },
  {
    id: 'dotted-eighth-sixteenth',
    label: '점8분 + 16분',
    page: 1,
    slots: [
      { offset: 0, play: true },
      { offset: 0.75, play: true },
    ],
  },
  {
    id: 'sixteenth-dotted-eighth',
    label: '16분 + 점8분',
    page: 1,
    slots: [
      { offset: 0, play: true },
      { offset: 0.25, play: true },
    ],
  },
  {
    id: 'triplet-beam',
    label: '3연음 변형',
    page: 1,
    slots: [
      { offset: 0, play: true },
      { offset: 0.333, play: true },
      { offset: 0.666, play: true },
    ],
  },
];

const PATTERN_MAP = new Map(BEAT_SUBDIVISION_PATTERNS.map((pattern) => [pattern.id, pattern]));

export const DEFAULT_BEAT_SUBDIVISION: BeatSubdivisionId = 'quarter';

export function getSubdivisionPattern(id: BeatSubdivisionId): SubdivisionPattern {
  return PATTERN_MAP.get(id) ?? PATTERN_MAP.get(DEFAULT_BEAT_SUBDIVISION)!;
}

export function getSubdivisionPatternsByPage(page: 0 | 1): SubdivisionPattern[] {
  return BEAT_SUBDIVISION_PATTERNS.filter((pattern) => pattern.page === page);
}

export function createDefaultBeatSubdivisions(beatsPerMeasure: number): BeatSubdivisionId[] {
  const count = clampBeatCount(beatsPerMeasure);
  return Array.from({ length: count }, () => DEFAULT_BEAT_SUBDIVISION);
}

export function resizeBeatSubdivisions(
  current: BeatSubdivisionId[],
  beatsPerMeasure: number,
): BeatSubdivisionId[] {
  const count = clampBeatCount(beatsPerMeasure);
  return Array.from({ length: count }, (_, index) => current[index] ?? DEFAULT_BEAT_SUBDIVISION);
}

export function parseBeatSubdivisionId(value: string | null): BeatSubdivisionId | null {
  if (value && PATTERN_MAP.has(value as BeatSubdivisionId)) {
    return value as BeatSubdivisionId;
  }
  return null;
}
