import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { brewApi } from '../../api/brewApi';
import { useAuthStore } from '../../stores/authStore';
import type {
  BrewCalendarOccurrence,
  BrewCover,
  BrewSchedule,
  BrewScheduleSlotInput,
  BrewShiftKind,
} from '../../types/brew';
import { getErrorMessage } from '../../utils/error';
import { BrewButton } from './BrewButton';
import { BrewCard } from './BrewCard';
import { BrewInput } from './BrewInput';
import { downloadMonthlyWorkJournal } from './brewMonthlyJournalExport';
import BrewWeekTimelineView from './BrewWeekTimelineView';

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;

type ViewMode = 'week' | 'month';

interface BrewStaffMember {
  userId: string;
  nickname: string;
}

interface BrewSchedulePanelProps {
  storeId: string;
  storeName: string;
  owned: boolean;
  subscribed: boolean;
  onError: (message: string) => void;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function formatTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t;
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

/** YYYY-MM-DD → ISO dayOfWeek (1=월 … 7=일) */
function isoDayOfWeekFromDateKey(dateKey: string): number | null {
  const date = parseDateKey(dateKey);
  return date ? ((date.getDay() + 6) % 7) + 1 : null;
}

function isoDayOfWeek(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

function timeToMinutes(t: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(t);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** 근무 구간을 [시작ms, 종료ms)로 변환. 종료 ≤ 시작이면 자정 넘김으로 처리 */
function shiftRangeMs(base: Date, startTime: string, endTime: string): [number, number] | null {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start == null || end == null) {
    return null;
  }
  const overnightEnd = end <= start ? end + 24 * 60 : end;
  return [base.getTime() + start * 60_000, base.getTime() + overnightEnd * 60_000];
}

function rangesOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

function monthVisibleOccurrences(
  items: BrewCalendarOccurrence[],
): BrewCalendarOccurrence[] {
  return items.filter((occ) => occ.type !== 'COVERED_OUT');
}

function monthChipLabel(occ: BrewCalendarOccurrence): string {
  const time = `${formatTime(occ.startTime)}–${formatTime(occ.endTime)}${
    occ.overnight ? ' (익일)' : ''
  }`;
  if (occ.type === 'EXTRA') {
    return `${occ.nickname} 추가 ${time}`;
  }
  return `${occ.nickname} ${time}`;
}

const MONTH_PREVIEW_COUNT = 4;

function shiftKindLabel(kind: BrewShiftKind): string {
  return kind === 'EXTRA' ? '추가' : '대체';
}

interface ScheduleSlotState {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

function emptySlot(): ScheduleSlotState {
  return {
    enabled: false,
    startTime: '09:00',
    endTime: '18:00',
  };
}

function coverStatusLabel(status: string, kind: BrewShiftKind = 'COVER'): string {
  switch (status) {
    case 'PENDING_OWNER':
      return kind === 'EXTRA' ? '업주 승인 대기' : '업주 대타자 지정 대기';
    case 'PENDING_COVER':
      return kind === 'EXTRA' ? '추가 근무자 수락 대기' : '대타자 수락 대기';
    case 'APPROVED':
      return '승인됨';
    case 'REJECTED':
      return '거절됨';
    case 'CANCELLED':
      return '취소됨';
    default:
      return status;
  }
}

export function BrewSchedulePanel({
  storeId,
  storeName,
  owned,
  subscribed,
  onError,
}: BrewSchedulePanelProps) {
  const userId = useAuthStore((s) => s.userId);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [occurrences, setOccurrences] = useState<BrewCalendarOccurrence[]>([]);
  const [pendingCovers, setPendingCovers] = useState<BrewCover[]>([]);
  const [staff, setStaff] = useState<BrewStaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingJournal, setExportingJournal] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [submittingCover, setSubmittingCover] = useState(false);

  const [editUserId, setEditUserId] = useState('');
  const [bulkStartTime, setBulkStartTime] = useState('09:00');
  const [bulkEndTime, setBulkEndTime] = useState('18:00');
  const [slots, setSlots] = useState<Record<number, ScheduleSlotState>>(() => {
    const init: Record<number, ScheduleSlotState> = {};
    for (let d = 1; d <= 7; d += 1) {
      init[d] = emptySlot();
    }
    return init;
  });

  const [coverForm, setCoverForm] = useState({
    originalUserId: '',
    coverUserId: '',
    workDate: toDateKey(new Date()),
    startTime: '09:00',
    endTime: '18:00',
    shiftKind: 'COVER' as BrewShiftKind,
    note: '',
  });
  const [coverSchedules, setCoverSchedules] = useState<BrewSchedule[]>([]);
  const [coverScheduleHint, setCoverScheduleHint] = useState('');
  const [coverAssignments, setCoverAssignments] = useState<Record<string, string>>({});
  const [monthPeekKey, setMonthPeekKey] = useState<string | null>(null);

  useEffect(() => {
    setMonthPeekKey(null);
  }, [viewMode, anchor]);

  const range = useMemo(() => {
    if (viewMode === 'week') {
      const from = startOfWeek(anchor);
      const to = addDays(from, 6);
      return {
        from,
        to,
        days: Array.from({ length: 7 }, (_, i) => addDays(from, i)),
        leadingEmpty: 0,
      };
    }
    const from = startOfMonth(anchor);
    const to = endOfMonth(anchor);
    const days: Date[] = [];
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      days.push(new Date(d));
    }
    // Monday=0 ... Sunday=6 for leading blanks in 7-col month grid
    const leadingEmpty = (from.getDay() + 6) % 7;
    return { from, to, days, leadingEmpty };
  }, [anchor, viewMode]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = toDateKey(range.from);
      const to = toDateKey(range.to);
      const [calRes, pendingRes, staffRes] = await Promise.all([
        brewApi.getCalendar(storeId, from, to),
        brewApi.listPendingCovers(storeId),
        brewApi.listStaff(storeId),
      ]);
      setOccurrences(calRes.data.occurrences);
      setPendingCovers(pendingRes.data);
      setStaff(staffRes.data);
    } catch (err: unknown) {
      onError(getErrorMessage(err, '스케줄을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [onError, range.from, range.to, storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!owned) {
      return;
    }
    if (!editUserId && staff.length > 0) {
      setEditUserId(staff[0].userId);
    }
  }, [editUserId, owned, staff]);

  useEffect(() => {
    if (!owned || !editUserId) {
      return;
    }
    void (async () => {
      try {
        const { data } = await brewApi.listSchedules(storeId);
        const mine = data.filter((s) => s.userId === editUserId);
        setSlots((prev) => {
          const next = { ...prev };
          for (let d = 1; d <= 7; d += 1) {
            next[d] = emptySlot();
          }
          mine.forEach((s: BrewSchedule) => {
            next[s.dayOfWeek] = {
              enabled: true,
              startTime: formatTime(s.startTime),
              endTime: formatTime(s.endTime),
            };
          });
          return next;
        });
      } catch (err: unknown) {
        onError(getErrorMessage(err, '정규 근무를 불러오지 못했습니다.'));
      }
    })();
  }, [editUserId, onError, owned, storeId]);

  useEffect(() => {
    if (owned) {
      if (!coverForm.originalUserId && staff[0]) {
        setCoverForm((prev) => ({
          ...prev,
          originalUserId: staff[0].userId,
          coverUserId: staff[1]?.userId ?? '',
        }));
      }
    } else if (userId) {
      setCoverForm((prev) => ({
        ...prev,
        originalUserId: userId,
        coverUserId:
          prev.coverUserId || staff.find((s) => s.userId !== userId)?.userId || '',
      }));
    }
  }, [coverForm.originalUserId, owned, staff, userId]);

  useEffect(() => {
    if (!(owned || subscribed) || staff.length === 0) {
      setCoverSchedules([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await brewApi.listSchedules(storeId);
        if (!cancelled) {
          setCoverSchedules(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          onError(getErrorMessage(err, '정규 근무를 불러오지 못했습니다.'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onError, owned, staff.length, storeId, subscribed]);

  useEffect(() => {
    if (coverForm.shiftKind === 'EXTRA') {
      setCoverScheduleHint('');
      return;
    }
    const { originalUserId, workDate } = coverForm;
    if (!originalUserId || !workDate) {
      setCoverScheduleHint('');
      return;
    }
    const dayOfWeek = isoDayOfWeekFromDateKey(workDate);
    if (dayOfWeek == null) {
      setCoverScheduleHint('');
      return;
    }
    const match = coverSchedules.find(
      (s) => s.userId === originalUserId && s.dayOfWeek === dayOfWeek,
    );
    if (match) {
      const startTime = formatTime(match.startTime);
      const endTime = formatTime(match.endTime);
      setCoverForm((prev) => {
        if (prev.startTime === startTime && prev.endTime === endTime) {
          return prev;
        }
        return { ...prev, startTime, endTime };
      });
      setCoverScheduleHint('');
      return;
    }
    if (coverSchedules.length > 0) {
      setCoverForm((prev) => {
        if (prev.startTime === '09:00' && prev.endTime === '18:00') {
          return prev;
        }
        return { ...prev, startTime: '09:00', endTime: '18:00' };
      });
      setCoverScheduleHint('해당 요일 정규 근무가 없습니다. 시간을 직접 입력해 주세요.');
    } else {
      setCoverScheduleHint('');
    }
  }, [
    coverForm.originalUserId,
    coverForm.workDate,
    coverForm.shiftKind,
    coverSchedules,
  ]);

  const coveredOutKeys = useMemo(
    () =>
      new Set(
        occurrences
          .filter((occ) => occ.type === 'COVERED_OUT')
          .map((occ) => `${occ.userId}|${occ.date}`),
      ),
    [occurrences],
  );

  /** 후보 직원이 해당 구간에 정규 근무 또는 승인된 대타가 있어 지정 불가한지 */
  const isStaffBusy = useCallback(
    (staffUserId: string, dateKey: string, startTime: string, endTime: string): boolean => {
      const base = parseDateKey(dateKey);
      if (!base) {
        return false;
      }
      const target = shiftRangeMs(base, startTime, endTime);
      if (!target) {
        return false;
      }

      const scheduleConflict = coverSchedules.some((schedule) => {
        if (schedule.userId !== staffUserId) {
          return false;
        }
        // 자정 넘김을 고려해 전날·당일·다음날 근무를 겹침 후보로 본다
        for (let offset = -1; offset <= 1; offset += 1) {
          const day = addDays(base, offset);
          if (isoDayOfWeek(day) !== schedule.dayOfWeek) {
            continue;
          }
          if (coveredOutKeys.has(`${staffUserId}|${toDateKey(day)}`)) {
            continue;
          }
          const shift = shiftRangeMs(day, schedule.startTime, schedule.endTime);
          if (shift && rangesOverlap(target, shift)) {
            return true;
          }
        }
        return false;
      });
      if (scheduleConflict) {
        return true;
      }

      return occurrences.some((occ) => {
        if (
          (occ.type !== 'COVER' && occ.type !== 'EXTRA')
          || occ.userId !== staffUserId
        ) {
          return false;
        }
        const day = parseDateKey(occ.date);
        if (!day) {
          return false;
        }
        const shift = shiftRangeMs(day, occ.startTime, occ.endTime);
        return shift != null && rangesOverlap(target, shift);
      });
    },
    [coverSchedules, coveredOutKeys, occurrences],
  );

  // 날짜·시간 변경으로 선택된 대타자가 지정 불가가 되면 선택 해제
  useEffect(() => {
    if (!owned || !coverForm.coverUserId) {
      return;
    }
    if (
      isStaffBusy(
        coverForm.coverUserId,
        coverForm.workDate,
        coverForm.startTime,
        coverForm.endTime,
      )
    ) {
      setCoverForm((prev) => ({ ...prev, coverUserId: '' }));
    }
  }, [
    coverForm.coverUserId,
    coverForm.workDate,
    coverForm.startTime,
    coverForm.endTime,
    isStaffBusy,
    owned,
  ]);

  const byDate = useMemo(() => {
    const map = new Map<string, BrewCalendarOccurrence[]>();
    occurrences.forEach((occ) => {
      const list = map.get(occ.date) ?? [];
      list.push(occ);
      map.set(occ.date, list);
    });
    return map;
  }, [occurrences]);

  const handleSaveSchedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!editUserId) {
      return;
    }
    const payload: BrewScheduleSlotInput[] = [];
    for (let d = 1; d <= 7; d += 1) {
      const slot = slots[d];
      if (slot?.enabled) {
        payload.push({
          dayOfWeek: d,
          startTime: slot.startTime.length === 5 ? `${slot.startTime}:00` : slot.startTime,
          endTime: slot.endTime.length === 5 ? `${slot.endTime}:00` : slot.endTime,
        });
      }
    }
    setSavingSchedule(true);
    try {
      await brewApi.replaceSchedules(storeId, editUserId, payload);
      const { data } = await brewApi.listSchedules(storeId);
      setCoverSchedules(data);
      await load();
    } catch (err: unknown) {
      onError(getErrorMessage(err, '근무 저장에 실패했습니다.'));
    } finally {
      setSavingSchedule(false);
    }
  };

  const applyBulkTimesToSelectedDays = () => {
    const selected = Object.entries(slots).filter(([, slot]) => slot.enabled);
    if (selected.length === 0) {
      onError('시간을 적용할 요일을 먼저 선택해 주세요.');
      return;
    }
    setSlots((prev) => {
      const next = { ...prev };
      for (let d = 1; d <= 7; d += 1) {
        const slot = next[d] ?? emptySlot();
        if (slot.enabled) {
          next[d] = {
            ...slot,
            startTime: bulkStartTime,
            endTime: bulkEndTime,
          };
        }
      }
      return next;
    });
  };

  const handleCreateCover = async (e: FormEvent) => {
    e.preventDefault();
    const isExtra = coverForm.shiftKind === 'EXTRA';
    if (
      !coverForm.workDate
      || (!isExtra && !coverForm.originalUserId)
      || (owned && !coverForm.coverUserId)
    ) {
      onError(isExtra ? '추가 근무자와 날짜를 확인해 주세요.' : '대상·날짜를 확인해 주세요.');
      return;
    }
    setSubmittingCover(true);
    try {
      await brewApi.createCover(storeId, {
        ...(isExtra
          ? {}
          : { originalUserId: coverForm.originalUserId }),
        ...(owned ? { coverUserId: coverForm.coverUserId } : {}),
        workDate: coverForm.workDate,
        startTime:
          coverForm.startTime.length === 5
            ? `${coverForm.startTime}:00`
            : coverForm.startTime,
        endTime:
          coverForm.endTime.length === 5 ? `${coverForm.endTime}:00` : coverForm.endTime,
        shiftKind: coverForm.shiftKind,
        note: coverForm.note.trim() || undefined,
      });
      await load();
    } catch (err: unknown) {
      onError(getErrorMessage(err, '근무 변경 신청에 실패했습니다.'));
    } finally {
      setSubmittingCover(false);
    }
  };

  const shiftAnchor = (dir: -1 | 1) => {
    setAnchor((prev) => {
      if (viewMode === 'week') {
        return addDays(prev, dir * 7);
      }
      return new Date(prev.getFullYear(), prev.getMonth() + dir, 1);
    });
  };

  const handleExportMonthlyJournal = async () => {
    setExportingJournal(true);
    try {
      const from = startOfMonth(anchor);
      const to = endOfMonth(anchor);
      const { data } = await brewApi.getCalendar(
        storeId,
        toDateKey(from),
        toDateKey(to),
      );
      downloadMonthlyWorkJournal({
        storeName,
        year: from.getFullYear(),
        month: from.getMonth() + 1,
        occurrences: data.occurrences,
      });
    } catch (err: unknown) {
      onError(getErrorMessage(err, '월간 근무 일지 다운로드에 실패했습니다.'));
    } finally {
      setExportingJournal(false);
    }
  };

  const journalMonthLabel = `${anchor.getFullYear()}년 ${anchor.getMonth() + 1}월`;

  const rangeLabel =
    viewMode === 'week'
      ? `${toDateKey(range.from)} ~ ${toDateKey(range.to)}`
      : journalMonthLabel;

  const otherStaff = staff.filter((s) =>
    coverForm.shiftKind === 'EXTRA'
      ? true
      : s.userId !== coverForm.originalUserId,
  );
  const availableCoverStaff = otherStaff.filter(
    (s) =>
      !isStaffBusy(s.userId, coverForm.workDate, coverForm.startTime, coverForm.endTime),
  );

  return (
    <div className="brew-stack-lg">
      <BrewCard title={owned ? '직원 근무 달력' : '내 근무'}>
        <p className="brew-card-lead">
          {owned
            ? '매장 전 직원의 근무·대체·추가를 한 화면에서 봅니다. 종료가 시작보다 이르면 자정 넘김입니다.'
            : '내 근무와 관련된 대체·추가를 주간·월간으로 확인합니다.'}
        </p>
        <div className="brew-schedule-toolbar">
          <div className="brew-btn-row brew-schedule-toolbar__modes">
            <BrewButton
              size="sm"
              variant={viewMode === 'week' ? 'primary' : 'secondary'}
              onClick={() => setViewMode('week')}
            >
              주간
            </BrewButton>
            <BrewButton
              size="sm"
              variant={viewMode === 'month' ? 'primary' : 'secondary'}
              onClick={() => setViewMode('month')}
            >
              월간
            </BrewButton>
            <BrewButton size="sm" variant="secondary" onClick={() => setAnchor(new Date())}>
              오늘
            </BrewButton>
            <BrewButton
              size="sm"
              variant="secondary"
              loading={exportingJournal}
              title={`${journalMonthLabel} 예정 근무 일지 · 직원별 시간 요약`}
              onClick={() => {
                void handleExportMonthlyJournal();
              }}
            >
              월간 일지 엑셀
            </BrewButton>
          </div>
          <div className="brew-schedule-nav">
            <button
              type="button"
              className="brew-schedule-nav__arrow"
              aria-label={viewMode === 'week' ? '이전 주' : '이전 달'}
              onClick={() => shiftAnchor(-1)}
            >
              ‹
            </button>
            <span className="brew-schedule-range">{rangeLabel}</span>
            <button
              type="button"
              className="brew-schedule-nav__arrow"
              aria-label={viewMode === 'week' ? '다음 주' : '다음 달'}
              onClick={() => shiftAnchor(1)}
            >
              ›
            </button>
          </div>
        </div>
        {loading ? (
          <p className="brew-empty">불러오는 중…</p>
        ) : viewMode === 'week' ? (
          <BrewWeekTimelineView
            days={range.days}
            occurrences={occurrences}
            staffUserIds={staff.map((s) => s.userId)}
          />
        ) : (
          <div className="brew-schedule-grid brew-schedule-grid--month">
            {DAY_LABELS.map((label) => (
              <div key={`wd-${label}`} className="brew-schedule-weekday">
                {label}
              </div>
            ))}
            {Array.from({ length: range.leadingEmpty }, (_, i) => (
              <div
                key={`empty-${i}`}
                className="brew-schedule-day brew-schedule-day--empty"
                aria-hidden
              />
            ))}
            {range.days.map((day) => {
              const key = toDateKey(day);
              const visible = monthVisibleOccurrences(byDate.get(key) ?? []);
              const preview = visible.slice(0, MONTH_PREVIEW_COUNT);
              const overflow = visible.length - preview.length;
              const isToday = key === toDateKey(new Date());
              const peeking = monthPeekKey === key;
              return (
                <div
                  key={key}
                  className={`brew-schedule-day${isToday ? ' brew-schedule-day--today' : ''}${
                    peeking ? ' is-peek' : ''
                  }`}
                  onMouseEnter={() => setMonthPeekKey(key)}
                  onMouseLeave={() =>
                    setMonthPeekKey((prev) => (prev === key ? null : prev))
                  }
                  onClick={() => {
                    if (typeof window !== 'undefined'
                      && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                      return;
                    }
                    setMonthPeekKey((prev) => (prev === key ? null : key));
                  }}
                >
                  <div className="brew-schedule-day__head">
                    <span>
                      {day.getMonth() + 1}/{day.getDate()}
                    </span>
                    {isToday ? <span>오늘</span> : null}
                  </div>
                  <ul className="brew-schedule-day__list">
                    {visible.length === 0 ? (
                      <li className="brew-schedule-day__empty">—</li>
                    ) : (
                      preview.map((occ, idx) => (
                        <li
                          key={`${occ.userId}-${occ.type}-${occ.coverId ?? idx}`}
                          className={`brew-schedule-chip brew-schedule-chip--${occ.type.toLowerCase()}`}
                        >
                          {monthChipLabel(occ)}
                        </li>
                      ))
                    )}
                  </ul>
                  {overflow > 0 ? (
                    <p className="brew-schedule-day__more">+{overflow}</p>
                  ) : null}
                  {peeking && visible.length > 0 ? (
                    <div className="brew-schedule-day__popover" role="dialog">
                      <p className="brew-schedule-day__popover-title">
                        {day.getMonth() + 1}/{day.getDate()} · {visible.length}명
                      </p>
                      <ul className="brew-schedule-day__popover-list">
                        {visible.map((occ, idx) => (
                          <li
                            key={`peek-${occ.userId}-${occ.type}-${occ.coverId ?? idx}`}
                            className={`brew-schedule-chip brew-schedule-chip--${occ.type.toLowerCase()}`}
                          >
                            {monthChipLabel(occ)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </BrewCard>

      <div className="brew-schedule-panels">
      {owned ? (
        <BrewCard title="정규 근무 지정">
          {staff.length === 0 ? (
            <p className="brew-empty">직원이 없습니다. 가입 승인 후 지정할 수 있습니다.</p>
          ) : (
            <form className="brew-form-stack" onSubmit={(e) => void handleSaveSchedule(e)}>
              <div className="brew-field">
                <label className="brew-field__label" htmlFor="sched-user">
                  직원
                </label>
                <select
                  id="sched-user"
                  className="brew-field__input"
                  value={editUserId}
                  onChange={(e) => setEditUserId(e.target.value)}
                >
                  {staff.map((s) => (
                    <option key={s.userId} value={s.userId}>
                      {s.nickname}
                    </option>
                  ))}
                </select>
              </div>
              <div className="brew-schedule-bulk">
                <p className="brew-field__label">선택 요일 일괄 시간</p>
                <div className="brew-schedule-slot-row brew-schedule-bulk__row">
                  <input
                    type="time"
                    className="brew-field__input brew-schedule-time"
                    value={bulkStartTime}
                    onChange={(e) => setBulkStartTime(e.target.value)}
                    aria-label="일괄 시작 시각"
                  />
                  <span>~</span>
                  <input
                    type="time"
                    className="brew-field__input brew-schedule-time"
                    value={bulkEndTime}
                    onChange={(e) => setBulkEndTime(e.target.value)}
                    aria-label="일괄 종료 시각"
                  />
                  <BrewButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={applyBulkTimesToSelectedDays}
                  >
                    선택 요일에 적용
                  </BrewButton>
                </div>
                <p className="brew-field__hint">
                  체크한 요일에만 위 시간이 들어갑니다. 적용 후에도 요일별로 수정할 수
                  있습니다.
                </p>
              </div>
              <div className="brew-stack">
                {DAY_LABELS.map((label, i) => {
                  const dow = i + 1;
                  const slot = slots[dow] ?? emptySlot();
                  return (
                    <div key={dow} className="brew-schedule-slot-row">
                      <label className="brew-check">
                        <input
                          type="checkbox"
                          checked={slot.enabled}
                          onChange={(e) =>
                            setSlots((prev) => ({
                              ...prev,
                              [dow]: {
                                ...(prev[dow] ?? emptySlot()),
                                enabled: e.target.checked,
                              },
                            }))
                          }
                        />
                        {label}
                      </label>
                      <input
                        type="time"
                        className="brew-field__input brew-schedule-time"
                        value={slot.startTime}
                        disabled={!slot.enabled}
                        onChange={(e) =>
                          setSlots((prev) => ({
                            ...prev,
                            [dow]: {
                              ...(prev[dow] ?? emptySlot()),
                              startTime: e.target.value,
                            },
                          }))
                        }
                      />
                      <span>~</span>
                      <input
                        type="time"
                        className="brew-field__input brew-schedule-time"
                        value={slot.endTime}
                        disabled={!slot.enabled}
                        onChange={(e) =>
                          setSlots((prev) => ({
                            ...prev,
                            [dow]: {
                              ...(prev[dow] ?? emptySlot()),
                              endTime: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
              <p className="brew-card-lead">
                종료 시각이 시작보다 이르면 자정 넘김(예: 22:00~06:00)으로 저장됩니다.
              </p>
              <BrewButton type="submit" loading={savingSchedule}>
                근무 저장
              </BrewButton>
            </form>
          )}
        </BrewCard>
      ) : null}

      {(owned || subscribed) && staff.length > 0 ? (
        <BrewCard title="대체·추가 신청">
          <form className="brew-form-stack" onSubmit={(e) => void handleCreateCover(e)}>
            <div className="brew-field">
              <span className="brew-field__label">유형</span>
              <div className="brew-btn-row">
                <BrewButton
                  type="button"
                  size="sm"
                  variant={coverForm.shiftKind === 'COVER' ? 'primary' : 'secondary'}
                  onClick={() =>
                    setCoverForm((prev) => ({ ...prev, shiftKind: 'COVER' }))
                  }
                >
                  대체
                </BrewButton>
                <BrewButton
                  type="button"
                  size="sm"
                  variant={coverForm.shiftKind === 'EXTRA' ? 'primary' : 'secondary'}
                  onClick={() =>
                    setCoverForm((prev) => ({ ...prev, shiftKind: 'EXTRA' }))
                  }
                >
                  추가
                </BrewButton>
              </div>
              <p className="brew-field__hint">
                {coverForm.shiftKind === 'COVER'
                  ? '원래 근무자 구간은 타임테이블에서 빠지고, 지정된 사람이 대신 근무합니다.'
                  : '정규 근무가 아닌 별도 시간에 추가 근무자를 지정합니다. 요청 직원은 없습니다.'}
              </p>
            </div>
            {coverForm.shiftKind === 'COVER' && owned ? (
              <div className="brew-field">
                <label className="brew-field__label" htmlFor="cover-original">
                  원래 근무자
                </label>
                <select
                  id="cover-original"
                  className="brew-field__input"
                  value={coverForm.originalUserId}
                  onChange={(e) =>
                    setCoverForm((prev) => ({
                      ...prev,
                      originalUserId: e.target.value,
                    }))
                  }
                >
                  {staff.map((s) => (
                    <option key={s.userId} value={s.userId}>
                      {s.nickname}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {coverForm.shiftKind === 'COVER' && !owned ? (
              <p className="brew-card-lead">
                본인 근무의 대체를 신청하면 업주가 대체자를 지정합니다.
              </p>
            ) : null}
            {coverForm.shiftKind === 'EXTRA' && !owned ? (
              <p className="brew-card-lead">
                본인 추가 근무를 신청하면 업주 승인 후 반영됩니다.
              </p>
            ) : null}
            {owned ? (
              <div className="brew-field">
                <label className="brew-field__label" htmlFor="cover-user">
                  {coverForm.shiftKind === 'COVER' ? '대체자' : '추가 근무자'}
                </label>
                <select
                  id="cover-user"
                  className="brew-field__input"
                  value={coverForm.coverUserId}
                  onChange={(e) =>
                    setCoverForm((prev) => ({ ...prev, coverUserId: e.target.value }))
                  }
                >
                  <option value="">선택</option>
                  {availableCoverStaff.map((s) => (
                    <option key={s.userId} value={s.userId}>
                      {s.nickname}
                    </option>
                  ))}
                </select>
                {otherStaff.length > 0 && availableCoverStaff.length === 0 ? (
                  <p className="brew-field__hint">
                    해당 시간에 지정 가능한 직원이 없습니다.
                  </p>
                ) : null}
              </div>
            ) : null}
            <BrewInput
              label="날짜"
              type="date"
              value={coverForm.workDate}
              onChange={(e) =>
                setCoverForm((prev) => ({ ...prev, workDate: e.target.value }))
              }
            />
            <div className="brew-schedule-slot-row">
              <BrewInput
                label="시작"
                type="time"
                value={coverForm.startTime}
                onChange={(e) =>
                  setCoverForm((prev) => ({ ...prev, startTime: e.target.value }))
                }
              />
              <BrewInput
                label="종료"
                type="time"
                value={coverForm.endTime}
                onChange={(e) =>
                  setCoverForm((prev) => ({ ...prev, endTime: e.target.value }))
                }
              />
            </div>
            {coverScheduleHint ? (
              <p className="brew-card-lead">{coverScheduleHint}</p>
            ) : null}
            <BrewInput
              label="메모 (선택)"
              value={coverForm.note}
              onChange={(e) => setCoverForm((prev) => ({ ...prev, note: e.target.value }))}
            />
            <BrewButton type="submit" loading={submittingCover}>
              {owned
                ? `${shiftKindLabel(coverForm.shiftKind)} 지정 (수락 대기)`
                : `${shiftKindLabel(coverForm.shiftKind)} 신청`}
            </BrewButton>
          </form>
        </BrewCard>
      ) : null}

      <BrewCard title="대체·추가 관리" className="brew-schedule-panels__span">
        {pendingCovers.length === 0 ? (
          <p className="brew-empty">대기·승인된 대체·추가가 없습니다.</p>
        ) : (
          <div className="brew-stack">
            {pendingCovers.map((cover) => {
              const kind = cover.shiftKind ?? 'COVER';
              const canAssign =
                owned && kind === 'COVER' && cover.status === 'PENDING_OWNER';
              const canOwnerApproveExtra =
                owned
                && kind === 'EXTRA'
                && cover.status === 'PENDING_OWNER'
                && Boolean(cover.coverUserId);
              const canAccept =
                userId === cover.coverUserId && cover.status === 'PENDING_COVER';
              const canReject =
                (owned && cover.status === 'PENDING_OWNER')
                || (userId === cover.coverUserId && cover.status === 'PENDING_COVER')
                || (owned && cover.status === 'PENDING_COVER');
              const canCancel =
                (owned || userId === cover.requestedByUserId)
                && (cover.status === 'PENDING_OWNER'
                  || cover.status === 'PENDING_COVER'
                  || cover.status === 'APPROVED');
              const title =
                kind === 'EXTRA'
                  ? `[추가] ${cover.coverNickname || '추가 근무자'}`
                  : `[대체] ${cover.originalNickname} → ${cover.coverNickname || '대타자 미지정'}`;
              return (
                <div key={cover.id} className="brew-search-result">
                  <div>
                    <p className="brew-store-row__name">{title}</p>
                    <p className="brew-store-row__sub">
                      {cover.workDate} {formatTime(cover.startTime)}–
                      {formatTime(cover.endTime)}
                      {cover.overnight ? ' (익일)' : ''} ·{' '}
                      {coverStatusLabel(cover.status, kind)}
                    </p>
                  </div>
                  <div className="brew-search-result__actions">
                    {canAssign ? (
                      <>
                        <select
                          className="brew-field__input"
                          aria-label={`${cover.originalNickname}의 대체자`}
                          value={coverAssignments[cover.id] ?? ''}
                          onChange={(e) =>
                            setCoverAssignments((prev) => ({
                              ...prev,
                              [cover.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">대타자 선택</option>
                          {staff
                            .filter(
                              (member) =>
                                member.userId !== cover.originalUserId &&
                                !isStaffBusy(
                                  member.userId,
                                  cover.workDate,
                                  cover.startTime,
                                  cover.endTime,
                                ),
                            )
                            .map((member) => (
                              <option key={member.userId} value={member.userId}>
                                {member.nickname}
                              </option>
                            ))}
                        </select>
                        <BrewButton
                          size="sm"
                          disabled={!coverAssignments[cover.id]}
                          onClick={() => {
                            const coverUserId = coverAssignments[cover.id];
                            if (!coverUserId) return;
                            void (async () => {
                              try {
                                await brewApi.assignCover(cover.id, coverUserId);
                                setCoverAssignments((prev) => {
                                  const next = { ...prev };
                                  delete next[cover.id];
                                  return next;
                                });
                                await load();
                              } catch (err: unknown) {
                                onError(getErrorMessage(err, '대타자 지정에 실패했습니다.'));
                              }
                            })();
                          }}
                        >
                          지정
                        </BrewButton>
                      </>
                    ) : null}
                    {canOwnerApproveExtra ? (
                      <BrewButton
                        size="sm"
                        onClick={() => {
                          void (async () => {
                            try {
                              await brewApi.acceptCover(cover.id);
                              await load();
                            } catch (err: unknown) {
                              onError(getErrorMessage(err, '승인에 실패했습니다.'));
                            }
                          })();
                        }}
                      >
                        승인
                      </BrewButton>
                    ) : null}
                    {canAccept ? (
                      <BrewButton
                        size="sm"
                        onClick={() => {
                          void (async () => {
                            try {
                              await brewApi.acceptCover(cover.id);
                              await load();
                            } catch (err: unknown) {
                              onError(getErrorMessage(err, '수락에 실패했습니다.'));
                            }
                          })();
                        }}
                      >
                        수락
                      </BrewButton>
                    ) : null}
                    {canReject ? (
                      <BrewButton
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          void (async () => {
                            try {
                              await brewApi.rejectCover(cover.id);
                              await load();
                            } catch (err: unknown) {
                              onError(getErrorMessage(err, '거절에 실패했습니다.'));
                            }
                          })();
                        }}
                      >
                        거절
                      </BrewButton>
                    ) : null}
                    {canCancel ? (
                      <BrewButton
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const isApproved = cover.status === 'APPROVED';
                          if (
                            isApproved
                            && !window.confirm(
                              kind === 'EXTRA'
                                ? '승인된 추가 근무를 취소할까요?\n달력에서 해당 근무가 사라집니다.'
                                : '승인된 대체를 취소할까요?\n원래 근무가 다시 표시됩니다.',
                            )
                          ) {
                            return;
                          }
                          void (async () => {
                            try {
                              await brewApi.cancelCover(cover.id);
                              await load();
                            } catch (err: unknown) {
                              onError(getErrorMessage(err, '취소에 실패했습니다.'));
                            }
                          })();
                        }}
                      >
                        취소
                      </BrewButton>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </BrewCard>
      </div>
    </div>
  );
}
