import { DietaLoadState } from '../components/dieta/DietaLoadState';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { dietaApi } from '../api/dietaApi';
import { useDietaProposal } from '../features/dieta/useDietaProposal';
import { DietaWeekPlanModal } from '../components/dieta/DietaWeekPlanModal';
import type { DietaBodyLog, DietaProfile } from '../features/dieta/types';
import { useDietaUserKey } from '../features/dieta/useDietaUserKey';
import {
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
  const [weight, setWeight] = useState('');
  const [keto, setKeto] = useState(false);
  const [plateauChoice, setPlateauChoice] = useState<DietaPlateauChoice>('CUT_KCAL');
  const [planOpen, setPlanOpen] = useState(false);
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [completed, setCompleted] = useState(false);

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
      const body = await dietaApi.listBodyLogs(userKey);
      if (cancelled) return;
      setProfile(p);
      setLogs(body);
      const todayLog = body.find((l) => l.loggedOn === today);
      if (todayLog?.weightKg != null) {
        setWeight(String(todayLog.weightKg));
      }
      setLoaded(true);
    })().catch((e: unknown) => { if (!cancelled) setLoadError(e instanceof Error ? e.message : '기록을 불러오지 못했어요.'); });
    return () => { cancelled = true; };
  }, [accessToken, userKey, today, retry]);

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

  const { proposal, displayProposal, pending: proposalPending, error: proposalError, reload: reloadProposal } = useDietaProposal({
    enabled: Boolean(accessToken && profile?.onboardingComplete),
    loggedOn: today, weight: weight, plateauChoice,
    contextKey: JSON.stringify(profile),
  });

  if (!accessToken) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: '/hobbies/dieta/check-in' }}
      />
    );
  }

  if (!loaded || loadError) return <DietaLoadState error={loadError} onRetry={() => setRetry(n => n + 1)} />;

  if (!profile?.onboardingComplete) {
    return <Navigate to="/hobbies/dieta/onboarding" replace />;
  }

  const saveAndOpenPlan = async () => {
    if (proposal && !busy) setPlanOpen(true);
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
          revisionToken: proposal.revisionToken,
        },
        userKey,
      );
      let ketoWarning = '';
      if (keto) {
        try { await dietaApi.recordKeto(false, userKey); }
        catch { ketoWarning = ' 키토플루 기록은 저장하지 못했어요.'; }
      }
      setProfile(updated);
      setPlanOpen(false);
      setCompleted(true);
      setResult((
        reached
          ? '목표 체중에 도달했어요. 유지 모드로 바꿨어요.'
          : keepTargets
            ? '식사·활동·W는 유지하고, 다음 주를 시작했어요.'
            : `체중 기준으로 조정했어요. 일일 ${updated.dailyKcal}kcal` +
              (updated.weekActivityExtraKcal > 0
                ? ` · 활동 +${updated.weekActivityExtraKcal}kcal`
                : '')
      ) + ketoWarning);
    } catch (error: unknown) {
      setResult(error instanceof Error ? error.message : '계획을 적용하지 못했어요.');
      reloadProposal();
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

      {result ? <p role="status" className="dieta-muted">{result}</p> : null}
      {proposalPending ? <p role="status" className="dieta-muted">계획을 불러오는 중…</p> : null}
      {proposalError ? <p role="alert">{proposalError} <button type="button" className="dieta-btn dieta-btn--ghost" onClick={reloadProposal}>다시 시도</button></p> : null}
      <section className="dieta-card">
        <p className="dieta-muted" style={{ marginBottom: '0.65rem' }}>
          이번 체크인 체중으로 직전 체크인(온보딩)과 비교합니다. 중간 매일 기록은
          추이만 반영돼요. 같은 날이면 수정할 수 있어요.
        </p>
        <div className="dieta-field">
          <label htmlFor="dieta-checkin-weight">체중 (kg)</label>
          <input id="dieta-checkin-weight" inputMode="decimal" name="weight" autoComplete="off" disabled={busy} value={weight} onChange={(e) => setWeight(e.target.value)} />
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

      <section className="dieta-card">
        <h2>이번 기록 요약</h2>
        <div className="dieta-list-row">
          <span>평균 섭취</span>
          <strong>
            {(proposal?.intakeDays ?? 0) > 0
              ? `${proposal?.avgIntakeKcal} kcal (${(proposal?.intakeDays ?? 0)}일)`
              : proposal ? '분석된 식사 기록 없음' : '체중을 입력하면 확인할 수 있어요.'}
          </strong>
        </div>
        <div className="dieta-list-row">
          <span>직전 체크인 체중</span>
          <strong>
            {baseline?.weightKg != null ? `${baseline.weightKg} kg` : '—'}
          </strong>
        </div>
        <p className="dieta-muted" style={{ marginTop: '0.35rem' }}>
          비교 기간 {profile.weekStartsOn} ~ {today} · 주간 목표 {profile.weeklyTargetKg}{' '}
          kg
        </p>
      </section>

      <button
        type="button"
        className="dieta-btn dieta-btn--primary dieta-btn--block"
        disabled={busy || !proposal}
        onClick={() => void saveAndOpenPlan()}
      >
        {hasTodayEntry ? '체중 수정 · 다음 주 계획 보기' : '다음 주 계획 보기'}
      </button>

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
          weightKg={Number(weight) || null}
          busy={busy || !proposal}
          onClose={() => setPlanOpen(false)}
          onConfirm={(keepTargets) => void confirmProposal(keepTargets)}
        />
      ) : null}
    </>
  );
}
