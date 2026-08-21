import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { dietaApi } from '../api/dietaApi';
import { DietaKetoModal } from '../components/dieta/DietaKetoModal';
import { DietaLineChart } from '../components/dieta/DietaCharts';
import { DietaWeekPlanModal } from '../components/dieta/DietaWeekPlanModal';
import type {
  DietaBodyLog,
  DietaIntakeLog,
  DietaProfile,
} from '../features/dieta/types';
import { useDietaUserKey } from '../features/dieta/useDietaUserKey';
import {
  averageDailyIntakeKcal,
  buildWeeklyCheckInProposal,
  daysBetweenIso,
  findCheckInBaseline,
  hasReachedTargetWeight,
  isWeeklyCheckInDue,
  macrosFromDaily,
  todayIsoDate,
  type DietaPlateauChoice,
} from '../features/dieta/utils/dietaMath';
import { useAuthStore } from '../stores/authStore';

type WeightRange = '1W' | '1M' | '3M';

function daysForRange(range: WeightRange): number {
  if (range === '1W') return 7;
  if (range === '1M') return 31;
  return 92;
}

function sumIntakeOn(meals: DietaIntakeLog[], day: string) {
  let kcal = 0;
  let carbG = 0;
  let proteinG = 0;
  let fatG = 0;
  for (const meal of meals) {
    if (meal.loggedOn !== day) continue;
    kcal += meal.kcal;
    carbG += meal.carbG;
    proteinG += meal.proteinG;
    fatG += meal.fatG;
  }
  return {
    kcal: Math.round(kcal),
    carbG: Math.round(carbG),
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
  };
}

function barWidthPct(eaten: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((eaten / goal) * 100));
}

