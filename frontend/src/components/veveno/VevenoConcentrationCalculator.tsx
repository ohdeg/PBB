import { useMemo, useState } from 'react';
import { useTranslation } from '../../features/veveno/i18n/LanguageContext';
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
  const t = useTranslation();
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
            label: t('concentration.hint'),
            value: t('concentration.diluteHint'),
          },
        ];
      }
      const finalV = (startC * startV) / targetC;
      const addV = finalV - startV;
      return [
        { label: t('concentration.finalV'), value: formatNumber(finalV) },
        { label: t('concentration.addSolvent'), value: formatNumber(addV) },
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
        { label: t('concentration.mixC'), value: formatNumber(finalC) },
        { label: t('concentration.mixV'), value: formatNumber(totalV) },
      ];
    }

    const soluteAmt = parsePositive(solute);
    const solutionAmt = parsePositive(solution);
    if (soluteAmt == null || solutionAmt == null) return null;
    if (solutionAmt <= 0) return null;
    if (soluteAmt > solutionAmt) {
      return [
        {
          label: t('concentration.hint'),
          value: t('concentration.percentHint'),
        },
      ];
    }
    const pct = (soluteAmt / solutionAmt) * 100;
    return [{ label: t('concentration.percentResult'), value: formatNumber(pct) }];
  }, [mode, c1, v1, c2, ca, va, cb, vb, solute, solution, t]);

  return (
    <div className="veveno-tools-block">
      <h3 className="veveno-tools-block__title">{t('concentration.title')}</h3>
      <p className="veveno-tools-block__lead">{t('concentration.lead')}</p>

      <div
        className="veveno-tools-seg veveno-tools-seg--main"
        role="tablist"
        aria-label={t('concentration.modeAria')}
      >
        {(
          [
            ['dilute', t('concentration.dilute')],
            ['mix', t('concentration.mix')],
            ['percent', t('concentration.percent')],
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
              label={t('concentration.startC')}
              inputMode="decimal"
              value={c1}
              onChange={(e) => setC1(e.target.value)}
            />
            <VevenoInput
              id="veveno-conc-v1"
              label={t('concentration.startV')}
              inputMode="decimal"
              value={v1}
              onChange={(e) => setV1(e.target.value)}
            />
            <VevenoInput
              id="veveno-conc-c2"
              label={t('concentration.targetC')}
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
              label={t('concentration.aC')}
              inputMode="decimal"
              value={ca}
              onChange={(e) => setCa(e.target.value)}
            />
            <VevenoInput
              id="veveno-conc-va"
              label={t('concentration.aV')}
              inputMode="decimal"
              value={va}
              onChange={(e) => setVa(e.target.value)}
            />
            <VevenoInput
              id="veveno-conc-cb"
              label={t('concentration.bC')}
              inputMode="decimal"
              value={cb}
              onChange={(e) => setCb(e.target.value)}
            />
            <VevenoInput
              id="veveno-conc-vb"
              label={t('concentration.bV')}
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
              label={t('concentration.solute')}
              inputMode="decimal"
              value={solute}
              onChange={(e) => setSolute(e.target.value)}
            />
            <VevenoInput
              id="veveno-conc-solution"
              label={t('concentration.solution')}
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
            <p className="veveno-unit-result__label">{t('concentration.result')}</p>
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
