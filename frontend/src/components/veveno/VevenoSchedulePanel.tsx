import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { vevenoApi } from '../../api/vevenoApi';
import {
  isVevenoDemoStoreId,
  VEVENO_DEMO_OWNER_ID,
  VEVENO_DEMO_STAFF_ID,
} from '../../features/veveno/vevenoDemo';
import { useAuthStore } from '../../stores/authStore';
import type {
  VevenoCalendarOccurrence,
  VevenoCover,
  VevenoSchedule,
  VevenoScheduleReplaceMode,
  VevenoScheduleSlotInput,
  VevenoShiftKind,
} from '../../types/veveno';
import { getVevenoErrorMessage } from '../../features/veveno/i18n/error';
import {
  useTranslation,
  useVevenoI18n,
} from '../../features/veveno/i18n/LanguageContext';
import { vevenoWeekdayLabels, type TranslateFn } from '../../features/veveno/i18n/translate';
import { VevenoButton } from './VevenoButton';
import { VevenoCard } from './VevenoCard';
import { VevenoEmptyState } from './VevenoEmptyState';
import { VevenoInput } from './VevenoInput';
import { VevenoModal } from './VevenoModal';
import { VevenoTimeInput } from './VevenoTimeInput';
import { downloadMonthlyWorkJournal } from './vevenoMonthlyJournalExport';
import VevenoWeekTimelineView from './VevenoWeekTimelineView';

type ViewMode = 'week' | 'month';

interface VevenoStaffMember {
  userId: string;
  nickname: string;
}

interface VevenoSchedulePanelProps {
  storeId: string;
  storeName: string;
  owned: boolean;
  subscribed: boolean;
  onError: (message: string) => void;
  onGoSettings?: () => void;
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
  items: VevenoCalendarOccurrence[],
): VevenoCalendarOccurrence[] {
  return items.filter((occ) => occ.type !== 'COVERED_OUT');
}

function monthChipLabel(occ: VevenoCalendarOccurrence, t: TranslateFn): string {
  const time = `${formatTime(occ.startTime)}–${formatTime(occ.endTime)}${
    occ.overnight ? t('schedule.nextDayParen') : ''
  }`;
  if (occ.type === 'EXTRA') {
    return t('schedule.extraChip', { nickname: occ.nickname, time });
  }
  return `${occ.nickname} ${time}`;
}

const MONTH_PREVIEW_COUNT = 4;

