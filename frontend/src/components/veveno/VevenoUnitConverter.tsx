import { useMemo, useState } from 'react';
import { BrewInput } from './BrewInput';

type UnitKind = 'mass' | 'volume' | 'temp' | 'scale';

interface UnitDef {
  id: string;
  label: string;
  /** factor to base unit (g / ml). For temp unused. */
  toBase?: number;
}

const MASS_UNITS: UnitDef[] = [
  { id: 'g', label: 'g', toBase: 1 },
  { id: 'kg', label: 'kg', toBase: 1000 },
  { id: 'oz', label: 'oz', toBase: 28.349523125 },
  { id: 'lb', label: 'lb', toBase: 453.59237 },
];

const VOLUME_UNITS: UnitDef[] = [
  { id: 'ml', label: 'ml', toBase: 1 },
  { id: 'l', label: 'L', toBase: 1000 },
  { id: 'cup', label: 'cup (US)', toBase: 240 },
  { id: 'floz', label: 'fl oz', toBase: 29.5735295625 },
  { id: 'tbsp', label: 'tbsp', toBase: 15 },
  { id: 'tsp', label: 'tsp', toBase: 5 },
];

function convertMassOrVolume(
  value: number,
  from: UnitDef,
  to: UnitDef,
): number {
  if (!from.toBase || !to.toBase) return value;
  return (value * from.toBase) / to.toBase;
}

function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toFixed(1);
  if (abs >= 100) return n.toFixed(2);
  if (abs >= 1) return n.toFixed(3).replace(/\.?0+$/, '');
  return n.toPrecision(3);
}

export function BrewUnitConverter() {
  const [kind, setKind] = useState<UnitKind>('mass');
  const [amount, setAmount] = useState('100');
  const [fromId, setFromId] = useState('g');
  const [toId, setToId] = useState('oz');
  const [tempUnit, setTempUnit] = useState<'c' | 'f'>('c');
  const [scale, setScale] = useState('2');

  const units = kind === 'mass' ? MASS_UNITS : VOLUME_UNITS;

  const result = useMemo(() => {
    const value = Number(amount);
    if (!Number.isFinite(value)) return null;

    if (kind === 'temp') {
      if (tempUnit === 'c') {
        return { label: '°F', value: cToF(value) };
      }
      return { label: '°C', value: fToC(value) };
    }

    if (kind === 'scale') {
      const factor = Number(scale);
      if (!Number.isFinite(factor) || factor <= 0) return null;
      return { label: '배율 결과', value: value * factor };
    }

    const from = units.find((u) => u.id === fromId);
    const to = units.find((u) => u.id === toId);
    if (!from || !to) return null;
    return {
      label: to.label,
      value: convertMassOrVolume(value, from, to),
    };
  }, [amount, kind, fromId, toId, tempUnit, scale, units]);

  const switchKind = (next: UnitKind) => {
    setKind(next);
    if (next === 'mass') {
      setFromId('g');
      setToId('oz');
    } else if (next === 'volume') {
      setFromId('ml');
      setToId('cup');
    }
  };

  return (
    <div className="brew-tools-block">
      <div className="brew-tools-seg" role="tablist" aria-label="단위 종류">
        {(
          [
            ['mass', '무게'],
            ['volume', '부피'],
            ['temp', '온도'],
            ['scale', '배율'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={kind === id ? 'is-active' : ''}
            aria-selected={kind === id}
            onClick={() => switchKind(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="brew-unit-grid">
        <BrewInput
          id="brew-unit-amount"
          label={kind === 'temp' ? '온도' : kind === 'scale' ? '기준 값' : '값'}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        {kind === 'temp' ? (
          <label className="brew-field">
            <span className="brew-field__label">단위</span>
            <select
              className="brew-field__input"
              value={tempUnit}
              onChange={(e) => setTempUnit(e.target.value === 'f' ? 'f' : 'c')}
            >
              <option value="c">°C → °F</option>
              <option value="f">°F → °C</option>
            </select>
          </label>
        ) : null}

        {kind === 'scale' ? (
          <BrewInput
            id="brew-unit-scale"
            label="배율"
            inputMode="decimal"
            value={scale}
            onChange={(e) => setScale(e.target.value)}
            placeholder="예: 0.5, 2"
          />
        ) : null}

        {kind === 'mass' || kind === 'volume' ? (
          <>
            <label className="brew-field">
              <span className="brew-field__label">From</span>
              <select
                className="brew-field__input"
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="brew-field">
              <span className="brew-field__label">To</span>
              <select
                className="brew-field__input"
                value={toId}
                onChange={(e) => setToId(e.target.value)}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
      </div>

      <div className="brew-unit-result" aria-live="polite">
        <p className="brew-unit-result__label">{result?.label ?? '결과'}</p>
        <p className="brew-unit-result__value">
          {result ? formatNumber(result.value) : '—'}
        </p>
      </div>
    </div>
  );
}
