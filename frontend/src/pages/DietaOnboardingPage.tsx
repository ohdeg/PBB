import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { dietaApi } from '../api/dietaApi';
import type { DietaDietStyle, DietaGoalType, DietaMacroPercents } from '../features/dieta/types';
import { DIETA_STYLE_LABELS, DIETA_STYLE_PRESETS } from '../features/dieta/types';
import { useDietaUserKey } from '../features/dieta/useDietaUserKey';
import { macrosFromDaily, estimateBmrKcal, computeTdee, applyLossDaily, applyGainDaily } from '../features/dieta/utils/dietaMath';
import { useAuthStore } from '../stores/authStore';
import '../features/dieta/dieta.css';

type Step = 0 | 1 | 2 | 3;

export function DietaOnboardingPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const userKey = useDietaUserKey();
  const [step, setStep] = useState<Step>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [heightCm, setHeightCm] = useState('170');
  const [weightKg, setWeightKg] = useState('70');
  const [age, setAge] = useState('30');
  const [sex, setSex] = useState<'M' | 'F'>('M');
  const [bmrManual, setBmrManual] = useState('');

  const [goalType, setGoalType] = useState<DietaGoalType>('LOSS');
  const [weeklyTarget, setWeeklyTarget] = useState('0.5');
  const [targetWeight, setTargetWeight] = useState('65');
  const [activityFactor, setActivityFactor] = useState('1.4');

  const [dietStyle, setDietStyle] = useState<DietaDietStyle>('BALANCED');
  const [macros, setMacros] = useState<DietaMacroPercents>({
    ...DIETA_STYLE_PRESETS.BALANCED,
  });
  const [macrosCustomized, setMacrosCustomized] = useState(false);

  const [deficit, setDeficit] = useState('400');
  const [surplus, setSurplus] = useState('250');
  const [cut, setCut] = useState('175');
  const [recover, setRecover] = useState('150');
  const [activityKcal, setActivityKcal] = useState('150');
  const [gainSurplus, setGainSurplus] = useState('250');
  const [gainCut, setGainCut] = useState('175');
  const [ceiling, setCeiling] = useState('500');
  const [consent, setConsent] = useState(true);

  const previewDaily = useMemo(() => {
    const bmr = bmrManual.trim() ? Number(bmrManual) : estimateBmrKcal({weightKg:Number(weightKg),heightCm:Number(heightCm),ageYears:Number(age),sex});
    const tdee = computeTdee(bmr, Number(activityFactor));
    if (goalType === 'LOSS') return applyLossDaily(tdee - Number(deficit), bmr);
    if (goalType === 'GAIN') return applyGainDaily(tdee + Number(surplus), tdee, Number(ceiling));
    return tdee;
  }, [heightCm, weightKg, age, sex, bmrManual, activityFactor, goalType, deficit, surplus, ceiling]);
  const previewMacros = macrosFromDaily(previewDaily, macros);
  const validateStep = () => {
    const entries: Array<[string, string, boolean]> = step === 0
      ? [['heightCm',heightCm,true],['weightKg',weightKg,true],['age',age,true], ...(bmrManual.trim() ? [['bmrManual',bmrManual,true] as [string,string,boolean]] : [])]
      : step === 1 && goalType !== 'MAINTAIN' ? [['targetWeight',targetWeight,true],['weeklyTarget',weeklyTarget,true]]
      : step === 3 ? (goalType === 'LOSS' ? [['deficit',deficit,false],['cut',cut,false],['recover',recover,false],['activityKcal',activityKcal,false]] : goalType === 'GAIN' ? [['surplus',surplus,false],['gainSurplus',gainSurplus,false],['gainCut',gainCut,false],['ceiling',ceiling,false]] : []) : [];
    const invalid = entries.find(([,value,positive]) => !value.trim() || !Number.isFinite(Number(value)) || (positive ? Number(value) <= 0 : Number(value) < 0));
    if (invalid) {
      setError(invalid[2] ? '0보다 큰 숫자를 입력해 주세요.' : '0 이상 숫자를 입력해 주세요.');
      const input = document.getElementById(`dieta-onboard-${invalid[0]}`);
      const details = input?.closest('details'); if (details) details.open = true;
      input?.focus(); return false;
    }
    setError(''); return true;
  };

  if (!accessToken) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: '/hobbies/dieta/onboarding' }}
      />
    );
  }

  const pickStyle = (style: DietaDietStyle) => {
    setDietStyle(style);
    setMacros({ ...DIETA_STYLE_PRESETS[style] });
    setMacrosCustomized(false);
  };

  const tweakMacro = (key: keyof DietaMacroPercents, delta: number) => {
    setMacros((prev) => {
      const next = { ...prev, [key]: Math.min(0.7, Math.max(0.05, prev[key] + delta)) };
      const sum = next.carbPct + next.proteinPct + next.fatPct;
      next.carbPct /= sum;
      next.proteinPct /= sum;
      next.fatPct /= sum;
      return next;
    });
    setMacrosCustomized(true);
  };

  const submit = async () => {
    if (!validateStep()) return;
    setError('');
    setBusy(true);
    try {
      const weeklyTargetKg = goalType === 'MAINTAIN' ? 0 : Number(weeklyTarget);
      const derived = Math.round(weeklyTargetKg * 0.9 * 1000) / 1000;
      const weeklyBodyFatLossKg = goalType === 'LOSS' ? derived : null;
      const weeklyMuscleGainKg = goalType === 'GAIN' ? derived : null;
      const targetWeightKg =
        goalType === 'MAINTAIN' ? null : Number(targetWeight);
      if (goalType !== 'MAINTAIN') {
        if (!Number.isFinite(targetWeightKg!) || targetWeightKg! <= 0) {
          setError('목표 체중을 입력해 주세요.');
          setBusy(false);
          return;
        }
      }

      await dietaApi.completeOnboarding(
        {
          heightCm: Number(heightCm),
          weightKg: Number(weightKg),
          bodyFatMassKg: null,
          skeletalMuscleMassKg: null,
          ageYears: Number(age),
          sex,
          goalType,
          weeklyTargetKg,
          targetWeightKg,
          weeklyBodyFatLossKg,
          weeklyMuscleGainKg,
          intensityPreference: null,
          bmrKcal: bmrManual ? Number(bmrManual) : null,
          activityFactor: Number(activityFactor),
          dietStyle,
          macros,
          macrosCustomized,
          lossInitialDeficitKcal: Number(deficit),
          gainInitialSurplusKcal: Number(surplus),
          lossCutKcal: Number(cut),
          lossRecoverKcal: Number(recover),
          lossActivityKcal: Number(activityKcal),
          gainSurplusKcal: Number(gainSurplus),
          gainCutKcal: Number(gainCut),
          gainCeilingDeltaKcal: Number(ceiling),
          geminiMealConsent: consent,
        },
        userKey,
      );
      void navigate('/hobbies/dieta/home', { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '온보딩에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dieta-app">
      <div className="dieta-shell dieta-shell--wide">
        <div className="dieta-title-row">
          <h1 className="dieta-display">내 리듬에 맞게 시작하기</h1>
          <span className="dieta-badge">{step + 1} / 4</span>
        </div>

        {step === 0 ? (
          <section className="dieta-card">
            <h2>내 정보</h2>
            <div className="dieta-field">
              <label htmlFor="dieta-onboard-heightCm">키 (cm)</label>
              <input id="dieta-onboard-heightCm" name="heightCm" aria-describedby={error ? "dieta-onboard-error" : undefined} inputMode="decimal" autoComplete="off" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            </div>
            <div className="dieta-field">
              <label htmlFor="dieta-onboard-weightKg">체중 (kg)</label>
              <input id="dieta-onboard-weightKg" name="weightKg" aria-describedby={error ? "dieta-onboard-error" : undefined} inputMode="decimal" autoComplete="off" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
            </div>
            <div className="dieta-field">
              <label htmlFor="dieta-onboard-age">나이</label>
              <input id="dieta-onboard-age" name="age" aria-describedby={error ? "dieta-onboard-error" : undefined} inputMode="decimal" autoComplete="off" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div className="dieta-chip-row" style={{ marginBottom: '0.85rem' }}>
              <button
                type="button"
                className={`dieta-chip ${sex === 'M' ? 'is-active' : ''}`}
                aria-pressed={sex === 'M'} onClick={() => setSex('M')}
              >
                남성
              </button>
              <button
                type="button"
                className={`dieta-chip ${sex === 'F' ? 'is-active' : ''}`}
                aria-pressed={sex === 'F'} onClick={() => setSex('F')}
              >
                여성
              </button>
            </div>
            <details className="dieta-details"><summary>기초대사량을 알고 있나요? (선택)</summary>
            <div className="dieta-field">
              <label htmlFor="dieta-onboard-bmrManual">기초대사량 직접 입력 (선택)</label>
              <input disabled={busy}
                id="dieta-onboard-bmrManual" name="bmrManual" aria-describedby={error ? "dieta-onboard-error" : undefined} inputMode="decimal" autoComplete="off" value={bmrManual}
                onChange={(e) => setBmrManual(e.target.value)}
                placeholder="비우면 자동 추정"
              />
            </div>
            </details>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="dieta-card">
            <h2>목표와 생활</h2>
            <div className="dieta-chip-row" style={{ margin: '0.75rem 0' }}>
              <button
                type="button"
                className={`dieta-chip ${goalType === 'LOSS' ? 'is-active' : ''}`}
                aria-pressed={goalType === 'LOSS'} onClick={() => setGoalType('LOSS')}
              >
                감량
              </button>
              <button
                type="button"
                className={`dieta-chip ${goalType === 'GAIN' ? 'is-active' : ''}`}
                aria-pressed={goalType === 'GAIN'} onClick={() => setGoalType('GAIN')}
              >
                증량
              </button>
              <button
                type="button"
                className={`dieta-chip ${goalType === 'MAINTAIN' ? 'is-active' : ''}`}
                aria-pressed={goalType === 'MAINTAIN'} onClick={() => setGoalType('MAINTAIN')}
              >
                유지
              </button>
            </div>
            {goalType !== 'MAINTAIN' ? (
              <>
                <div className="dieta-field">
                  <label htmlFor="dieta-onboard-targetWeight">목표 체중 (kg)</label>
              <input disabled={busy}
                    id="dieta-onboard-targetWeight" name="targetWeight" aria-describedby={error ? "dieta-onboard-error" : undefined} inputMode="decimal" autoComplete="off" value={targetWeight}
                    onChange={(e) => setTargetWeight(e.target.value)}
                  />
                  <p className="dieta-muted" style={{ marginTop: '0.35rem' }}>
                    이 체중에 도달하면 자동으로 유지 모드로 바뀌어요.
                  </p>
                </div>
                <div className="dieta-field">
                  <label htmlFor="dieta-onboard-weeklyTarget">주간 목표 변화 (kg)</label>
              <input disabled={busy}
                    id="dieta-onboard-weeklyTarget" name="weeklyTarget" aria-describedby={error ? "dieta-onboard-error" : undefined} inputMode="decimal" autoComplete="off" value={weeklyTarget}
                    onChange={(e) => setWeeklyTarget(e.target.value)}
                  />
                  <p className="dieta-muted" style={{ marginTop: '0.35rem' }}>
                    주간 유효 목표 = W × 0.9 (
                    {Number.isFinite(Number(weeklyTarget))
                      ? Math.round(Number(weeklyTarget) * 0.9 * 1000) / 1000
                      : '—'}{' '}
                    kg)
                  </p>
                </div>
              </>
            ) : (
              <p className="dieta-muted" style={{ marginBottom: '0.85rem' }}>
                기초대사량과 평소 활동량을 바탕으로 유지 목표를 정해요.
              </p>
            )}
            <div className="dieta-field">
              <label htmlFor="dieta-onboard-activityFactor">평소 활동량</label>
              <select disabled={busy}
                id="dieta-onboard-activityFactor" name="activityFactor" aria-describedby={error ? "dieta-onboard-error" : undefined} value={activityFactor}
                onChange={(e) => setActivityFactor(e.target.value)}
              >
                <option value="1.2">1.2 좌식</option>
                <option value="1.4">1.4 가벼운 활동</option>
                <option value="1.55">1.55 보통</option>
                <option value="1.725">1.725 활발</option>
              </select>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="dieta-card">
            <h2>식사 방식</h2>
            <div className="dieta-chip-row" style={{ margin: '0.75rem 0' }}>
              {(Object.keys(DIETA_STYLE_LABELS) as DietaDietStyle[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`dieta-chip ${dietStyle === s ? 'is-active' : ''}`}
                  aria-pressed={dietStyle === s} onClick={() => pickStyle(s)}
                >
                  {DIETA_STYLE_LABELS[s]}
                </button>
              ))}
            </div>
            <p className="dieta-muted">원하는 식사 방식을 고르세요. 영양소 비율은 조금씩 조절할 수 있어요.</p>
            {(
              [
                ['탄수', 'carbPct'],
                ['단백', 'proteinPct'],
                ['지방', 'fatPct'],
              ] as const
            ).map(([label, key]) => (
              <div key={key} className="dieta-list-row">
                <span>
                  {label} {Math.round(macros[key] * 100)}%
                </span>
                <span style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    className="dieta-chip"
                    aria-label={`${label} 비율 줄이기`} onClick={() => tweakMacro(key, -0.02)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="dieta-chip"
                    aria-label={`${label} 비율 늘리기`} onClick={() => tweakMacro(key, 0.02)}
                  >
                    +
                  </button>
                </span>
              </div>
            ))}
            <p className="dieta-muted">
              미리보기 ≈ 탄 {previewMacros.carbG}g · 단 {previewMacros.proteinG}g · 지{' '}
              {previewMacros.fatG}g
            </p>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="dieta-card">
            <h2>확인하고 시작</h2><p className="dieta-notice">하루 목표 약 {previewDaily.toLocaleString()} kcal · {DIETA_STYLE_LABELS[dietStyle]}</p><p className="dieta-muted">입력한 정보로 계산한 예상 목표예요. 저장 후 최종 목표를 확인할 수 있어요.</p><details className="dieta-details"><summary>고급 조절</summary>
            {goalType === 'LOSS' ? (
              <>
                <div className="dieta-field">
                  <label htmlFor="dieta-onboard-deficit">1주차 적자</label>
              <input id="dieta-onboard-deficit" name="deficit" aria-describedby={error ? "dieta-onboard-error" : undefined} inputMode="decimal" autoComplete="off" value={deficit} onChange={(e) => setDeficit(e.target.value)} />
                </div>
                <div className="dieta-field">
                  <label htmlFor="dieta-onboard-cut">정체 시 식사 감소</label>
              <input id="dieta-onboard-cut" name="cut" aria-describedby={error ? "dieta-onboard-error" : undefined} inputMode="decimal" autoComplete="off" value={cut} onChange={(e) => setCut(e.target.value)} />
                </div>
                <div className="dieta-field">
                  <label htmlFor="dieta-onboard-recover">과속 시 회복 증가</label>
              <input id="dieta-onboard-recover" name="recover" aria-describedby={error ? "dieta-onboard-error" : undefined} inputMode="decimal" autoComplete="off" value={recover} onChange={(e) => setRecover(e.target.value)} />
                </div>
                <div className="dieta-field">
                  <label htmlFor="dieta-onboard-activityKcal">정체 시 활동 +kcal</label>
              <input disabled={busy}
                    id="dieta-onboard-activityKcal" name="activityKcal" aria-describedby={error ? "dieta-onboard-error" : undefined} inputMode="decimal" autoComplete="off" value={activityKcal}
                    onChange={(e) => setActivityKcal(e.target.value)}
                  />
                </div>
              </>
            ) : null}
            {goalType === 'GAIN' ? (
              <>
                <div className="dieta-field">
                  <label htmlFor="dieta-onboard-surplus">1주차 잉여</label>
              <input id="dieta-onboard-surplus" name="surplus" aria-describedby={error ? "dieta-onboard-error" : undefined} inputMode="decimal" autoComplete="off" value={surplus} onChange={(e) => setSurplus(e.target.value)} />
                </div>
                <div className="dieta-field">
                  <label htmlFor="dieta-onboard-gainSurplus">정체 시 증가</label>
              <input disabled={busy}
                    id="dieta-onboard-gainSurplus" name="gainSurplus" aria-describedby={error ? "dieta-onboard-error" : undefined} inputMode="decimal" autoComplete="off" value={gainSurplus}
                    onChange={(e) => setGainSurplus(e.target.value)}
                  />
                </div>
                <div className="dieta-field">
                  <label htmlFor="dieta-onboard-gainCut">과속 시 감소</label>
              <input id="dieta-onboard-gainCut" name="gainCut" aria-describedby={error ? "dieta-onboard-error" : undefined} inputMode="decimal" autoComplete="off" value={gainCut} onChange={(e) => setGainCut(e.target.value)} />
                </div>
                <div className="dieta-field">
                  <label htmlFor="dieta-onboard-ceiling">증량 시 추가 식사량 상한</label>
              <input id="dieta-onboard-ceiling" name="ceiling" aria-describedby={error ? "dieta-onboard-error" : undefined} inputMode="decimal" autoComplete="off" value={ceiling} onChange={(e) => setCeiling(e.target.value)} />
                </div>
              </>
            ) : null}
            {goalType === 'MAINTAIN' ? (
              <p className="dieta-muted">유지는 하루 예상 소비량에 맞춰 식사 목표를 정합니다.</p>
            ) : null}
            </details>
            <label className="dieta-check" style={{ display: 'flex', gap: '0.5rem' }}>
              <input disabled={busy}
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              식사 내용을 Gemini로 보내 AI 영양 분석을 받는 데 동의합니다
            </label>
          </section>
        ) : null}

        {error ? <p id="dieta-onboard-error" role="alert" style={{ color: 'var(--dieta-coral)' }}>{error}</p> : null}

        <div style={{ display: 'flex', gap: '0.55rem', marginTop: '1rem' }}>
          {step > 0 ? (
            <button
              type="button"
              className="dieta-btn dieta-btn--ghost"
              disabled={busy} onClick={() => {setError(''); setStep(s => (s - 1) as Step);}}
            >
              이전
            </button>
          ) : null}
          {step < 3 ? (
            <button
              type="button"
              className="dieta-btn dieta-btn--primary"
              style={{ flex: 1 }}
              onClick={() => { if (validateStep()) setStep(s => (s + 1) as Step); }}
            >
              다음
            </button>
          ) : (
            <button
              type="button"
              className="dieta-btn dieta-btn--primary"
              style={{ flex: 1 }}
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? '저장 중…' : '코칭 시작'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
