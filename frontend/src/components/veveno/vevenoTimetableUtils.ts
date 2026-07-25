import type { BrewCalendarOccurrence } from '../../types/brew';

export const BREW_HOUR_HEIGHT_PX = 48;

export interface BrewStaffColor {
  bg: string;
  border: string;
  text: string;
}

/**
 * userId 해시 기반 고정 팔레트 — 요일·주·재로그인과 무관하게 동일.
 * 색상환에서 균등하게 떨어진 색조라 서로 확실히 구분된다.
 */
const STAFF_COLOR_HUES = [25, 55, 95, 140, 175, 205, 235, 265, 300, 340] as const;

const STAFF_COLOR_PALETTE: readonly BrewStaffColor[] = STAFF_COLOR_HUES.map((hue) => ({
  bg: `hsla(${hue}, 45%, 48%, 0.26)`,
  border: `hsla(${hue}, 48%, 36%, 0.6)`,
  text: `hsl(${hue}, 50%, 24%)`,
}));

export interface BrewTimetableRange {
  startHour: number;
  endHour: number;
  startMinutes: number;
  totalHeight: number;
  hourLabels: string[];
}

/** 한 근무를 겹침 구간에 따라 쪼갠 세로 조각 */
export interface BrewTimetableSegment {
  occurrence: BrewCalendarOccurrence;
  top: number;
  height: number;
  leftPercent: number;
  widthPercent: number;
  layoutKey: string;
  showLabel: boolean;
  isFirst: boolean;
  isLast: boolean;
}

interface TimedItem {
  occurrence: BrewCalendarOccurrence;
  start: number;
  end: number;
  id: string;
}

function parseTimeToMinutes(raw: string): number {
  const parts = raw.slice(0, 5).split(':');
  const hours = Number(parts[0] ?? 0);
  const minutes = Number(parts[1] ?? 0);
  return hours * 60 + minutes;
}

function getOccurrenceEndMinutes(occ: BrewCalendarOccurrence): number {
  const start = parseTimeToMinutes(occ.startTime);
  let end = parseTimeToMinutes(occ.endTime);
  if (occ.overnight || end <= start) {
    end += 24 * 60;
  }
  return end;
}

/** COVERED_OUT을 제외한 근무 구간 */
function expandWorkSpans(occurrences: BrewCalendarOccurrence[]): TimedItem[] {
  const items: TimedItem[] = [];
  for (const occurrence of occurrences) {
    if (occurrence.type === 'COVERED_OUT') {
      continue;
    }
    const start = parseTimeToMinutes(occurrence.startTime);
    const end = getOccurrenceEndMinutes(occurrence);
    items.push({
      occurrence,
      start,
      end,
      id: `${occurrence.userId}-${occurrence.type}-${occurrence.coverId ?? occurrence.startTime}-${start}`,
    });
  }
  return items;
}

function formatHourLabel(hour: number): string {
  if (hour < 24) {
    return `${String(hour).padStart(2, '0')}:00`;
  }
  return `익일 ${String(hour - 24).padStart(2, '0')}:00`;
}

function buildRange(startHour: number, endHour: number): BrewTimetableRange {
  const hourLabels = Array.from({ length: endHour - startHour }, (_, index) =>
    formatHourLabel(startHour + index),
  );
  return {
    startHour,
    endHour,
    startMinutes: startHour * 60,
    totalHeight: hourLabels.length * BREW_HOUR_HEIGHT_PX,
    hourLabels,
  };
}

function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** userId → 고정 색 (해시만 사용, 로컬 스토리지 불필요) */
export function getBrewStaffColor(userId: string): BrewStaffColor {
  return STAFF_COLOR_PALETTE[hashUserId(userId) % STAFF_COLOR_PALETTE.length]!;
}

/**
 * 직원 명단 전체 기준으로 색을 배정해 같은 매장 안에서 색이 겹치지 않게 한다.
 * 해시 슬롯이 이미 쓰였으면 다음 빈 슬롯으로 밀어낸다(정렬된 명단 기준이라 결정적).
 * 인원이 팔레트(10색)를 넘으면 그때부터는 색이 재사용된다.
 */
export function buildBrewStaffColorMap(userIds: string[]): Map<string, BrewStaffColor> {
  const map = new Map<string, BrewStaffColor>();
  const used = new Set<number>();
  const sorted = [...new Set(userIds)].sort();
  for (const id of sorted) {
    let index = hashUserId(id) % STAFF_COLOR_PALETTE.length;
    if (used.size < STAFF_COLOR_PALETTE.length) {
      while (used.has(index)) {
        index = (index + 1) % STAFF_COLOR_PALETTE.length;
      }
    }
    used.add(index);
    map.set(id, STAFF_COLOR_PALETTE[index]!);
  }
  return map;
}

