import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { dietaApi } from '../api/dietaApi';
import type { DietaDietStyle, DietaGoalType, DietaMacroPercents } from '../features/dieta/types';
import { DIETA_STYLE_LABELS, DIETA_STYLE_PRESETS } from '../features/dieta/types';
import { useDietaUserKey } from '../features/dieta/useDietaUserKey';
import { macrosFromDaily } from '../features/dieta/utils/dietaMath';
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
    const tdeeGuess = 2200;
    if (goalType === 'LOSS') return tdeeGuess - Number(deficit || 0);
    if (goalType === 'GAIN') return tdeeGuess + Number(surplus || 0);
    return tdeeGuess;
  }, [goalType, deficit, surplus]);

  const previewMacros = macrosFromDaily(Math.max(previewDaily, 1200), macros);

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
          <h1 className="dieta-display">온보딩</h1>
          <span className="dieta-badge">{step + 1} / 4</span>
        </div>

        {step === 0 ? (
          <section className="dieta-card">
            <strong>기본 정보</strong>
            <div className="dieta-field">
              <label>키 (cm)</label>
              <input value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            </div>
            <div className="dieta-field">
              <label>체중 (kg)</label>
              <input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
            </div>
            <div className="dieta-field">
              <label>나이</label>
              <input value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div className="dieta-chip-row" style={{ marginBottom: '0.85rem' }}>
              <button
                type="button"
                className={`dieta-chip ${sex === 'M' ? 'is-active' : ''}`}
                onClick={() => setSex('M')}
              >
                남성
              </button>
              <button
                type="button"
                className={`dieta-chip ${sex === 'F' ? 'is-active' : ''}`}
                onClick={() => setSex('F')}
              >
                여성
              </button>
            </div>
            <div className="dieta-field">
              <label>BMR 직접 입력 (선택)</label>
              <input
                value={bmrManual}
                onChange={(e) => setBmrManual(e.target.value)}
                placeholder="비우면 자동 추정"
              />
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="dieta-card">
            <strong>목표</strong>
            <div className="dieta-chip-row" style={{ margin: '0.75rem 0' }}>
              <button
                type="button"
                className={`dieta-chip ${goalType === 'LOSS' ? 'is-active' : ''}`}
                onClick={() => setGoalType('LOSS')}
              >
                감량
              </button>
              <button
                type="button"
                className={`dieta-chip ${goalType === 'GAIN' ? 'is-active' : ''}`}
                onClick={() => setGoalType('GAIN')}
              >
                증량
              </button>
              <button
                type="button"
                className={`dieta-chip ${goalType === 'MAINTAIN' ? 'is-active' : ''}`}
                onClick={() => setGoalType('MAINTAIN')}
              >
                유지
              </button>
            </div>
            {goalType !== 'MAINTAIN' ? (
              <>
                <div className="dieta-field">
                  <label>목표 체중 (kg)</label>
                  <input
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(e.target.value)}
                  />
                  <p className="dieta-muted" style={{ marginTop: '0.35rem' }}>
                    이 체중에 도달하면 자동으로 유지 모드로 바뀌어요.
                  </p>
                </div>
                <div className="dieta-field">
                  <label>주간 목표 W (kg)</label>
                  <input
                    value={weeklyTarget}
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
                유지는 활동 계수만으로 하루 목표(TDEE)를 정해요.
              </p>
            )}
            <div className="dieta-field">
              <label>활동 계수</label>
              <select
                value={activityFactor}
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
            <strong>식단 스타일 · 탄단지</strong>
            <div className="dieta-chip-row" style={{ margin: '0.75rem 0' }}>
              {(Object.keys(DIETA_STYLE_LABELS) as DietaDietStyle[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`dieta-chip ${dietStyle === s ? 'is-active' : ''}`}
                  onClick={() => pickStyle(s)}
                >
                  {DIETA_STYLE_LABELS[s]}
                </button>
              ))}
            </div>
            <p className="dieta-muted">프리셋 ±10%p 느낌으로 미세 조정</p>
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
                    onClick={() => tweakMacro(key, -0.02)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="dieta-chip"
                    onClick={() => tweakMacro(key, 0.02)}
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
            <strong>가감 kcal · 동의</strong>
            {goalType === 'LOSS' ? (
              <>
                <div className="dieta-field">
                  <label>1주차 적자</label>
                  <input value={deficit} onChange={(e) => setDeficit(e.target.value)} />
                </div>
                <div className="dieta-field">
                  <label>정체 시 식사 감소</label>
                  <input value={cut} onChange={(e) => setCut(e.target.value)} />
                </div>
                <div className="dieta-field">
                  <label>과속 시 회복 증가</label>
                  <input value={recover} onChange={(e) => setRecover(e.target.value)} />
                </div>
                <div className="dieta-field">
                  <label>정체 시 활동 +kcal</label>
                  <input
                    value={activityKcal}
                    onChange={(e) => setActivityKcal(e.target.value)}
                  />
                </div>
              </>
            ) : null}
            {goalType === 'GAIN' ? (
              <>
                <div className="dieta-field">
                  <label>1주차 잉여</label>
                  <input value={surplus} onChange={(e) => setSurplus(e.target.value)} />
                </div>
                <div className="dieta-field">
                  <label>정체 시 증가</label>
                  <input
                    value={gainSurplus}
                    onChange={(e) => setGainSurplus(e.target.value)}
                  />
                </div>
                <div className="dieta-field">
                  <label>과속 시 감소</label>
                  <input value={gainCut} onChange={(e) => setGainCut(e.target.value)} />
                </div>
                <div className="dieta-field">
                  <label>GAIN 상한 (TDEE+)</label>
                  <input value={ceiling} onChange={(e) => setCeiling(e.target.value)} />
                </div>
              </>
            ) : null}
            {goalType === 'MAINTAIN' ? (
              <p className="dieta-muted">유지는 하루 목표를 TDEE로 맞춥니다.</p>
            ) : null}
            <label className="dieta-muted" style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              식단 AI(Gemini 스텁) 사용에 동의합니다
            </label>
          </section>
        ) : null}

        {error ? <p style={{ color: 'var(--dieta-coral)' }}>{error}</p> : null}

        <div style={{ display: 'flex', gap: '0.55rem', marginTop: '1rem' }}>
          {step > 0 ? (
            <button
              type="button"
              className="dieta-btn dieta-btn--ghost"
              onClick={() => setStep((s) => (s - 1) as Step)}
            >
              이전
            </button>
          ) : null}
          {step < 3 ? (
            <button
              type="button"
              className="dieta-btn dieta-btn--primary"
              style={{ flex: 1 }}
              onClick={() => setStep((s) => (s + 1) as Step)}
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