export function DietaHomePage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const userKey = useDietaUserKey();
  const [profile, setProfile] = useState<DietaProfile | null>(null);
  const [logs, setLogs] = useState<DietaBodyLog[]>([]);
  const [meals, setMeals] = useState<DietaIntakeLog[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [weightRange, setWeightRange] = useState<WeightRange>('1M');
  const [ketoOpen, setKetoOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [plateauChoice, setPlateauChoice] = useState<DietaPlateauChoice>('CUT_KCAL');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState('');

  const today = todayIsoDate();

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const [p, body, allMeals] = await Promise.all([
        dietaApi.getProfile(userKey),
        dietaApi.listBodyLogs(userKey),
        dietaApi.listIntakes(undefined, userKey),
      ]);
      if (cancelled) {
        return;
      }
      setProfile(p);
      setLogs(body);
      setMeals(allMeals);
      const todayLog = body.find((l) => l.loggedOn === today);
      if (todayLog?.weightKg != null) {
        setWeightInput(String(todayLog.weightKg));
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, userKey, today]);

  const macros = useMemo(() => {
    if (!profile) {
      return null;
    }
    return macrosFromDaily(profile.dailyKcal, profile.macros);
  }, [profile]);

  const todayIntake = useMemo(
    () => sumIntakeOn(meals, today),
    [meals, today],
  );

  const weightSeries = useMemo(() => {
    const cut = Date.now() - daysForRange(weightRange) * 86400000;
    const filtered = logs.filter((l) => new Date(l.loggedOn).getTime() >= cut);
    const points = filtered
      .filter((l) => l.weightKg != null)
      .map((l) => ({
        date: l.loggedOn,
        value: l.weightKg as number,
        source: l.source,
      }));
    const timeline = [...new Set(points.map((p) => p.date))].sort((a, b) =>
      a.localeCompare(b),
    );
    return { points, timeline };
  }, [logs, weightRange]);

  const todayLog = useMemo(
    () => logs.find((l) => l.loggedOn === today) ?? null,
    [logs, today],
  );
  const hasTodayWeight = todayLog?.weightKg != null;

  const baseline = useMemo(
    () => findCheckInBaseline(logs, today),
    [logs, today],
  );

  const intake = useMemo(() => {
    if (!profile) {
      return { avgKcal: 0, dayCount: 0, totalKcal: 0 };
    }
    return averageDailyIntakeKcal(meals, profile.weekStartsOn, today);
  }, [profile, meals, today]);

  const proposal = useMemo(() => {
    if (!profile || !weightInput) {
      return null;
    }
    const nextWeight = Number(weightInput);
    if (!Number.isFinite(nextWeight) || nextWeight <= 0) {
      return null;
    }
    const weightDeltaKg =
      baseline?.weightKg != null ? nextWeight - baseline.weightKg : null;

    return buildWeeklyCheckInProposal({
      goalType: profile.goalType,
      weeklyTargetKg: profile.weeklyTargetKg,
      currentDailyKcal: profile.dailyKcal,
      currentTdee: profile.tdeeKcal,
      bmr: profile.bmrKcal,
      lossCutKcal: profile.lossCutKcal,
      lossRecoverKcal: profile.lossRecoverKcal,
      lossActivityKcal: profile.lossActivityKcal,
      gainSurplusKcal: profile.gainSurplusKcal,
      gainCutKcal: profile.gainCutKcal,
      gainCeilingDeltaKcal: profile.gainCeilingDeltaKcal,
      avgIntakeKcal: intake.avgKcal,
      intakeDays: intake.dayCount,
      weightDeltaKg,
      fatDeltaKg: null,
      muscleDeltaKg: null,
      plateauChoice,
    });
  }, [profile, weightInput, baseline, intake, plateauChoice]);

  if (!accessToken) {
    return (
      <Navigate to="/login" replace state={{ from: '/hobbies/dieta/home' }} />
    );
  }

  if (!loaded) {
    return <p className="dieta-muted">불러오는 중…</p>;
  }

  if (!profile?.onboardingComplete) {
    return <Navigate to="/hobbies/dieta/onboarding" replace />;
  }

  const checkInDue = isWeeklyCheckInDue(profile.weekStartsOn, today);
  const weekDay = daysBetweenIso(profile.weekStartsOn, today) + 1;

  const saveWeight = async () => {
    const w = Number(weightInput);
    if (!Number.isFinite(w) || w <= 0) {
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await dietaApi.upsertBodyLog(
        {
          loggedOn: today,
          weightKg: w,
          bodyFatMassKg: null,
          skeletalMuscleMassKg: null,
          fasted: true,
          source: checkInDue ? 'CHECK_IN' : 'DAILY_FASTED',
        },
        userKey,
      );
      const body = await dietaApi.listBodyLogs(userKey);
      setLogs(body);
      setWeightInput(String(w));

      if (
        hasReachedTargetWeight({
          goalType: profile.goalType,
          weightKg: w,
          targetWeightKg: profile.targetWeightKg,
        })
      ) {
        const updated = await dietaApi.setMaintainMode(true, userKey);
        setProfile(updated);
        setPlanOpen(false);
        setMsg('목표 체중에 도달했어요. 유지 모드로 바꿨어요.');
        return;
      }

      if (checkInDue && proposal) {
        setPlanOpen(true);
      } else {
        setMsg(hasTodayWeight ? '오늘 체중을 수정했어요.' : '오늘 체중을 저장했어요.');
      }
    } finally {
      setBusy(false);
    }
  };

  const applyWeekPlan = async (keepTargets: boolean) => {
    if (!proposal) {
      return;
    }
    setBusy(true);
    try {
      const checkWeight = Number(weightInput);
      if (!Number.isFinite(checkWeight) || checkWeight <= 0) {
        return;
      }
      const reached = hasReachedTargetWeight({
        goalType: profile.goalType,
        weightKg: checkWeight,
        targetWeightKg: profile.targetWeightKg,
      });
      const { profile: updated } = await dietaApi.applyWeekCheckIn(
        {
          loggedOn: today,
          weightKg: checkWeight,
          keepTargets: reached ? false : keepTargets,
          plateauChoice,
          avgIntakeKcal: intake.avgKcal,
          intakeDays: intake.dayCount,
        },
        userKey,
      );
      setProfile(updated);
      setPlanOpen(false);
      setMsg(
        reached
          ? '목표 체중에 도달했어요. 유지 모드로 바꿨어요.'
          : keepTargets
            ? '식사·활동·W는 유지하고 다음 주를 시작했어요.'
            : `체중 기준 조정 · 일일 ${updated.dailyKcal}kcal`,
      );
    } finally {
      setBusy(false);
    }
  };

  const onKetoConfirm = async (ease: boolean) => {
    await dietaApi.recordKeto(ease, userKey);
    setKetoOpen(false);
  };

  const goalLabel =
    profile.goalType === 'LOSS'
      ? '감량 중'
      : profile.goalType === 'GAIN'
        ? '증량 중'
        : '유지 중';

  const kcalPct = barWidthPct(todayIntake.kcal, profile.dailyKcal);
  const kcalOver = todayIntake.kcal > profile.dailyKcal;

  return (
    <>
      <div className="dieta-title-row">
        <div>
          <h1>Dieta</h1>
          <span className="dieta-badge">{goalLabel}</span>
          {profile.targetWeightKg != null && profile.goalType !== 'MAINTAIN' ? (
            <span className="dieta-muted" style={{ marginLeft: '0.45rem' }}>
              목표 {profile.targetWeightKg}kg · 주 {profile.weeklyTargetKg}kg
            </span>
          ) : null}
        </div>
        <span className="dieta-muted">{weekDay}일차</span>
      </div>

      {checkInDue ? (
        <section className="dieta-card dieta-card--checkin">
          <strong>이번 주 체크인</strong>
          <p className="dieta-muted" style={{ marginTop: '0.35rem' }}>
            아래 체중을 저장하면 다음 주 식사량을 제안합니다. 매일 기록은 추이용이에요.
          </p>
          <Link
            className="dieta-btn dieta-btn--primary dieta-btn--block"
            to="/hobbies/dieta/check-in"
            style={{ marginTop: '0.85rem', textDecoration: 'none' }}
          >
            체크인하러 가기
          </Link>
        </section>
      ) : null}

      <section className="dieta-card">
        <div className="dieta-title-row" style={{ marginBottom: '0.55rem' }}>
          <strong>오늘</strong>
          <Link className="dieta-link" to="/hobbies/dieta/meals">
            섭취 기록
          </Link>
        </div>
        <p className="dieta-kcal-hero">
          <span>{todayIntake.kcal}</span>
          <span className="dieta-muted"> / {profile.dailyKcal} kcal</span>
        </p>
        <div
          className="dieta-progress dieta-progress--kcal"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={profile.dailyKcal}
          aria-valuenow={todayIntake.kcal}
          aria-label="오늘 섭취 칼로리"
        >
          <span
            className={kcalOver ? 'is-over' : undefined}
            style={{ width: `${kcalPct}%` }}
          />
        </div>
        <p className="dieta-muted" style={{ marginTop: '0.35rem' }}>
          TDEE {profile.tdeeKcal} kcal
        </p>
        {macros ? (
          <div className="dieta-macro-rows" style={{ marginTop: '0.85rem' }}>
            {(
              [
                ['탄', todayIntake.carbG, macros.carbG],
                ['단', todayIntake.proteinG, macros.proteinG],
                ['지', todayIntake.fatG, macros.fatG],
              ] as const
            ).map(([label, eaten, goal]) => (
              <div key={label} className="dieta-macro-row">
                <span>{label}</span>
                <div className="dieta-progress">
                  <span
                    className={eaten > goal ? 'is-over' : undefined}
                    style={{ width: `${barWidthPct(eaten, goal)}%` }}
                  />
                </div>
                <span>
                  {eaten}/{goal}g
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="dieta-card">
        <strong>체중 추이</strong>
        <div className="dieta-chip-row" style={{ margin: '0.65rem 0 0.85rem' }}>
          {(
            [
              ['1W', '1주'],
              ['1M', '1개월'],
              ['3M', '3개월'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={`dieta-chip ${weightRange === k ? 'is-active' : ''}`}
              onClick={() => setWeightRange(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <DietaLineChart
          title="체중"
          unit="kg"
          timeline={weightSeries.timeline}
          points={weightSeries.points}
        />
      </section>

      <section className="dieta-card">
        <strong>아침 공복 체중</strong>
        <p className="dieta-muted" style={{ marginTop: '0.35rem' }}>
          매일 기록해도 되고, 안 해도 됩니다. 조절은 주간 체크인 체중만 씁니다.
          하루 한 번 · 이미 있으면 수정.
        </p>
        <div className="dieta-field" style={{ marginTop: '0.65rem' }}>
          <label htmlFor="dieta-fasted-weight">오늘 체중 (kg)</label>
          <input
            id="dieta-fasted-weight"
            inputMode="decimal"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            placeholder="예: 68.4"
          />
        </div>
        <button
          type="button"
          className="dieta-btn dieta-btn--primary dieta-btn--block"
          disabled={busy}
          onClick={() => void saveWeight()}
        >
          {hasTodayWeight ? '수정' : '저장'}
          {checkInDue ? ' · 다음 주 계획' : ''}
        </button>
        {msg ? <p className="dieta-muted">{msg}</p> : null}
      </section>

      {profile.goalType !== 'GAIN' ? (
        <button
          type="button"
          className="dieta-btn dieta-btn--soft dieta-btn--block"
          style={{ marginTop: '0.85rem' }}
          onClick={() => setKetoOpen(true)}
        >
          키토플루 있어요
        </button>
      ) : null}

      <DietaKetoModal
        open={ketoOpen}
        onClose={() => setKetoOpen(false)}
        onConfirm={(ease) => void onKetoConfirm(ease)}
      />

      {proposal ? (
        <DietaWeekPlanModal
          open={planOpen}
          profile={profile}
          proposal={proposal}
          plateauChoice={plateauChoice}
          onPlateauChoice={setPlateauChoice}
          weightKg={Number(weightInput) || null}
          busy={busy}
          onClose={() => setPlanOpen(false)}
          onConfirm={(keepTargets) => void applyWeekPlan(keepTargets)}
        />
      ) : null}
    </>
  );
}
