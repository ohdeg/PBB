import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../features/veveno/i18n/LanguageContext';
import { vevenoWeekdayLabels, type TranslateFn } from '../../features/veveno/i18n/translate';
import type { VevenoCalendarOccurrence } from '../../types/veveno';
import {
  VEVENO_HOUR_HEIGHT_PX,
  buildVevenoStaffColorMap,
  getVevenoStaffColor,
  getVevenoWeekTimetableRange,
  layoutVevenoDayTimetableBlocks,
  occurrencesForDate,
  type VevenoStaffColor,
  type VevenoTimetableSegment,
} from './vevenoTimetableUtils';

interface VevenoWeekTimelineViewProps {
  days: Date[];
  occurrences: VevenoCalendarOccurrence[];
  staffUserIds: string[];
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function blockTitle(occ: VevenoCalendarOccurrence, t: TranslateFn): string {
  const time = `${formatTime(occ.startTime)}–${formatTime(occ.endTime)}${
    occ.overnight ? t('schedule.nextDayParen') : ''
  }`;
  if (occ.type === 'COVER') {
    return t('schedule.coverTitle', {
      nickname: occ.nickname,
      related: occ.relatedNickname ?? '',
      time,
    });
  }
  if (occ.type === 'EXTRA') {
    return t('schedule.extraTitle', { nickname: occ.nickname, time });
  }
  return `${occ.nickname}\n${time}`;
}

function segmentClassName(segment: VevenoTimetableSegment): string {
  const parts = [
    'veveno-tt-block',
    `veveno-tt-block--${segment.occurrence.type.toLowerCase()}`,
  ];
  if (!segment.isFirst) {
    parts.push('veveno-tt-block--cont');
  }
  if (!segment.isLast) {
    parts.push('veveno-tt-block--cont-next');
  }
  return parts.join(' ');
}

function DayColumn({
  dayOccurrences,
  rangeHeight,
  hourCount,
  range,
  colorMap,
  t,
}: {
  dayOccurrences: VevenoCalendarOccurrence[];
  rangeHeight: number;
  hourCount: number;
  range: ReturnType<typeof getVevenoWeekTimetableRange>;
  colorMap: Map<string, VevenoStaffColor>;
  t: TranslateFn;
}) {
  const segments = layoutVevenoDayTimetableBlocks(dayOccurrences, range);

  return (
    <div className="veveno-tt-day" style={{ height: rangeHeight }}>
      {Array.from({ length: hourCount }, (_, hourIndex) => (
        <div
          key={hourIndex}
          className="veveno-tt-hour-line"
          style={{ top: hourIndex * VEVENO_HOUR_HEIGHT_PX, height: VEVENO_HOUR_HEIGHT_PX }}
        />
      ))}
      {segments.map((segment) => {
        const color =
          colorMap.get(segment.occurrence.userId)
          ?? getVevenoStaffColor(segment.occurrence.userId);
        return (
          <div
            key={segment.layoutKey}
            className={segmentClassName(segment)}
            style={{
              top: segment.top,
              height: segment.height,
              left: `${segment.leftPercent}%`,
              width: `${segment.widthPercent}%`,
              background: color.bg,
              borderColor: color.border,
              color: color.text,
            }}
            title={blockTitle(segment.occurrence, t)}
          >
            {segment.showLabel ? (
              <>
                <p className="veveno-tt-block__name">{segment.occurrence.nickname}</p>
                <p className="veveno-tt-block__time">
                  {formatTime(segment.occurrence.startTime)}–
                  {formatTime(segment.occurrence.endTime)}
                  {segment.occurrence.overnight ? t('schedule.nextDayDot') : ''}
                </p>
                {segment.occurrence.type === 'COVER' ? (
                  <p className="veveno-tt-block__meta">
                    {t('schedule.coverMeta', {
                      related: segment.occurrence.relatedNickname ?? '',
                    })}
                  </p>
                ) : null}
                {segment.occurrence.type === 'EXTRA' ? (
                  <p className="veveno-tt-block__meta">{t('schedule.extra')}</p>
                ) : null}
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function VevenoWeekTimelineView({
  days,
  occurrences,
  staffUserIds,
}: VevenoWeekTimelineViewProps) {
  const t = useTranslation();
  const dayLabels = vevenoWeekdayLabels(t);
  const colorMap = useMemo(
    () =>
      buildVevenoStaffColorMap([
        ...staffUserIds,
        ...occurrences.map((occ) => occ.userId),
      ]),
    [occurrences, staffUserIds],
  );
  const todayKey = toDateKey(new Date());
  const dayKeys = days.map((d) => toDateKey(d)).join('|');
  const [selectedKey, setSelectedKey] = useState(() => {
    const todayInWeek = days.find((d) => toDateKey(d) === todayKey);
    return toDateKey(todayInWeek ?? days[0] ?? new Date());
  });

  useEffect(() => {
    const keys = days.map((d) => toDateKey(d));
    if (keys.includes(selectedKey)) {
      return;
    }
    const todayInWeek = days.find((d) => toDateKey(d) === todayKey);
    setSelectedKey(toDateKey(todayInWeek ?? days[0] ?? new Date()));
  }, [dayKeys, days, selectedKey, todayKey]);

  const range = useMemo(
    () => getVevenoWeekTimetableRange(occurrences, t('schedule.nextDay')),
    [occurrences, t],
  );

  const selectedDay = days.find((d) => toDateKey(d) === selectedKey) ?? days[0];

  return (
    <div className="veveno-tt">
      <div className="veveno-tt-strip veveno-tt-strip--mobile">
        {days.map((day, index) => {
          const key = toDateKey(day);
          const isToday = key === todayKey;
          const selected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              className={`veveno-tt-strip__day${selected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
              onClick={() => setSelectedKey(key)}
            >
              <span className="veveno-tt-strip__wd">{dayLabels[index]}</span>
              <span className="veveno-tt-strip__num">{day.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="veveno-tt-mobile">
        {selectedDay ? (
          <>
            <p className="veveno-tt-mobile__label">
              {t('schedule.monthDay', {
                month: selectedDay.getMonth() + 1,
                day: selectedDay.getDate(),
              })}{' '}
              ({dayLabels[(selectedDay.getDay() + 6) % 7]})
            </p>
            <div className="veveno-tt-scroll">
              <div
                className="veveno-tt-body"
                style={{ gridTemplateColumns: '40px minmax(0, 1fr)' }}
              >
                <div className="veveno-tt-gutter">
                  {range.hourLabels.map((label, index) => (
                    <div
                      key={label}
                      className="veveno-tt-gutter__hour"
                      style={{
                        height: VEVENO_HOUR_HEIGHT_PX,
                        paddingTop: index === 0 ? 4 : 0,
                      }}
                    >
                      {label}
                    </div>
                  ))}
                </div>
                <DayColumn
                  dayOccurrences={occurrencesForDate(occurrences, toDateKey(selectedDay))}
                  rangeHeight={range.totalHeight}
                  hourCount={range.hourLabels.length}
                  range={range}
                  colorMap={colorMap}
                  t={t}
                />
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="veveno-tt-desktop">
        <div
          className="veveno-tt-strip veveno-tt-strip--desktop"
          style={{ gridTemplateColumns: '48px repeat(7, minmax(0, 1fr))' }}
        >
          <div className="veveno-tt-strip__gutter" />
          {days.map((day, index) => {
            const key = toDateKey(day);
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={`veveno-tt-strip__day veveno-tt-strip__day--static${isToday ? ' is-today' : ''}`}
              >
                <span className="veveno-tt-strip__wd">{dayLabels[index]}</span>
                <span className="veveno-tt-strip__num">{day.getDate()}</span>
              </div>
            );
          })}
        </div>
        <div className="veveno-tt-scroll">
          <div
            className="veveno-tt-body"
            style={{ gridTemplateColumns: '48px repeat(7, minmax(0, 1fr))' }}
          >
            <div className="veveno-tt-gutter">
              {range.hourLabels.map((label, index) => (
                <div
                  key={label}
                  className="veveno-tt-gutter__hour"
                  style={{
                    height: VEVENO_HOUR_HEIGHT_PX,
                    paddingTop: index === 0 ? 4 : 0,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
            {days.map((day) => {
              const key = toDateKey(day);
              return (
                <div
                  key={key}
                  className={`veveno-tt-col${key === todayKey ? ' is-today' : ''}`}
                >
                  <DayColumn
                    dayOccurrences={occurrencesForDate(occurrences, key)}
                    rangeHeight={range.totalHeight}
                    hourCount={range.hourLabels.length}
                    range={range}
                    colorMap={colorMap}
                    t={t}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
