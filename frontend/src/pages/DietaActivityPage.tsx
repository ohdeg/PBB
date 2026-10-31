import { DietaLoadState } from '../components/dieta/DietaLoadState';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { dietaApi } from '../api/dietaApi';
import type { DietaActivityLog, DietaBodyLog, DietaProfile } from '../features/dieta/types';
import { useDietaUserKey } from '../features/dieta/useDietaUserKey';
import {
  activityFromExtraKcal,
  todayIsoDate,
} from '../features/dieta/utils/dietaMath';
import { useAuthStore } from '../stores/authStore';

export function DietaActivityPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const userKey = useDietaUserKey();
  const [profile, setProfile] = useState<DietaProfile | null>(null);
  const [logs, setLogs] = useState<DietaBodyLog[]>([]);
  const [todayLog, setTodayLog] = useState<DietaActivityLog | null>(null);
  const [recent, setRecent] = useState<DietaActivityLog[]>([]);
  const [steps, setSteps] = useState('');
  const [mins, setMins] = useState('');
  const [kcal, setKcal] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const today = todayIsoDate();

  const refresh = useCallback(async () => {
    const p = await dietaApi.getProfile(userKey);
    if (!p?.onboardingComplete) {setProfile(p); setLoaded(true); setLoadError(''); return;}
    const [body, acts] = await Promise.all([
      dietaApi.listBodyLogs(userKey),
      dietaApi.listActivities(userKey),
    ]);
    setLoaded(true); setLoadError('');
    setProfile(p);
    setLogs(body);
    const row = acts.find((a) => a.loggedOn === today) ?? null;
    setTodayLog(row);
    setRecent(acts.slice(-7).reverse());
    if (row) {
      setSteps(row.steps != null ? String(row.steps) : '');
      setMins(row.durationMin != null ? String(row.durationMin) : '');
      setKcal(row.activityKcal != null ? String(row.activityKcal) : '');
    }
  }, [userKey, today]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    setLoadError(''); setLoaded(false);
    void refresh().catch(e => setLoadError(e instanceof Error ? e.message : '활동을 불러오지 못했어요.'));
  }, [accessToken, userKey, today, retry, refresh]);

  const weightKg =
    [...logs].reverse().find((l) => l.weightKg != null)?.weightKg ?? null;

  const targets = useMemo(() => {
    if (!profile) {
      return null;
    }
    const extra =
      profile.weekActivityExtraKcal > 0
        ? profile.weekActivityExtraKcal
        : profile.lossActivityKcal;
    return activityFromExtraKcal({
      extraKcal: extra,
      weightKg,
      heightCm: profile.heightCm,
    });
  }, [profile, weightKg]);

  if (!accessToken) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: '/hobbies/dieta/activity' }}
      />
    );
  }

  if (!loaded || loadError) return <DietaLoadState error={loadError} onRetry={() => setRetry(n => n + 1)} />;
  if (!profile?.onboardingComplete) return <Navigate to="/hobbies/dieta/onboarding" replace />;

  const save = async () => {
    const stepsN = steps.trim() ? Number(steps) : null;
    const minsN = mins.trim() ? Number(mins) : null;
    const kcalN = kcal.trim() ? Number(kcal) : null;
    if (
      (stepsN != null && (!Number.isFinite(stepsN) || stepsN < 0))
      || (minsN != null && (!Number.isFinite(minsN) || minsN < 0))
      || (kcalN != null && (!Number.isFinite(kcalN) || kcalN < 0))
    ) {
      setMsg('활동량은 0 이상 숫자로 입력해 주세요.');
      return;
    }
    if (stepsN == null && minsN == null && kcalN == null) {
      setMsg('걸음·분·활동 kcal 중 하나 이상 적어 주세요.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await dietaApi.upsertActivity(
        {
          loggedOn: today,
          steps: stepsN,
          durationMin: minsN,
          activityKcal: kcalN,
        },
        userKey,
      );
      setMsg('오늘 활동을 저장했어요.');
      await refresh();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : '저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="dieta-title-row">
        <h1>활동</h1>
      </div>

      <section className="dieta-card">
        <h2>오늘 활동 기록</h2>
        <p className="dieta-muted">걸음, 시간, 소모 열량 중 아는 항목만 입력하세요.</p>
        <div className="dieta-field">
          <label htmlFor="dieta-activity-steps">걸음</label>
          <input
            inputMode="numeric"
            id="dieta-activity-steps" name="steps" autoComplete="off" disabled={busy}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
          />
        </div>
        <div className="dieta-field">
          <label htmlFor="dieta-activity-mins">운동 시간 (분)</label>
          <input
            inputMode="numeric"
            id="dieta-activity-mins" name="mins" autoComplete="off" disabled={busy}
            value={mins}
            onChange={(e) => setMins(e.target.value)}
          />
        </div>
        <div className="dieta-field">
          <label htmlFor="dieta-activity-kcal">활동 kcal</label>
          <input
            inputMode="numeric"
            id="dieta-activity-kcal" name="kcal" autoComplete="off" disabled={busy}
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="dieta-btn dieta-btn--primary dieta-btn--block"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? '저장 중…' : todayLog ? '오늘 활동 수정' : '오늘 활동 저장'}
        </button>
        {msg ? <p role="status" className="dieta-notice">{msg}</p> : null}
      </section>

      <section className="dieta-card">
        <strong>
          이번 주 추가 활동 목표 ·{' '}
          {(profile?.weekActivityExtraKcal ?? 0) > 0
            ? profile?.weekActivityExtraKcal
            : (profile?.lossActivityKcal ?? '—')}
          kcal
          {(profile?.weekActivityExtraKcal ?? 0) > 0 ? (
            <span className="dieta-badge" style={{ marginLeft: '0.4rem' }}>
              체크인
            </span>
          ) : null}
        </strong>
        {targets ? (
          <div style={{ marginTop: '0.75rem' }}>
            <div className="dieta-list-row">
              <span>걸음</span>
              <strong>약 {targets.steps.toLocaleString()}보</strong>
            </div>
            <div className="dieta-list-row">
              <span>또는 빠른 걷기</span>
              <strong>약 {targets.minutesBrisk}분</strong>
            </div>
            <div className="dieta-list-row">
              <span>또는 중강도 운동</span>
              <strong>약 {targets.minutesMod}분</strong>
            </div>
          </div>
        ) : (
          <p className="dieta-muted">온보딩 후 목표가 표시됩니다.</p>
        )}
      </section>

      <section className="dieta-card">
        <h2>최근 기록</h2>
        {recent.length === 0 ? (
          <p className="dieta-muted">아직 활동 기록이 없어요. 오늘의 움직임을 남겨 보세요.</p>
        ) : (
          recent.map((r) => (
            <div key={r.id} className="dieta-list-row">
              <span>{r.loggedOn}</span>
              <span className="dieta-muted">
                {[
                  r.steps != null ? `${r.steps.toLocaleString()}보` : null,
                  r.durationMin != null ? `${r.durationMin}분` : null,
                  r.activityKcal != null ? `${r.activityKcal}kcal` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </span>
            </div>
          ))
        )}
      </section>
    </>
  );
}
