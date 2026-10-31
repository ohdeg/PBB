import { DietaLoadState } from '../components/dieta/DietaLoadState';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { dietaApi } from '../api/dietaApi';
import { useDietaProposal } from '../features/dieta/useDietaProposal';
import { DietaKetoModal } from '../components/dieta/DietaKetoModal';
import { DietaLineChart } from '../components/dieta/DietaCharts';
import { DietaWeekPlanModal } from '../components/dieta/DietaWeekPlanModal';
import type {
  DietaBodyLog,
  DietaIntakeLog,
  DietaProfile,
  DietaMealQueueDay,
} from '../features/dieta/types';
import { useDietaUserKey } from '../features/dieta/useDietaUserKey';
import {
  daysBetweenIso,
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
  const [queue, setQueue] = useState<DietaMealQueueDay | null>(null);
  const [meals, setMeals] = useState<DietaIntakeLog[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [weightRange, setWeightRange] = useState<WeightRange>('1M');
  const [ketoOpen, setKetoOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [plateauChoice, setPlateauChoice] = useState<DietaPlateauChoice>('CUT_KCAL');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState('');

  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const today = todayIsoDate();

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    let cancelled = false;
    setLoadError(''); setLoaded(false);
    void (async () => {
      const p = await dietaApi.getProfile(userKey);
      if (cancelled) return;
      if (!p?.onboardingComplete) { setProfile(p); setLoaded(true); return; }
      const [body, allMeals, mealQueue] = await Promise.all([
        dietaApi.listBodyLogs(userKey),
        dietaApi.listIntakes(undefined, userKey),
        dietaApi.getMealQueue(today, userKey),
      ]);
      if (cancelled) {
        return;
      }
      setProfile(p);
      setLogs(body);
      setMeals(allMeals);
      setQueue(mealQueue);
      const todayLog = body.find((l) => l.loggedOn === today);
      if (todayLog?.weightKg != null) {
        setWeightInput(String(todayLog.weightKg));
      }
      setLoaded(true);
    })().catch((e: unknown) => { if (!cancelled) setLoadError(e instanceof Error ? e.message : '기록을 불러오지 못했어요.'); });
    return () => {
      cancelled = true;
    };
  }, [accessToken, userKey, today, retry]);

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

  const { proposal, displayProposal, pending: proposalPending, error: proposalError, reload: reloadProposal } = useDietaProposal({
    enabled: Boolean(accessToken && profile?.onboardingComplete),
    loggedOn: today, weight: weightInput, plateauChoice,
    contextKey: JSON.stringify(profile),
  });

  if (!accessToken) {
    return (
      <Navigate to="/login" replace state={{ from: '/hobbies/dieta/home' }} />
    );
  }

  if (!loaded || loadError) return <DietaLoadState error={loadError} onRetry={() => setRetry(n => n + 1)} />;

  if (!profile?.onboardingComplete) {
    return <Navigate to="/hobbies/dieta/onboarding" replace />;
  }

  const checkInDue = isWeeklyCheckInDue(profile.weekStartsOn, today);
  const weekDay = daysBetweenIso(profile.weekStartsOn, today) + 1;

  const saveWeight = async () => {
    const w = Number(weightInput);
    if (!Number.isFinite(w) || w <= 0) {
      setMsg('체중을 0보다 큰 숫자로 입력해 주세요.');
      return;
    }
    if (checkInDue) {
      if (proposal) setPlanOpen(true);
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
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : '저장하지 못했어요. 다시 시도해 주세요.');
      reloadProposal();
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
          revisionToken: proposal.revisionToken,
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
      try { setLogs(await dietaApi.listBodyLogs(userKey)); }
      catch { setMsg('주간 계획은 저장했어요. 체중 차트는 새로고침해 주세요.'); }
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : '저장하지 못했어요. 다시 시도해 주세요.');
      reloadProposal();
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
          <h1>오늘의 기록</h1><p className="dieta-muted">{new Intl.DateTimeFormat('ko-KR', {month:'long',day:'numeric',weekday:'long'}).format(new Date())}</p>
          <span className="dieta-badge">{goalLabel}</span>
          {profile.targetWeightKg != null && profile.goalType !== 'MAINTAIN' ? (
            <span className="dieta-muted" style={{ marginLeft: '0.45rem' }}>
              목표 {profile.targetWeightKg}kg · 주 {profile.weeklyTargetKg}kg
            </span>
          ) : null}
        </div>
        <span className="dieta-muted">{weekDay}일차</span>
      </div>

      <div className={`dieta-home-grid${checkInDue ? ' is-checkin-due' : ''}`}>
      <section className="dieta-card dieta-home-week">
        <span className="dieta-badge">이번 주</span><h2 style={{marginTop:12}}>{checkInDue ? '한 주를 돌아볼 시간이에요' : '내 리듬대로 기록하세요'}</h2>
        <p className="dieta-muted">{checkInDue ? '체중과 식사 기록을 바탕으로 다음 주 목표를 함께 확인해요.' : `다음 체크인까지 ${Math.max(0, 8 - weekDay)}일 남았어요. 매일 체중 기록은 선택이에요.`}</p>
        {checkInDue && <Link className="dieta-btn dieta-btn--primary dieta-btn--block" to="/hobbies/dieta/check-in">주간 체크인 시작</Link>}
        <details className="dieta-details"><summary>기록은 어떻게 반영되나요?</summary><p>매일 체중은 변화 그래프에, 분석을 마친 식사는 섭취 요약에 반영돼요. 주간 체크인에서 다음 주 계획을 확인하고 적용할 수 있어요.</p></details>
      </section>
      <section className="dieta-card dieta-home-record">
        <h2>오늘 기록하기</h2>
        <div className="dieta-actions"><Link className={`dieta-btn ${checkInDue ? 'dieta-btn--soft' : 'dieta-btn--primary'}`} to="/hobbies/dieta/meals">식사 기록하기</Link></div>
        <p className="dieta-muted" style={{ marginTop: '0.35rem' }}>
          {checkInDue ? '오늘 체중으로 다음 주 계획을 확인하세요. 확인 후 적용할 때 저장됩니다.' : '아침 공복 체중을 남겨 보세요. 오늘 기록이 있으면 수정됩니다.'}
        </p>
        <div className="dieta-field" style={{ marginTop: '0.65rem' }}>
          <label htmlFor="dieta-fasted-weight">오늘 체중 (kg)</label>
          <input
            id="dieta-fasted-weight"
            inputMode="decimal"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            name="weight" autoComplete="off" placeholder="예: 68.4…"
          />
        </div>
        <button
          type="button"
          className="dieta-btn dieta-btn--soft dieta-btn--block"
          disabled={busy || (checkInDue && !proposal)}
          onClick={() => void saveWeight()}
        >
          {busy ? '저장 중…' : checkInDue ? '다음 주 계획 보기' : hasTodayWeight ? '체중 수정' : '체중 저장'}
        </button>
        {msg ? <p role="status" className="dieta-muted">{msg}</p> : null}
      </section>

      <section className="dieta-card dieta-home-summary">
        <div className="dieta-title-row" style={{ marginBottom: '0.55rem' }}>
          <h2>오늘 식사 요약</h2>
          <Link className="dieta-link" to="/hobbies/dieta/meals">
            식사 기록
          </Link>
        </div>
        <p className="dieta-kcal-hero">
          <span>{meals.some(m => m.loggedOn === today) ? todayIntake.kcal.toLocaleString() : '—'}</span>
          <span className="dieta-muted"> / {profile.dailyKcal} kcal</span>
        </p>
        <div
          className="dieta-progress dieta-progress--kcal"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={profile.dailyKcal}
          aria-valuenow={Math.min(todayIntake.kcal, profile.dailyKcal)}
          aria-valuetext={`분석된 섭취 ${todayIntake.kcal} kcal, 목표 ${profile.dailyKcal} kcal`}
          aria-label="오늘 섭취 칼로리"
        >
          <span
            className={kcalOver ? 'is-over' : undefined}
            style={{ width: `${kcalPct}%` }}
          />
        </div>
        <p className="dieta-muted" style={{ marginTop: '0.35rem' }}>
          {meals.some(m => m.loggedOn === today) ? '분석된 식사만 반영했어요.' : '아직 분석된 식사 기록이 없어요.'}
          {queue && queue.status !== 'done' && queue.items.length > 0 ? ` ${queue.items.length}개 음식이 ${queue.status === 'pending' ? '분석 중이에요.' : '분석을 기다리고 있어요.'}` : ''}
        </p>
        {macros ? (
          <div className="dieta-macro-rows" style={{ marginTop: '0.85rem' }}>
            {(
              [
                ['탄수화물', todayIntake.carbG, macros.carbG],
                ['단백질', todayIntake.proteinG, macros.proteinG],
                ['지방', todayIntake.fatG, macros.fatG],
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

      <section className="dieta-card dieta-home-chart">
        <h2>체중 변화</h2>
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
              aria-pressed={weightRange === k}
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

      </div>
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

      {proposalPending && checkInDue ? <p role="status" className="dieta-muted">계획을 불러오는 중…</p> : null}
      {proposalError && checkInDue ? <p role="alert">{proposalError} <button type="button" className="dieta-btn dieta-btn--ghost" onClick={reloadProposal}>다시 시도</button></p> : null}
      {(proposal ?? displayProposal) ? (
        <DietaWeekPlanModal
          open={planOpen}
          profile={profile}
          proposal={(proposal ?? displayProposal)!}
          targetWeightReached={(proposal ?? displayProposal)?.targetWeightReached}
          loading={proposalPending}
          error={proposalError}
          onRetry={reloadProposal}
          plateauChoice={plateauChoice}
          onPlateauChoice={setPlateauChoice}
          weightKg={Number(weightInput) || null}
          busy={busy || !proposal}
          onClose={() => setPlanOpen(false)}
          onConfirm={(keepTargets) => void applyWeekPlan(keepTargets)}
        />
      ) : null}
    </>
  );
}