/** 주간 표시 시간 범위 (근무/대타 기준, 기본 08–22) */
export function getBrewWeekTimetableRange(
  occurrences: BrewCalendarOccurrence[],
): BrewTimetableRange {
  let minStart = Infinity;
  let maxEnd = -Infinity;

  for (const occ of occurrences) {
    if (occ.type === 'COVERED_OUT') {
      continue;
    }
    const start = parseTimeToMinutes(occ.startTime);
    const end = getOccurrenceEndMinutes(occ);
    minStart = Math.min(minStart, start);
    maxEnd = Math.max(maxEnd, end);
  }

  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) {
    return buildRange(8, 22);
  }

  const startHour = Math.max(0, Math.floor(minStart / 60));
  let endHour = Math.min(30, Math.ceil(maxEnd / 60));
  if (endHour <= startHour) {
    endHour = Math.min(30, startHour + 1);
  }
  return buildRange(startHour, endHour);
}

/**
 * 겹치는 구간만 폭을 나누고, 혼자인 구간은 전체 폭.
 * 시작·종료 시각을 경계로 세로 세그먼트를 만든다.
 */
export function layoutBrewDayTimetableBlocks(
  occurrences: BrewCalendarOccurrence[],
  range: BrewTimetableRange,
): BrewTimetableSegment[] {
  const items = expandWorkSpans(occurrences);

  if (items.length === 0) {
    return [];
  }

  const boundaries = new Set<number>();
  for (const item of items) {
    boundaries.add(item.start);
    boundaries.add(item.end);
  }
  const sortedBounds = [...boundaries].sort((a, b) => a - b);

  // 구간마다 (item → column) 배정
  type Slice = { start: number; end: number; columns: Map<string, number>; columnCount: number };
  const slices: Slice[] = [];

  for (let i = 0; i < sortedBounds.length - 1; i += 1) {
    const sliceStart = sortedBounds[i]!;
    const sliceEnd = sortedBounds[i + 1]!;
    const active = items
      .filter((item) => item.start < sliceEnd && item.end > sliceStart)
      .sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id));

    if (active.length === 0) {
      continue;
    }

    const columns = new Map<string, number>();
    active.forEach((item, index) => {
      columns.set(item.id, index);
    });
    slices.push({
      start: sliceStart,
      end: sliceEnd,
      columns,
      columnCount: active.length,
    });
  }

  // 같은 근무의 인접 세그먼트 중 폭·열이 같으면 병합
  const segments: BrewTimetableSegment[] = [];

  for (const item of items) {
    const rawParts: { start: number; end: number; column: number; columnCount: number }[] = [];
    for (const slice of slices) {
      const column = slice.columns.get(item.id);
      if (column === undefined) {
        continue;
      }
      rawParts.push({
        start: slice.start,
        end: slice.end,
        column,
        columnCount: slice.columnCount,
      });
    }

    const merged: typeof rawParts = [];
    for (const part of rawParts) {
      const prev = merged[merged.length - 1];
      if (
        prev
        && prev.end === part.start
        && prev.column === part.column
        && prev.columnCount === part.columnCount
      ) {
        prev.end = part.end;
      } else {
        merged.push({ ...part });
      }
    }

    merged.forEach((part, index) => {
      const top = ((part.start - range.startMinutes) / 60) * BREW_HOUR_HEIGHT_PX;
      const height = Math.max(
        4,
        ((part.end - part.start) / 60) * BREW_HOUR_HEIGHT_PX - (index === merged.length - 1 ? 2 : 0),
      );
      const widthPercent = 100 / part.columnCount;
      segments.push({
        occurrence: item.occurrence,
        top: Math.max(0, top),
        height,
        leftPercent: part.column * widthPercent,
        widthPercent,
        layoutKey: `${item.id}-${part.start}`,
        showLabel: index === 0,
        isFirst: index === 0,
        isLast: index === merged.length - 1,
      });
    });
  }

  return segments;
}

export function occurrencesForDate(
  occurrences: BrewCalendarOccurrence[],
  dateKey: string,
): BrewCalendarOccurrence[] {
  return occurrences.filter((occ) => occ.date === dateKey);
}
