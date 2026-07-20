import { useEffect, useMemo, useState } from 'react';
import type { BrewCalendarOccurrence } from '../../types/brew';
import {
  BREW_HOUR_HEIGHT_PX,
  buildBrewStaffColorMap,
  getBrewStaffColor,
  getBrewWeekTimetableRange,
  layoutBrewDayTimetableBlocks,
  occurrencesForDate,
  type BrewStaffColor,
  type BrewTimetableSegment,
} from './brewTimetableUtils';

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;

interface BrewWeekTimelineViewProps {
  days: Date[];
  occurrences: BrewCalendarOccurrence[];
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

function blockTitle(occ: BrewCalendarOccurrence): string {
  const time = `${formatTime(occ.startTime)}–${formatTime(occ.endTime)}${
    occ.overnight ? ' (익일)' : ''
  }`;
  if (occ.type === 'COVER') {
    return `${occ.nickname} 대타(${occ.relatedNickname ?? ''})\n${time}`;
  }
  return `${occ.nickname}\n${time}`;
}

function segmentClassName(segment: BrewTimetableSegment): string {
  const parts = [
    'brew-tt-block',
    `brew-tt-block--${segment.occurrence.type.toLowerCase()}`,
  ];
  if (!segment.isFirst) {
    parts.push('brew-tt-block--cont');
  }
  if (!segment.isLast) {
    parts.push('brew-tt-block--cont-next');
  }
  return parts.join(' ');
}

function DayColumn({
  dayOccurrences,
  rangeHeight,
  hourCount,
  range,
  colorMap,
}: {
  dayOccurrences: BrewCalendarOccurrence[];
  rangeHeight: number;
  hourCount: number;
  range: ReturnType<typeof getBrewWeekTimetableRange>;
  colorMap: Map<string, BrewStaffColor>;
}) {
  const segments = layoutBrewDayTimetableBlocks(dayOccurrences, range);

  return (
    <div className="brew-tt-day" style={{ height: rangeHeight }}>
      {Array.from({ length: hourCount }, (_, hourIndex) => (
        <div
          key={hourIndex}
          className="brew-tt-hour-line"
          style={{ top: hourIndex * BREW_HOUR_HEIGHT_PX, height: BREW_HOUR_HEIGHT_PX }}
        />
      ))}
      {segments.map((segment) => {
        const color =
          colorMap.get(segment.occurrence.userId)
          ?? getBrewStaffColor(segment.occurrence.userId);
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
            title={blockTitle(segment.occurrence)}
          >
            {segment.showLabel ? (
              <>
                <p className="brew-tt-block__name">{segment.occurrence.nickname}</p>
                <p className="brew-tt-block__time">
                  {formatTime(segment.occurrence.startTime)}–
                  {formatTime(segment.occurrence.endTime)}
                  {segment.occurrence.overnight ? ' ·익일' : ''}
                </p>
                {segment.occurrence.type === 'COVER' ? (
                  <p className="brew-tt-block__meta">
                    대타 · {segment.occurrence.relatedNickname}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function BrewWeekTimelineView({
  days,
  occurrences,
  staffUserIds,
}: BrewWeekTimelineViewProps) {
  const colorMap = useMemo(
    () =>
      buildBrewStaffColorMap([
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
    () => getBrewWeekTimetableRange(occurrences),
    [occurrences],
  );

  const selectedDay = days.find((d) => toDateKey(d) === selectedKey) ?? days[0];

  return (
    <div className="brew-tt">
      <div className="brew-tt-strip brew-tt-strip--mobile">
        {days.map((day, index) => {
          const key = toDateKey(day);
          const isToday = key === todayKey;
          const selected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              className={`brew-tt-strip__day${selected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
              onClick={() => setSelectedKey(key)}
            >
              <span className="brew-tt-strip__wd">{DAY_LABELS[index]}</span>
              <span className="brew-tt-strip__num">{day.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="brew-tt-mobile">
        {selectedDay ? (
          <>
            <p className="brew-tt-mobile__label">
              {selectedDay.getMonth() + 1}월 {selectedDay.getDate()}일 (
              {DAY_LABELS[(selectedDay.getDay() + 6) % 7]})
            </p>
            <div className="brew-tt-scroll">
              <div
                className="brew-tt-body"
                style={{ gridTemplateColumns: '40px minmax(0, 1fr)' }}
              >
                <div className="brew-tt-gutter">
                  {range.hourLabels.map((label, index) => (
                    <div
                      key={label}
                      className="brew-tt-gutter__hour"
                      style={{
                        height: BREW_HOUR_HEIGHT_PX,
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
                />
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="brew-tt-desktop">
        <div
          className="brew-tt-strip brew-tt-strip--desktop"
          style={{ gridTemplateColumns: '48px repeat(7, minmax(0, 1fr))' }}
        >
          <div className="brew-tt-strip__gutter" />
          {days.map((day, index) => {
            const key = toDateKey(day);
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={`brew-tt-strip__day brew-tt-strip__day--static${isToday ? ' is-today' : ''}`}
              >
                <span className="brew-tt-strip__wd">{DAY_LABELS[index]}</span>
                <span className="brew-tt-strip__num">{day.getDate()}</span>
              </div>
            );
          })}
        </div>
        <div className="brew-tt-scroll">
          <div
            className="brew-tt-body"
            style={{ gridTemplateColumns: '48px repeat(7, minmax(0, 1fr))' }}
          >
            <div className="brew-tt-gutter">
              {range.hourLabels.map((label, index) => (
                <div
                  key={label}
                  className="brew-tt-gutter__hour"
                  style={{
                    height: BREW_HOUR_HEIGHT_PX,
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
                  className={`brew-tt-col${key === todayKey ? ' is-today' : ''}`}
                >
                  <DayColumn
                    dayOccurrences={occurrencesForDate(occurrences, key)}
                    rangeHeight={range.totalHeight}
                    hourCount={range.hourLabels.length}
                    range={range}
                    colorMap={colorMap}
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
