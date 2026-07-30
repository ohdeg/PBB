import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { dietaApi } from '../api/dietaApi';
import { DietaWeekPlanModal } from '../components/dieta/DietaWeekPlanModal';
import type { DietaBodyLog, DietaIntakeLog, DietaProfile } from '../features/dieta/types';
import { useDietaUserKey } from '../features/dieta/useDietaUserKey';
import {
  averageDailyIntakeKcal,
  buildWeeklyCheckInProposal,
  daysBetweenIso,
  findCheckInBaseline,
  hasReachedTargetWeight,
  isWeeklyCheckInDue,
  todayIsoDate,
  type DietaPlateauChoice,
} from '../features/dieta/utils/dietaMath';
import { useAuthStore } from '../stores/authStore';

export function DietaCheckInPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const userKey = useDietaUserKey();
  const [profile, setProfile] = useState<DietaProfile | null>(null);
  const [logs, setLogs] = useState<DietaBodyLog[]>([]);
  const [meals, setMeals] = useState<DietaIntakeLog[]>([]);
  const [weight, setWeight] = useState('');
  const [keto, setKeto] = useState(false);
  const [plateauChoice, setPlateauChoice] = useState<DietaPlateauChoice>('CUT_KCAL');
  const [planOpen, setPlanOpen] = useState(false);
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [completed, setCompleted] = useState(false);

  const today = todayIsoDate();

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    void (async () => {
      const [p, body, allMeals] = await Promise.all([
        dietaApi.getProfile(userKey),
        dietaApi.listBodyLogs(userKey),
        dietaApi.listIntakes(undefined, userKey),
      ]);
      setProfile(p);
      setLogs(body);
      setMeals(allMeals);
      const todayLog = body.find((l) => l.loggedOn === today);
      if (todayLog?.weightKg != null) {
        setWeight(String(todayLog.weightKg));
      }
      setLoaded(true);
    })();
  }, [accessToken, userKey, today]);

  const due = profile ? isWeeklyCheckInDue(profile.weekStartsOn, today) : false;
  const dayIndex = profile
    ? daysBetweenIso(profile.weekStartsOn, today) + 1
    : 0;

  const todayLog = useMemo(
    () => logs.find((l) => l.loggedOn === today) ?? null,
    [logs, today],
  );
  const hasTodayEntry = todayLog?.weightKg != null;

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
    if (!profile || !weight) {
      return null;
    }
    const nextWeight = Number(weight);
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
  }, [profile, weight, baseline, intake, plateauChoice]);

  if (!accessToken) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: '/hobbies/dieta/check-in' }}
      />
    );
  }

  if (!loaded) {
    return <p className="dieta-muted">불러오는 중…</p>;
  }

  if (!profile?.onboardingComplete) {
    return <Navigate to="/hobbies/dieta/onboarding" replace />;
  }

  const saveAndOpenPlan = async () => {
    if (!proposal) {
      return;
    }
    setBusy(true);
    setResult('');
    try {
      const w = weight ? Number(weight) : null;
      await dietaApi.upsertBodyLog(
        {
          loggedOn: today,
          weightKg: w,
          bodyFatMassKg: null,
          skeletalMuscleMassKg: null,
          fasted: true,
          source: 'CHECK_IN',
        },
        userKey,
      );
      if (keto) {
        await dietaApi.recordKeto(false, userKey);
      }
      setLogs(await dietaApi.listBodyLogs(userKey));

      if (
        w != null
        && hasReachedTargetWeight({
          goalType: profile.goalType,
          weightKg: w,
          targetWeightKg: profile.targetWeightKg,
        })
      ) {
        const { profile: updated } = await dietaApi.applyWeekCheckIn(
          {
            loggedOn: today,
            weightKg: w,
            keepTargets: false,
            plateauChoice,
            avgIntakeKcal: intake.avgKcal,
            intakeDays: intake.dayCount,
          },
          userKey,
        );
        setProfile(updated);
        setCompleted(true);
        setResult('목표 체중에 도달했어요. 유지 모드로 바꿨어요.');
        return;
      }

      setPlanOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const confirmProposal = async (keepTargets: boolean) => {
    if (!proposal) {
      return;
    }
    setBusy(true);
    try {
      const checkWeight = Number(weight);
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
      setCompleted(true);
      setResult(
        reached
          ? '목표 체중에 도달했어요. 유지 모드로 바꿨어요.'
          : keepTargets
            ? '식사·활동·W는 유지하고, 다음 주를 시작했어요.'
            : `체중 기준으로 조정했어요. 일일 ${updated.dailyKcal}kcal` +
              (updated.weekActivityExtraKcal > 0
                ? ` · 활동 +${updated.weekActivityExtraKcal}kcal`
                : ''),
      );
    } finally {
      setBusy(false);
    }
  };

  if (!due || completed) {
    return (
      <>
        <div className="dieta-title-row">
          <h1>주간 체크인</h1>
          <Link className="dieta-link" to="/hobbies/dieta/home">
            홈
          </Link>
        </div>
        <section className="dieta-card">
          {completed ? (
            <>
              <strong>다음 주가 시작됐어요</strong>
              <p className="dieta-muted" style={{ marginTop: '0.55rem' }}>
                {result}
              </p>
            </>
          ) : (
            <>
              <strong>아직 주간이 끝나지 않았어요</strong>
              <p className="dieta-muted" style={{ marginTop: '0.55rem' }}>
                주 시작 {profile.weekStartsOn} · 오늘은 {dayIndex}일차입니다.
                7일 경과 후(8일차)에 한 주 섭취·변화로 식사·활동을 조절합니다.
              </p>
            </>
          )}
        </section>
      </>
    );
  }

  return (
    <>
      <div className="dieta-title-row">
        <h1>주간 체크인</h1>
      </div>

      <section className="dieta-card">
        <strong>이번 주 요약</strong>
        <div className="dieta-list-row">
          <span>평균 섭취</span>
          <strong>
            {intake.dayCount > 0
              ? `${intake.avgKcal} kcal (${intake.dayCount}일)`
              : '기록 없음'}
          </strong>
        </div>
        <div className="dieta-list-row">
          <span>직전 체크인 체중</span>
          <strong>
            {baseline?.weightKg != null ? `${baseline.weightKg} kg` : '—'}
          </strong>
        </div>
        <p className="dieta-muted" style={{ marginTop: '0.35rem' }}>
          단일 비교 · {profile.weekStartsOn} ~ {today} · W {profile.weeklyTargetKg}{' '}
          kg
        </p>
      </section>

      <section className="dieta-card">
        <p className="dieta-muted" style={{ marginBottom: '0.65rem' }}>
          이번 체크인 체중으로 직전 체크인(온보딩)과 비교합니다. 중간 매일 기록은
          추이만 반영돼요. 같은 날이면 수정할 수 있어요.
        </p>
        <div className="dieta-field">
          <label>체중 (kg)</label>
          <input value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        {profile.goalType === 'LOSS' ? (
          <label className="dieta-muted" style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={keto}
              onChange={(e) => setKeto(e.target.checked)}
            />
            이번 주 키토플루 있었어요
          </label>
        ) : null}
      </section>

      <button
        type="button"
        className="dieta-btn dieta-btn--primary dieta-btn--block"
        disabled={busy || !proposal}
        onClick={() => void saveAndOpenPlan()}
      >
        {hasTodayEntry ? '수정 · 다음 주 계획 보기' : '저장 · 다음 주 계획 보기'}
      </button>

      {proposal ? (
        <DietaWeekPlanModal
          open={planOpen}
          profile={profile}
          proposal={proposal}
          plateauChoice={plateauChoice}
          onPlateauChoice={setPlateauChoice}
          weightKg={Number(weight) || null}
          busy={busy}
          onClose={() => setPlanOpen(false)}
          onConfirm={(keepTargets) => void confirmProposal(keepTargets)}
        />
      ) : null}
    </>
  );
}