function shiftKindLabel(kind: VevenoShiftKind, t: TranslateFn): string {
  return kind === 'EXTRA' ? t('schedule.extra') : t('schedule.cover');
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

function coverStatusLabel(
  status: string,
  kind: VevenoShiftKind = 'COVER',
  t: TranslateFn,
): string {
  switch (status) {
    case 'PENDING_OWNER':
      return kind === 'EXTRA' ? t('schedule.pendingOwnerExtra') : t('schedule.pendingOwnerCover');
    case 'PENDING_COVER':
      return kind === 'EXTRA' ? t('schedule.pendingExtraAccept') : t('schedule.pendingCoverAccept');
    case 'APPROVED':
      return t('schedule.approved');
    case 'REJECTED':
      return t('schedule.rejected');
    case 'CANCELLED':
      return t('schedule.cancelled');
    default:
      return status;
  }
}

export function VevenoSchedulePanel({
  storeId,
  storeName,
  owned,
  subscribed,
  onError,
  onGoSettings,
}: VevenoSchedulePanelProps) {
  const t = useTranslation();
  const { dateLocale } = useVevenoI18n();
  const dayLabels = vevenoWeekdayLabels(t);
  const authUserId = useAuthStore((s) => s.userId);
  const userId = isVevenoDemoStoreId(storeId)
    ? owned
      ? VEVENO_DEMO_OWNER_ID
      : VEVENO_DEMO_STAFF_ID
    : authUserId;
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [occurrences, setOccurrences] = useState<VevenoCalendarOccurrence[]>([]);
  const [pendingCovers, setPendingCovers] = useState<VevenoCover[]>([]);
  const [staff, setStaff] = useState<VevenoStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
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
    shiftKind: 'COVER' as VevenoShiftKind,
    note: '',
  });
  const [coverSchedules, setCoverSchedules] = useState<VevenoSchedule[]>([]);
  const [applyPickerMode, setApplyPickerMode] = useState<
    Extract<VevenoScheduleReplaceMode, 'FROM_DATE' | 'ONCE'> | null
  >(null);
  const [pickerAnchor, setPickerAnchor] = useState(() => new Date());
  const [pickerSelected, setPickerSelected] = useState(() => toDateKey(new Date()));
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
        vevenoApi.getCalendar(storeId, from, to),
        vevenoApi.listPendingCovers(storeId),
        vevenoApi.listStaff(storeId),
      ]);
      setOccurrences(calRes.data.occurrences);
      setPendingCovers(pendingRes.data);
      setStaff(staffRes.data);
    } catch (err: unknown) {
      onError(getVevenoErrorMessage(err, t('errors.failLoadSchedule'), t));
    } finally {
      setLoading(false);
    }
  }, [onError, range.from, range.to, storeId, t]);

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
        const { data } = await vevenoApi.listSchedules(storeId);
        const mine = data.filter((s) => s.userId === editUserId);
        setSlots((prev) => {
          const next = { ...prev };
          for (let d = 1; d <= 7; d += 1) {
            next[d] = emptySlot();
          }
          mine.forEach((s: VevenoSchedule) => {
            next[s.dayOfWeek] = {
              enabled: true,
              startTime: formatTime(s.startTime),
              endTime: formatTime(s.endTime),
            };
          });
          return next;
        });
      } catch (err: unknown) {
        onError(getVevenoErrorMessage(err, t('errors.failLoadRegular'), t));
      }
    })();
  }, [editUserId, onError, owned, storeId, t]);

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
        const { data } = await vevenoApi.listSchedules(storeId);
        if (!cancelled) {
          setCoverSchedules(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          onError(getVevenoErrorMessage(err, t('errors.failLoadRegular'), t));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onError, owned, staff.length, storeId, subscribed, t]);

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
      setCoverScheduleHint(t('schedule.noRegularThatDay'));
    } else {
      setCoverScheduleHint('');
    }
  }, [
    coverForm.originalUserId,
    coverForm.workDate,
    coverForm.shiftKind,
    coverSchedules,
    t,
  ]);

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

      const scheduleConflict = occurrences.some((occ) => {
        if (occ.type !== 'REGULAR' || occ.userId !== staffUserId) {
          return false;
        }
        const day = parseDateKey(occ.date);
        if (!day) {
          return false;
        }
        const shift = shiftRangeMs(day, occ.startTime, occ.endTime);
        return shift != null && rangesOverlap(target, shift);
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
    [occurrences],
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
    const map = new Map<string, VevenoCalendarOccurrence[]>();
    occurrences.forEach((occ) => {
      const list = map.get(occ.date) ?? [];
      list.push(occ);
      map.set(occ.date, list);
    });
    return map;
  }, [occurrences]);

  const pickerRange = useMemo(() => {
    const from = startOfMonth(pickerAnchor);
    const to = endOfMonth(pickerAnchor);
    const days: Date[] = [];
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      days.push(new Date(d));
    }
    return {
      days,
      leadingEmpty: (from.getDay() + 6) % 7,
      label: t('schedule.yearMonth', {
        year: from.getFullYear(),
        month: from.getMonth() + 1,
      }),
    };
  }, [pickerAnchor, t]);

  const handleSaveSchedule = async (
    mode: VevenoScheduleReplaceMode,
    effectiveFrom?: string,
  ) => {
    if (!editUserId) {
      return;
    }
    if ((mode === 'FROM_DATE' || mode === 'ONCE') && !effectiveFrom) {
      onError(t('schedule.pickApplyDate'));
      return;
    }
    const payload: VevenoScheduleSlotInput[] = [];
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
      await vevenoApi.replaceSchedules(storeId, editUserId, {
        slots: payload,
        mode,
        effectiveFrom: mode === 'FROM_TODAY' ? undefined : effectiveFrom,
      });
      setApplyPickerMode(null);
      const { data } = await vevenoApi.listSchedules(storeId);
      setCoverSchedules(data);
      await load();
    } catch (err: unknown) {
      onError(getVevenoErrorMessage(err, t('errors.failSaveSchedule'), t));
    } finally {
      setSavingSchedule(false);
    }
  };

  const openApplyPicker = (mode: Extract<VevenoScheduleReplaceMode, 'FROM_DATE' | 'ONCE'>) => {
    const today = new Date();
    setPickerAnchor(today);
    setPickerSelected(toDateKey(today));
    setApplyPickerMode(mode);
  };

  const applyBulkTimesToSelectedDays = () => {
    const selected = Object.entries(slots).filter(([, slot]) => slot.enabled);
    if (selected.length === 0) {
      onError(t('schedule.pickDaysFirst'));
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
      onError(isExtra ? t('schedule.extraNeedStaffDate') : t('schedule.coverNeedTargetDate'));
      return;
    }
    setSubmittingCover(true);
    try {
      await vevenoApi.createCover(storeId, {
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
      onError(getVevenoErrorMessage(err, t('errors.failCoverRequest'), t));
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
      const { data } = await vevenoApi.getCalendar(
        storeId,
        toDateKey(from),
        toDateKey(to),
      );
      downloadMonthlyWorkJournal({
        storeName,
        year: from.getFullYear(),
        month: from.getMonth() + 1,
        occurrences: data.occurrences,
        t,
        collatorLocale: dateLocale,
      });
    } catch (err: unknown) {
      onError(getVevenoErrorMessage(err, t('errors.failJournalExport'), t));
    } finally {
      setExportingJournal(false);
    }
  };

  const journalMonthLabel = t('schedule.yearMonth', {
    year: anchor.getFullYear(),
    month: anchor.getMonth() + 1,
  });

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

  if (owned && loading) {
    return <p className="veveno-empty">{t('common.loading')}</p>;
  }

  if (owned && staff.length === 0) {
    return (
      <VevenoEmptyState
        title={t('schedule.noStaffTitle')}
        body={t('schedule.noStaffBody')}
        action={
          onGoSettings ? (
            <VevenoButton onClick={onGoSettings}>{t('schedule.goApprove')}</VevenoButton>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="veveno-stack-lg">
      <VevenoCard title={owned ? t('schedule.calendarOwner') : t('schedule.calendarStaff')}>
        <p className="veveno-card-lead">
          {owned
            ? t('schedule.calendarLeadOwner')
            : t('schedule.calendarLeadStaff')}
        </p>
        <div className="veveno-schedule-toolbar">
          <div className="veveno-schedule-toolbar__top">
            <div className="veveno-btn-row veveno-schedule-toolbar__modes">
              <VevenoButton
                size="sm"
                variant={viewMode === 'week' ? 'primary' : 'secondary'}
                onClick={() => setViewMode('week')}
              >
                {t('schedule.week')}
              </VevenoButton>
              <VevenoButton
                size="sm"
                variant={viewMode === 'month' ? 'primary' : 'secondary'}
                onClick={() => setViewMode('month')}
              >
                {t('schedule.month')}
              </VevenoButton>
              <VevenoButton size="sm" variant="secondary" onClick={() => setAnchor(new Date())}>
                {t('common.today')}
              </VevenoButton>
            </div>
            <div className="veveno-schedule-toolbar__export">
              <VevenoButton
                size="sm"
                variant="secondary"
                loading={exportingJournal}
                title={t('schedule.downloadTitle', { month: journalMonthLabel })}
                onClick={() => {
                  void handleExportMonthlyJournal();
                }}
              >
                {t('schedule.download')}
              </VevenoButton>
            </div>
          </div>
          <div className="veveno-schedule-nav">
            <button
              type="button"
              className="veveno-schedule-nav__arrow"
              aria-label={viewMode === 'week' ? t('schedule.prevWeek') : t('schedule.prevMonth')}
              onClick={() => shiftAnchor(-1)}
            >
              ‹
            </button>
            <span className="veveno-schedule-range">{rangeLabel}</span>
            <button
              type="button"
              className="veveno-schedule-nav__arrow"
              aria-label={viewMode === 'week' ? t('schedule.nextWeek') : t('schedule.nextMonth')}
              onClick={() => shiftAnchor(1)}
            >
              ›
            </button>
          </div>
        </div>
        {loading ? (
          <p className="veveno-empty">{t('common.loading')}</p>
        ) : viewMode === 'week' ? (
          <VevenoWeekTimelineView
            days={range.days}
            occurrences={occurrences}
            staffUserIds={staff.map((s) => s.userId)}
          />
        ) : (
          <div className="veveno-schedule-grid veveno-schedule-grid--month">
            {dayLabels.map((label) => (
              <div key={`wd-${label}`} className="veveno-schedule-weekday">
                {label}
              </div>
            ))}
            {Array.from({ length: range.leadingEmpty }, (_, i) => (
              <div
                key={`empty-${i}`}
                className="veveno-schedule-day veveno-schedule-day--empty"
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
                  className={`veveno-schedule-day${isToday ? ' veveno-schedule-day--today' : ''}${
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
                  <div className="veveno-schedule-day__head">
                    <span>
                      {day.getMonth() + 1}/{day.getDate()}
                    </span>
                    {isToday ? <span>{t('common.today')}</span> : null}
                  </div>
                  <ul className="veveno-schedule-day__list">
                    {visible.length === 0 ? (
                      <li className="veveno-schedule-day__empty">—</li>
                    ) : (
                      preview.map((occ, idx) => (
                        <li
                          key={`${occ.userId}-${occ.type}-${occ.coverId ?? idx}`}
                          className={`veveno-schedule-chip veveno-schedule-chip--${occ.type.toLowerCase()}`}
                        >
                          {monthChipLabel(occ, t)}
                        </li>
                      ))
                    )}
                  </ul>
                  {overflow > 0 ? (
                    <p className="veveno-schedule-day__more">+{overflow}</p>
                  ) : null}
                  {peeking && visible.length > 0 ? (
                    <div className="veveno-schedule-day__popover" role="dialog">
                      <p className="veveno-schedule-day__popover-title">
                        {t('schedule.monthDayPeople', { month: day.getMonth() + 1, day: day.getDate(), count: visible.length })}
                      </p>
                      <ul className="veveno-schedule-day__popover-list">
                        {visible.map((occ, idx) => (
                          <li
                            key={`peek-${occ.userId}-${occ.type}-${occ.coverId ?? idx}`}
                            className={`veveno-schedule-chip veveno-schedule-chip--${occ.type.toLowerCase()}`}
                          >
                            {monthChipLabel(occ, t)}
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
      </VevenoCard>

      <div className="veveno-schedule-panels">
      {owned ? (
        <VevenoCard title={t('schedule.regularTitle')}>
          {staff.length === 0 ? (
            <p className="veveno-empty">{t('schedule.noStaffAssign')}</p>
          ) : (
            <form
              className="veveno-form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSaveSchedule('FROM_TODAY');
              }}
            >
              <div className="veveno-field">
                <label className="veveno-field__label" htmlFor="sched-user">
                  {t('schedule.staff')}
                </label>
                <select
                  id="sched-user"
                  className="veveno-field__input"
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
              <div className="veveno-schedule-bulk">
                <p className="veveno-field__label">{t('schedule.bulkTime')}</p>
                <div className="veveno-schedule-slot-row veveno-schedule-bulk__row">
                  <VevenoTimeInput
                    value={bulkStartTime}
                    onChange={setBulkStartTime}
                    aria-label={t('schedule.bulkStart')}
                  />
                  <span>~</span>
                  <VevenoTimeInput
                    value={bulkEndTime}
                    onChange={setBulkEndTime}
                    aria-label={t('schedule.bulkEnd')}
                  />
                  <VevenoButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={applyBulkTimesToSelectedDays}
                  >
                    {t('schedule.applySelectedDays')}
                  </VevenoButton>
                </div>
                <p className="veveno-field__hint">
                  {t('schedule.bulkHint')}
                </p>
              </div>
              <div className="veveno-stack">
                {dayLabels.map((label, i) => {
                  const dow = i + 1;
                  const slot = slots[dow] ?? emptySlot();
                  return (
                    <div key={dow} className="veveno-schedule-slot-row">
                      <label className="veveno-check">
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
                      <VevenoTimeInput
                        value={slot.startTime}
                        disabled={!slot.enabled}
                        aria-label={t('schedule.dayStart', { day: label })}
                        onChange={(startTime) =>
                          setSlots((prev) => ({
                            ...prev,
                            [dow]: {
                              ...(prev[dow] ?? emptySlot()),
                              startTime,
                            },
                          }))
                        }
                      />
                      <span>~</span>
                      <VevenoTimeInput
                        value={slot.endTime}
                        disabled={!slot.enabled}
                        aria-label={t('schedule.dayEnd', { day: label })}
                        onChange={(endTime) =>
                          setSlots((prev) => ({
                            ...prev,
                            [dow]: {
                              ...(prev[dow] ?? emptySlot()),
                              endTime,
                            },
                          }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
              <p className="veveno-card-lead">
                {t('schedule.overnightHint')}
              </p>
              <div className="veveno-btn-row">
                <VevenoButton type="submit" loading={savingSchedule}>
                  {t('schedule.fromToday')}
                </VevenoButton>
                <VevenoButton
                  type="button"
                  variant="secondary"
                  loading={savingSchedule}
                  onClick={() => openApplyPicker('FROM_DATE')}
                >
                  {t('schedule.fromDate')}
                </VevenoButton>
                <VevenoButton
                  type="button"
                  variant="secondary"
                  loading={savingSchedule}
                  onClick={() => openApplyPicker('ONCE')}
                >
                  {t('schedule.once')}
                </VevenoButton>
              </div>
            </form>
          )}
        </VevenoCard>
      ) : null}

      {(owned || subscribed) && staff.length > 0 ? (
        <VevenoCard title={t('schedule.coverExtraTitle')}>
          <form className="veveno-form-stack" onSubmit={(e) => void handleCreateCover(e)}>
            <div className="veveno-field">
              <span className="veveno-field__label">{t('schedule.type')}</span>
              <div className="veveno-btn-row">
                <VevenoButton
                  type="button"
                  size="sm"
                  variant={coverForm.shiftKind === 'COVER' ? 'primary' : 'secondary'}
                  onClick={() =>
                    setCoverForm((prev) => ({ ...prev, shiftKind: 'COVER' }))
                  }
                >
                  {t('schedule.cover')}
                </VevenoButton>
                <VevenoButton
                  type="button"
                  size="sm"
                  variant={coverForm.shiftKind === 'EXTRA' ? 'primary' : 'secondary'}
                  onClick={() =>
                    setCoverForm((prev) => ({ ...prev, shiftKind: 'EXTRA' }))
                  }
                >
                  {t('schedule.extra')}
                </VevenoButton>
              </div>
              <p className="veveno-field__hint">
                {coverForm.shiftKind === 'COVER'
                  ? t('schedule.coverLead')
                  : t('schedule.extraLead')}
              </p>
            </div>
            {coverForm.shiftKind === 'COVER' && owned ? (
              <div className="veveno-field">
                <label className="veveno-field__label" htmlFor="cover-original">
                  {t('schedule.originalWorker')}
                </label>
                <select
                  id="cover-original"
                  className="veveno-field__input"
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
              <p className="veveno-card-lead">
                {t('schedule.staffCoverHint')}
              </p>
            ) : null}
            {coverForm.shiftKind === 'EXTRA' && !owned ? (
              <p className="veveno-card-lead">
                {t('schedule.staffExtraHint')}
              </p>
            ) : null}
            {owned ? (
              <div className="veveno-field">
                <label className="veveno-field__label" htmlFor="cover-user">
                  {coverForm.shiftKind === 'COVER' ? t('schedule.coverPerson') : t('schedule.extraPerson')}
                </label>
                <select
                  id="cover-user"
                  className="veveno-field__input"
                  value={coverForm.coverUserId}
                  onChange={(e) =>
                    setCoverForm((prev) => ({ ...prev, coverUserId: e.target.value }))
                  }
                >
                  <option value="">{t('common.select')}</option>
                  {availableCoverStaff.map((s) => (
                    <option key={s.userId} value={s.userId}>
                      {s.nickname}
                    </option>
                  ))}
                </select>
                {otherStaff.length > 0 && availableCoverStaff.length === 0 ? (
                  <p className="veveno-field__hint">
                    {t('schedule.noEligible')}
                  </p>
                ) : null}
              </div>
            ) : null}
            <VevenoInput
              label={t('schedule.date')}
              type="date"
              value={coverForm.workDate}
              onChange={(e) =>
                setCoverForm((prev) => ({ ...prev, workDate: e.target.value }))
              }
            />
            <div className="veveno-schedule-slot-row">
              <VevenoTimeInput
                id="cover-start"
                label={t('common.start')}
                value={coverForm.startTime}
                onChange={(startTime) =>
                  setCoverForm((prev) => ({ ...prev, startTime }))
                }
              />
              <VevenoTimeInput
                id="cover-end"
                label={t('common.end')}
                value={coverForm.endTime}
                onChange={(endTime) =>
                  setCoverForm((prev) => ({ ...prev, endTime }))
                }
              />
            </div>
            {coverScheduleHint ? (
              <p className="veveno-card-lead">{coverScheduleHint}</p>
            ) : null}
            <VevenoInput
              label={t('schedule.memo')}
              value={coverForm.note}
              onChange={(e) => setCoverForm((prev) => ({ ...prev, note: e.target.value }))}
            />
            <VevenoButton type="submit" loading={submittingCover}>
              {owned
                ? t('schedule.assignPending', { kind: shiftKindLabel(coverForm.shiftKind, t) })
                : t('schedule.requestKind', { kind: shiftKindLabel(coverForm.shiftKind, t) })}
            </VevenoButton>
          </form>
        </VevenoCard>
      ) : null}

      <VevenoCard title={t('schedule.manageTitle')} className="veveno-schedule-panels__span">
        {pendingCovers.length === 0 ? (
          <p className="veveno-empty">{t('schedule.manageEmpty')}</p>
        ) : (
          <div className="veveno-stack">
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
                  ? t('schedule.extraRow', { name: cover.coverNickname || t('schedule.extraFallback') })
                  : t('schedule.coverRow', { from: cover.originalNickname, to: cover.coverNickname || t('schedule.coverUnassigned') });
              return (
                <div key={cover.id} className="veveno-search-result">
                  <div>
                    <p className="veveno-store-row__name">{title}</p>
                    <p className="veveno-store-row__sub">
                      {cover.workDate} {formatTime(cover.startTime)}–
                      {formatTime(cover.endTime)}
                      {cover.overnight ? t('schedule.nextDayParen') : ''} ·{' '}
                      {coverStatusLabel(cover.status, kind, t)}
                    </p>
                  </div>
                  <div className="veveno-search-result__actions">
                    {canAssign ? (
                      <>
                        <select
                          className="veveno-field__input"
                          aria-label={t('schedule.coverSelectAria', { name: cover.originalNickname })}
                          value={coverAssignments[cover.id] ?? ''}
                          onChange={(e) =>
                            setCoverAssignments((prev) => ({
                              ...prev,
                              [cover.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">{t('schedule.pickCover')}</option>
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
                        <VevenoButton
                          size="sm"
                          disabled={!coverAssignments[cover.id]}
                          onClick={() => {
                            const coverUserId = coverAssignments[cover.id];
                            if (!coverUserId) return;
                            void (async () => {
                              try {
                                await vevenoApi.assignCover(cover.id, coverUserId);
                                setCoverAssignments((prev) => {
                                  const next = { ...prev };
                                  delete next[cover.id];
                                  return next;
                                });
                                await load();
                              } catch (err: unknown) {
                                onError(getVevenoErrorMessage(err, t('errors.failAssignCover'), t));
                              }
                            })();
                          }}
                        >
                          {t('schedule.assign')}
                        </VevenoButton>
                      </>
                    ) : null}
                    {canOwnerApproveExtra ? (
                      <VevenoButton
                        size="sm"
                        onClick={() => {
                          void (async () => {
                            try {
                              await vevenoApi.acceptCover(cover.id);
                              await load();
                            } catch (err: unknown) {
                              onError(getVevenoErrorMessage(err, t('errors.failApprove'), t));
                            }
                          })();
                        }}
                      >
                        {t('common.approve')}
                      </VevenoButton>
                    ) : null}
                    {canAccept ? (
                      <VevenoButton
                        size="sm"
                        onClick={() => {
                          void (async () => {
                            try {
                              await vevenoApi.acceptCover(cover.id);
                              await load();
                            } catch (err: unknown) {
                              onError(getVevenoErrorMessage(err, t('errors.failAccept'), t));
                            }
                          })();
                        }}
                      >
                        {t('schedule.accept')}
                      </VevenoButton>
                    ) : null}
                    {canReject ? (
                      <VevenoButton
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          void (async () => {
                            try {
                              await vevenoApi.rejectCover(cover.id);
                              await load();
                            } catch (err: unknown) {
                              onError(getVevenoErrorMessage(err, t('errors.failReject'), t));
                            }
                          })();
                        }}
                      >
                        {t('common.reject')}
                      </VevenoButton>
                    ) : null}
                    {canCancel ? (
                      <VevenoButton
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const isApproved = cover.status === 'APPROVED';
                          if (
                            isApproved
                            && !window.confirm(
                              kind === 'EXTRA'
                                ? t('schedule.confirmCancelExtra')
                                : t('schedule.confirmCancelCover'),
                            )
                          ) {
                            return;
                          }
                          void (async () => {
                            try {
                              await vevenoApi.cancelCover(cover.id);
                              await load();
                            } catch (err: unknown) {
                              onError(getVevenoErrorMessage(err, t('errors.failCancel'), t));
                            }
                          })();
                        }}
                      >
                        {t('common.cancel')}
                      </VevenoButton>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </VevenoCard>
      </div>
      <VevenoModal
        open={applyPickerMode !== null}
        title={applyPickerMode === 'ONCE' ? t('schedule.pickerOnce') : t('schedule.pickerFrom')}
        onClose={() => {
          if (!savingSchedule) {
            setApplyPickerMode(null);
          }
        }}
        closeOnBackdrop={!savingSchedule}
      >
        <p className="veveno-modal__lead">
          {applyPickerMode === 'ONCE'
            ? t('schedule.pickerOnceLead')
            : t('schedule.pickerFromLead')}
        </p>
        <div className="veveno-schedule-nav">
          <button
            type="button"
            className="veveno-schedule-nav__arrow"
            aria-label={t('schedule.prevMonth')}
            onClick={() =>
              setPickerAnchor(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
              )
            }
          >
            ‹
          </button>
          <span className="veveno-schedule-range">{pickerRange.label}</span>
          <button
            type="button"
            className="veveno-schedule-nav__arrow"
            aria-label={t('schedule.nextMonth')}
            onClick={() =>
              setPickerAnchor(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
              )
            }
          >
            ›
          </button>
        </div>
        <div className="veveno-date-picker">
          {dayLabels.map((label) => (
            <div key={`pick-wd-${label}`} className="veveno-date-picker__weekday">
              {label}
            </div>
          ))}
          {Array.from({ length: pickerRange.leadingEmpty }, (_, i) => (
            <div key={`pick-empty-${i}`} className="veveno-date-picker__day is-empty" />
          ))}
          {pickerRange.days.map((day) => {
            const key = toDateKey(day);
            const isToday = key === toDateKey(new Date());
            const selected = key === pickerSelected;
            return (
              <button
                key={key}
                type="button"
                className={`veveno-date-picker__day${isToday ? ' is-today' : ''}${
                  selected ? ' is-selected' : ''
                }`}
                onClick={() => setPickerSelected(key)}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
        <div className="veveno-modal__actions">
          <VevenoButton
            type="button"
            variant="secondary"
            disabled={savingSchedule}
            onClick={() => setApplyPickerMode(null)}
          >
            {t('common.cancel')}
          </VevenoButton>
          <VevenoButton
            type="button"
            loading={savingSchedule}
            disabled={!pickerSelected}
            onClick={() => {
              if (applyPickerMode && pickerSelected) {
                void handleSaveSchedule(applyPickerMode, pickerSelected);
              }
            }}
          >
            {applyPickerMode === 'ONCE' ? t('schedule.applyOnce') : t('schedule.applyFrom')}
          </VevenoButton>
        </div>
      </VevenoModal>
    </div>
  );
}
