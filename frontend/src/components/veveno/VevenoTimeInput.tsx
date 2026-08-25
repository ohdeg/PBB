import type { KeyboardEvent } from 'react';
import {
  applyHour12Change,
  formatHHmm,
  hour12FromH24,
  isPm,
  parseHHmm,
  stepHour,
  withPeriod,
} from './vevenoTime';
import { useTranslation } from '../../features/veveno/i18n/LanguageContext';

interface VevenoTimeInputProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function VevenoTimeInput({
  id,
  label,
  value,
  onChange,
  disabled = false,
  className = '',
  'aria-label': ariaLabel,
}: VevenoTimeInputProps) {
  const t = useTranslation();
  const { h24, minute } = parseHHmm(value);
  const hour = hour12FromH24(h24);
  const pm = isPm(h24);
  const groupLabel = ariaLabel ?? label;

  const setTime = (nextH: number, nextM: number) => {
    onChange(formatHHmm(nextH, nextM));
  };

  const onHourKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setTime(stepHour(h24, 1), minute);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setTime(stepHour(h24, -1), minute);
    }
  };

  const field = (
    <div className={`veveno-time ${className}`.trim()}>
      <select
        className="veveno-field__input veveno-time__period"
        aria-label={groupLabel ? `${groupLabel} ${t('time.ampm')}` : t('time.ampm')}
        disabled={disabled}
        value={pm ? 'pm' : 'am'}
        onChange={(e) => setTime(withPeriod(h24, e.target.value === 'pm'), minute)}
      >
        <option value="am">{t('time.am')}</option>
        <option value="pm">{t('time.pm')}</option>
      </select>
      <input
        id={id}
        type="number"
        className="veveno-field__input veveno-time__hour"
        min={0}
        max={13}
        step={1}
        inputMode="numeric"
        disabled={disabled}
        aria-label={groupLabel ? `${groupLabel} ${t('time.hour')}` : t('time.hour')}
        value={hour}
        onKeyDown={onHourKeyDown}
        onChange={(e) => {
          if (e.target.value === '') {
            return;
          }
          const next = Number(e.target.value);
          if (!Number.isFinite(next)) {
            return;
          }
          if (next === 13) {
            setTime(stepHour(h24, 1), minute);
            return;
          }
          if (next === 0) {
            setTime(stepHour(h24, -1), minute);
            return;
          }
          setTime(applyHour12Change(h24, next), minute);
        }}
      />
      <span className="veveno-time__colon" aria-hidden>
        :
      </span>
      <input
        type="number"
        className="veveno-field__input veveno-time__minute"
        min={0}
        max={59}
        inputMode="numeric"
        disabled={disabled}
        aria-label={groupLabel ? `${groupLabel} ${t('time.minute')}` : t('time.minute')}
        value={String(minute).padStart(2, '0')}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!Number.isFinite(next)) {
            return;
          }
          setTime(h24, Math.min(59, Math.max(0, next)));
        }}
      />
    </div>
  );

  if (!label) {
    return field;
  }

  return (
    <div className="veveno-field">
      <label className="veveno-field__label" htmlFor={id}>
        {label}
      </label>
      {field}
    </div>
  );
}
