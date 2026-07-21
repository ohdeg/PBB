import * as XLSX from 'xlsx';
import type { BrewCalendarOccurrence, BrewOccurrenceType } from '../../types/brew';

export interface MonthlyJournalExportInput {
  storeName: string;
  year: number;
  /** 1–12 */
  month: number;
  occurrences: BrewCalendarOccurrence[];
}

interface JournalShift {
  date: string;
  dayOfMonth: number;
  nickname: string;
  userId: string;
  startTime: string;
  endTime: string;
  overnight: boolean;
  typeLabel: string;
  minutes: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDateKey(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** 월요일 시작 주의 시작일 */
function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function formatTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function timeToMinutes(t: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(t);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** 근무 구간 분 수. overnight이거나 end ≤ start 이면 자정 넘김 */
export function occurrenceDurationMinutes(
  startTime: string,
  endTime: string,
  overnight: boolean,
): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start == null || end == null) {
    return 0;
  }
  if (overnight || end <= start) {
    return end + 24 * 60 - start;
  }
  return end - start;
}

function typeLabel(type: BrewOccurrenceType): string | null {
  switch (type) {
    case 'REGULAR':
      return '정규';
    case 'COVER':
      return '대타';
    case 'EXTRA':
      return '추가';
    case 'COVERED_OUT':
      return null;
    default:
      return null;
  }
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${pad2(m)}`;
}

function sanitizeFilePart(name: string): string {
  const trimmed = name.trim().replace(/[\\/:*?"<>|]+/g, '_');
  return trimmed.length > 0 ? trimmed : 'store';
}

function formatShiftCell(shift: JournalShift): string {
  const range = shift.overnight
    ? `${shift.startTime}–${shift.endTime}(익일)`
    : `${shift.startTime}–${shift.endTime}`;
  if (shift.typeLabel === '정규') {
    return range;
  }
  return `${range}(${shift.typeLabel})`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function buildShifts(
  occurrences: BrewCalendarOccurrence[],
  year: number,
  month: number,
): JournalShift[] {
  const shifts: JournalShift[] = [];
  for (const occ of occurrences) {
    const label = typeLabel(occ.type);
    if (!label) {
      continue;
    }
    const date = parseDateKey(occ.date);
    if (!date || date.getFullYear() !== year || date.getMonth() + 1 !== month) {
      continue;
    }
    const start = formatTime(occ.startTime);
    const end = formatTime(occ.endTime);
    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);
    const overnight =
      occ.overnight ||
      (startMin != null && endMin != null && endMin <= startMin);

    shifts.push({
      date: occ.date,
      dayOfMonth: date.getDate(),
      nickname: occ.nickname,
      userId: occ.userId,
      startTime: start,
      endTime: end,
      overnight,
      typeLabel: label,
      minutes: occurrenceDurationMinutes(occ.startTime, occ.endTime, occ.overnight),
    });
  }
  shifts.sort((a, b) => {
    if (a.dayOfMonth !== b.dayOfMonth) {
      return a.dayOfMonth - b.dayOfMonth;
    }
    if (a.startTime !== b.startTime) {
      return a.startTime.localeCompare(b.startTime);
    }
    return a.nickname.localeCompare(b.nickname, 'ko');
  });
  return shifts;
}

/** 근무자 × 1일~말일 + 총 근무시간 */
function buildStaffDaySheet(
  shifts: JournalShift[],
  year: number,
  month: number,
  storeName: string,
): (string | number)[][] {
  const lastDay = daysInMonth(year, month);
  const byUser = new Map<
    string,
    {
      nickname: string;
      totalMinutes: number;
      dayCells: Map<number, JournalShift[]>;
    }
  >();

  for (const shift of shifts) {
    let entry = byUser.get(shift.userId);
    if (!entry) {
      entry = {
        nickname: shift.nickname,
        totalMinutes: 0,
        dayCells: new Map(),
      };
      byUser.set(shift.userId, entry);
    }
    entry.totalMinutes += shift.minutes;
    const list = entry.dayCells.get(shift.dayOfMonth) ?? [];
    list.push(shift);
    entry.dayCells.set(shift.dayOfMonth, list);
  }

  const header: (string | number)[] = [
    '근무자',
    ...Array.from({ length: lastDay }, (_, i) => i + 1),
    '총 근무시간',
  ];

  const body: (string | number)[][] = [
    ['가게', storeName],
    ['기간', `${year}년 ${month}월`],
    [],
    header,
  ];

  const sorted = [...byUser.values()].sort((a, b) =>
    a.nickname.localeCompare(b.nickname, 'ko'),
  );

  for (const entry of sorted) {
    const dayValues: string[] = [];
    for (let day = 1; day <= lastDay; day += 1) {
      const dayShifts = entry.dayCells.get(day);
      if (!dayShifts || dayShifts.length === 0) {
        dayValues.push('—');
        continue;
      }
      dayValues.push(dayShifts.map(formatShiftCell).join(' / '));
    }
    body.push([entry.nickname, ...dayValues, formatHours(entry.totalMinutes)]);
  }

  if (sorted.length === 0) {
    body.push([
      '(해당 월 근무 없음)',
      ...Array.from({ length: lastDay }, () => '—'),
      '0:00',
    ]);
  }

  return body;
}

interface WeekColumn {
  key: string;
  label: string;
}

function buildWeekColumns(year: number, month: number): WeekColumn[] {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const columns: WeekColumn[] = [];
  let cursor = startOfWeekMonday(monthStart);
  while (cursor <= monthEnd) {
    const weekEnd = addDays(cursor, 6);
    const from = cursor < monthStart ? monthStart : cursor;
    const to = weekEnd > monthEnd ? monthEnd : weekEnd;
    columns.push({
      key: toDateKey(cursor),
      label: `${from.getMonth() + 1}/${from.getDate()}–${to.getMonth() + 1}/${to.getDate()}`,
    });
    cursor = addDays(cursor, 7);
  }
  return columns;
}

function buildSummarySheet(
  shifts: JournalShift[],
  year: number,
  month: number,
): (string | number)[][] {
  const weeks = buildWeekColumns(year, month);
  const byUser = new Map<
    string,
    { nickname: string; total: number; weekMinutes: Map<string, number> }
  >();

  for (const shift of shifts) {
    let entry = byUser.get(shift.userId);
    if (!entry) {
      entry = {
        nickname: shift.nickname,
        total: 0,
        weekMinutes: new Map(weeks.map((w) => [w.key, 0])),
      };
      byUser.set(shift.userId, entry);
    }
    entry.total += shift.minutes;
    const date = parseDateKey(shift.date);
    if (!date) {
      continue;
    }
    const weekKey = toDateKey(startOfWeekMonday(date));
    entry.weekMinutes.set(
      weekKey,
      (entry.weekMinutes.get(weekKey) ?? 0) + shift.minutes,
    );
  }

  const header: string[] = [
    '근무자',
    '기간 총 근무시간',
    ...weeks.map((w) => `주간 ${w.label}`),
  ];
  const body: (string | number)[][] = [header];

  const sorted = [...byUser.values()].sort((a, b) =>
    a.nickname.localeCompare(b.nickname, 'ko'),
  );
  for (const entry of sorted) {
    body.push([
      entry.nickname,
      formatHours(entry.total),
      ...weeks.map((w) => formatHours(entry.weekMinutes.get(w.key) ?? 0)),
    ]);
  }
  if (sorted.length === 0) {
    body.push(['(해당 월 근무 없음)', '0:00', ...weeks.map(() => '0:00')]);
  }
  return body;
}

/**
 * 월간 근무 일지 엑셀 다운로드.
 * - 일지: 근무자 행 × 1일~말일 + 총 근무시간
 * - 직원별 요약: 기간 총 + 월요일 시작 주간별
 * COVERED_OUT 제외.
 */
export function downloadMonthlyWorkJournal(input: MonthlyJournalExportInput): void {
  const { storeName, year, month, occurrences } = input;
  const shifts = buildShifts(occurrences, year, month);

  const journalAoA = buildStaffDaySheet(shifts, year, month, storeName);
  const summaryAoA = buildSummarySheet(shifts, year, month);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(journalAoA),
    '일지',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(summaryAoA),
    '직원별 요약',
  );

  const ym = `${year}-${pad2(month)}`;
  const filename = `Veveno_${sanitizeFilePart(storeName)}_${ym}_근무일지.xlsx`;
  XLSX.writeFile(workbook, filename);
}
