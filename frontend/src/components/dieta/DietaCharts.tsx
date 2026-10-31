import type { ReactNode } from 'react';

export interface DietaChartPoint {
  date: string;
  value: number;
  /** Optional: ONBOARDING | CHECK_IN | DAILY_FASTED | MANUAL */
  source?: string;
}

function formatShortDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length < 3) return iso;
  return `${parts[1]}.${parts[2]}`;
}

function sourceLabel(source?: string): string {
  if (source === 'CHECK_IN') return '체크인';
  if (source === 'ONBOARDING') return '온보딩';
  if (source === 'DAILY_FASTED') return '매일';
  if (source === 'MANUAL') return '수동';
  return '';
}

interface DietaSparklineProps {
  label: string;
  points: DietaChartPoint[];
  unit: string;
}

export function DietaSparkline({ label, points, unit }: DietaSparklineProps) {
  const width = 120;
  const height = 40;
  const usable = [...points]
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = usable.at(-1) ?? null;
  let path = '';
  const dots: Array<{ x: number; y: number }> = [];
  if (usable.length >= 1) {
    const min = Math.min(...usable.map((p) => p.value));
    const max = Math.max(...usable.map((p) => p.value));
    const span = max - min || 1;
    const n = Math.max(usable.length - 1, 1);
    usable.forEach((p, i) => {
      const x = usable.length === 1 ? width / 2 : (i / n) * (width - 8) + 4;
      const y = height - 6 - ((p.value - min) / span) * (height - 12);
      dots.push({ x, y });
    });
    if (usable.length >= 2) {
      path = dots
        .map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(1)},${d.y.toFixed(1)}`)
        .join(' ');
    }
  }

  return (
    <div className="dieta-spark__item">
      <span className="dieta-spark__label">{label}</span>
      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden>
        {path ? (
          <path
            d={path}
            fill="none"
            stroke="var(--dieta-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="2.2" fill="var(--dieta-accent)" />
        ))}
        {!dots.length ? (
          <line
            x1="8"
            y1={height / 2}
            x2={width - 8}
            y2={height / 2}
            stroke="var(--dieta-line)"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        ) : null}
      </svg>
      <strong className="dieta-spark__value">
        {latest != null ? `${latest.value.toFixed(1)}${unit}` : '—'}
      </strong>
      <em className="dieta-spark__meta">
        {latest
          ? `${formatShortDate(latest.date)}${
              sourceLabel(latest.source) ? ` · ${sourceLabel(latest.source)}` : ''
            }`
          : '\u00a0'}
      </em>
    </div>
  );
}

interface DietaLineChartProps {
  title: string;
  points: DietaChartPoint[];
  unit: string;
  /** Shared date axis (oldest → newest). Aligns dots across charts. */
  timeline?: string[];
}

export function DietaLineChart({
  title,
  points,
  unit,
  timeline,
}: DietaLineChartProps) {
  const width = 360;
  const height = 168;
  const padL = 44;
  const padR = 16;
  const padT = 22;
  const padB = 28;

  const byDate = new Map(
    [...points]
      .filter((p) => Number.isFinite(p.value))
      .map((p) => [p.date, p] as const),
  );

  const axis =
    timeline && timeline.length > 0
      ? [...timeline].sort((a, b) => a.localeCompare(b))
      : [...byDate.keys()].sort((a, b) => a.localeCompare(b));

  const sorted = axis
    .map((date) => byDate.get(date))
    .filter((p): p is DietaChartPoint => p != null);

  const latest = sorted.at(-1) ?? null;
  const oldest = axis[0] ?? null;
  const newest = axis.at(-1) ?? null;

  let body: ReactNode;
  if (axis.length === 0) {
    body = (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={title}
        className="dieta-chart-svg"
      >
        <line
          x1={padL}
          y1={height / 2}
          x2={width - padR}
          y2={height / 2}
          stroke="var(--dieta-line)"
          strokeWidth="2"
          strokeDasharray="6 6"
        />
        <text
          x={width / 2}
          y={height / 2 - 10}
          textAnchor="middle"
          className="dieta-chart-axis"
        >
          기록 없음
        </text>
      </svg>
    );
  } else {
    const values = sorted.map((p) => p.value);
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 1;
    const span = max - min || 1;
    const n = Math.max(axis.length - 1, 1);

    const xAt = (date: string): number => {
      if (axis.length === 1) {
        return (padL + width - padR) / 2;
      }
      const i = axis.indexOf(date);
      return padL + (i / n) * (width - padL - padR);
    };

    const coords = sorted.map((p) => {
      const x = xAt(p.date);
      const y = padT + (1 - (p.value - min) / span) * (height - padT - padB);
      return { ...p, x, y };
    });

    const pathSegments: string[] = [];
    let segment = '';
    for (let i = 0; i < axis.length; i += 1) {
      const p = byDate.get(axis[i]);
      if (!p) {
        if (segment) {
          pathSegments.push(segment);
          segment = '';
        }
        continue;
      }
      const x = xAt(p.date);
      const y = padT + (1 - (p.value - min) / span) * (height - padT - padB);
      segment += `${segment ? 'L' : 'M'}${x},${y}`;
    }
    if (segment) {
      pathSegments.push(segment);
    }

    const showEvery = Math.max(1, Math.ceil(axis.length / 6));

    body = (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={title}
        className="dieta-chart-svg"
      >
        {axis.map((date) => {
          const x = xAt(date);
          return (
            <line
              key={`guide-${date}`}
              x1={x}
              y1={padT}
              x2={x}
              y2={height - padB}
              stroke="var(--dieta-line)"
              strokeWidth="1"
            />
          );
        })}
        {sorted.length > 0 ? (
          <>
            <text
              x={padL - 6}
              y={padT + 4}
              textAnchor="end"
              className="dieta-chart-axis"
            >
              {max.toFixed(1)}
            </text>
            <text
              x={padL - 6}
              y={height - padB}
              textAnchor="end"
              className="dieta-chart-axis"
            >
              {min.toFixed(1)}
            </text>
          </>
        ) : (
          <text
            x={width / 2}
            y={(padT + height - padB) / 2}
            textAnchor="middle"
            className="dieta-chart-axis"
          >
            이 항목 기록 없음
          </text>
        )}
        {pathSegments.map((seg, i) => (
          <path
            key={`seg-${i}`}
            d={seg}
            fill="none"
            stroke="var(--dieta-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {coords.map((c, i) => (
          <g key={`${c.date}-${i}`}>
            <circle cx={c.x} cy={c.y} r="3.5" fill="var(--dieta-accent)" />
            {i === coords.length - 1 && <text
              x={c.x}
              y={c.y - 8}
              textAnchor="middle"
              className="dieta-chart-value"
            >
              {c.value.toFixed(1)}
            </text>}
          </g>
        ))}
        {axis.map((date, i) =>
          i % showEvery === 0 || i === axis.length - 1 ? (
            <text
              key={`lbl-${date}`}
              x={xAt(date)}
              y={height - 8}
              textAnchor="middle"
              className="dieta-chart-axis"
            >
              {formatShortDate(date)}
            </text>
          ) : null,
        )}
      </svg>
    );
  }

  return (
    <div className="dieta-chart-block">
      <div className="dieta-chart-head">
        <h3>{title}</h3>
        <p className="dieta-chart-latest">
          {latest
            ? `${latest.value.toFixed(1)}${unit} · ${formatShortDate(latest.date)}`
            : '—'}
        </p>
        <p className="dieta-chart-dir dieta-muted">
          {oldest && newest
            ? `${formatShortDate(oldest)} → ${formatShortDate(newest)} · 왼쪽 과거 · 오른쪽 최근`
            : '이 기간에 기록이 없어요. 오늘 체중을 남겨 보세요.'}
        </p>
      </div>
      {body}
      {sorted.length > 0 && <details className="dieta-details"><summary>기록을 표로 보기 ({sorted.length}일)</summary><table className="dieta-chart-table"><caption>{title} 기록</caption><thead><tr><th scope="col">날짜</th><th scope="col">{title} ({unit})</th><th scope="col">기록 종류</th></tr></thead><tbody>{sorted.map(p => <tr key={p.date}><td>{p.date}</td><td>{p.value.toFixed(1)}</td><td>{sourceLabel(p.source)}</td></tr>)}</tbody></table></details>}
    </div>
  );
}
