import { useMemo, useState } from 'react';
import { VevenoInput } from './VevenoInput';

type ConcMode = 'dilute' | 'mix' | 'percent';

interface ConcResultRow {
  label: string;
  value: string;
}

function parsePositive(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const normalized = Math.round(n * 1e9) / 1e9;
  if (Object.is(normalized, -0) || normalized === 0) return '0';
  // 최대 6자리까지, 끝의 0·불필요한 소수점은 제거
  return normalized.toFixed(6).replace(/\.?0+$/, '');
}

export function VevenoConcentrationCalculator() {
  const [mode, setMode] = useState<ConcMode>('dilute');

  // dilute: C1 V1 → C2
  const [c1, setC1] = useState('100');
  const [v1, setV1] = useState('100');
  const [c2, setC2] = useState('20');

  // mix: A + B
  const [ca, setCa] = useState('50');
  const [va, setVa] = useState('100');
  const [cb, setCb] = useState('10');
  const [vb, setVb] = useState('100');

  // percent: solute / solution
  const [solute, setSolute] = useState('20');
  const [solution, setSolution] = useState('100');

  const results = useMemo((): ConcResultRow[] | null => {
    if (mode === 'dilute') {
      const startC = parsePositive(c1);
      const startV = parsePositive(v1);
      const targetC = parsePositive(c2);
      if (startC == null || startV == null || targetC == null) return null;
      if (startC <= 0 || startV <= 0) return null;
      if (targetC <= 0 || targetC > startC) {
        return [
          {
            label: '안내',
            value: '목표 농도는 시작 농도보다 낮고 0보다 커야 합니다.',
          },
        ];
      }
      const finalV = (startC * startV) / targetC;
      const addV = finalV - startV;
      return [
        { label: '최종 부피 (ml)', value: formatNumber(finalV) },
        { label: '추가할 용매 (ml)', value: formatNumber(addV) },
      ];
    }

    if (mode === 'mix') {
      const aC = parsePositive(ca);
      const aV = parsePositive(va);
      const bC = parsePositive(cb);
      const bV = parsePositive(vb);
      if (aC == null || aV == null || bC == null || bV == null) return null;
      if (aV <= 0 && bV <= 0) return null;
      const totalV = aV + bV;
      if (totalV <= 0) return null;
      const finalC = (aC * aV + bC * bV) / totalV;
      return [
        { label: '혼합 후 농도 (%)', value: formatNumber(finalC) },
        { label: '혼합 후 부피 (ml)', value: formatNumber(totalV) },
      ];
    }

    const soluteAmt = parsePositive(solute);
    const solutionAmt = parsePositive(solution);
    if (soluteAmt == null || solutionAmt == null) return null;
    if (solutionAmt <= 0) return null;
    if (soluteAmt > solutionAmt) {
      return [
        {
          label: '안내',
          value: '용질량은 용액량보다 클 수 없습니다.',
        },
      ];
    }
    const pct = (soluteAmt / solutionAmt) * 100;
    return [{ label: '농도 (%)', value: formatNumber(pct) }];
  }, [mode, c1, v1, c2, ca, va, cb, vb, solute, solution]);

  return (
    <div className="veveno-tools-block">
      <h3 className="veveno-tools-block__title">농도 계산기</h3>
      <p className="veveno-tools-block__lead">
        원액 희석·두 용액 혼합·함량 %를 바로 계산합니다. 농도는 %, 부피는 ml 기준입니다.
      </p>

      <div
        className="veveno-tools-seg veveno-tools-seg--main"
        role="tablist"
        aria-label="농도 계산 모드"
      >
        {(
          [
            ['dilute', '희석'],
            ['mix', '혼합'],
            ['percent', '함량 %'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={mode === id ? 'is-active' : ''}
            aria-selected={mode === id}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="veveno-unit-grid">
        {mode === 'dilute' ? (
          <>
            <VevenoInput
              id="veveno-conc-c1"
              label="시작 농도 (%)"
              inputMode="decimal"
              value={c1}
              onChange={(e) => setC1(e.target.value)}
            />
            <VevenoInput
              id="veveno-conc-v1"
              label="시작 부피 (ml)"
              inputMode="decimal"
              value={v1}
              onChange={(e) => setV1(e.target.value)}
            />
            <VevenoInput
              id="veveno-conc-c2"
              label="목표 농도 (%)"
              inputMode="decimal"
              value={c2}
              onChange={(e) => setC2(e.target.value)}
            />
          </>
        ) : null}

        {mode === 'mix' ? (
          <>
            <VevenoInput
              id="veveno-conc-ca"
              label="용액 A 농도 (%)"
              inputMode="decimal"
              value={ca}
              onChange={(e) => setCa(e.target.value)}
            />
            <VevenoInput
              id="veveno-conc-va"
              label="용액 A 부피 (ml)"
              inputMode="decimal"
              value={va}
              onChange={(e) => setVa(e.target.value)}
            />
            <VevenoInput
              id="veveno-conc-cb"
              label="용액 B 농도 (%)"
              inputMode="decimal"
              value={cb}
              onChange={(e) => setCb(e.target.value)}
            />
            <VevenoInput
              id="veveno-conc-vb"
              label="용액 B 부피 (ml)"
              inputMode="decimal"
              value={vb}
              onChange={(e) => setVb(e.target.value)}
            />
          </>
        ) : null}

        {mode === 'percent' ? (
          <>
            <VevenoInput
              id="veveno-conc-solute"
              label="용질량"
              inputMode="decimal"
              value={solute}
              onChange={(e) => setSolute(e.target.value)}
            />
            <VevenoInput
              id="veveno-conc-solution"
              label="용액량 (같은 단위)"
              inputMode="decimal"
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
            />
          </>
        ) : null}
      </div>

      <div className="veveno-unit-result veveno-conc-result" aria-live="polite">
        {results == null ? (
          <>
            <p className="veveno-unit-result__label">결과</p>
            <p className="veveno-unit-result__value">—</p>
          </>
        ) : (
          results.map((row) => (
            <div key={row.label} className="veveno-conc-result__row">
              <p className="veveno-unit-result__label">{row.label}</p>
              <p className="veveno-unit-result__value">{row.value}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
