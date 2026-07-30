import { useEffect, useMemo, useState } from 'react';
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

  const today = todayIsoDate();

  const refresh = async () => {
    const [p, body, acts] = await Promise.all([
      dietaApi.getProfile(userKey),
      dietaApi.listBodyLogs(userKey),
      dietaApi.listActivities(userKey),
    ]);
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
  };

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    void refresh();
  }, [accessToken, userKey, today]);

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
        <strong>
          이번 주 활동 목표 +
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
              <span>빠른 걷기</span>
              <strong>약 {targets.minutesBrisk}분</strong>
            </div>
            <div className="dieta-list-row">
              <span>중강도</span>
              <strong>약 {targets.minutesMod}분</strong>
            </div>
          </div>
        ) : (
          <p className="dieta-muted">온보딩 후 목표가 표시됩니다.</p>
        )}
      </section>

      <section className="dieta-card">
        <strong>오늘 활동량</strong>
        <p className="dieta-muted">아는 항목만 적어도 됩니다.</p>
        <div className="dieta-field">
          <label>걸음</label>
          <input
            inputMode="numeric"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
          />
        </div>
        <div className="dieta-field">
          <label>운동 시간 (분)</label>
          <input
            inputMode="numeric"
            value={mins}
            onChange={(e) => setMins(e.target.value)}
          />
        </div>
        <div className="dieta-field">
          <label>활동 kcal</label>
          <input
            inputMode="numeric"
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
          {todayLog ? '오늘 활동 수정' : '오늘 활동 저장'}
        </button>
        {msg ? <p className="dieta-muted">{msg}</p> : null}
      </section>

      <section className="dieta-card">
        <strong>최근 기록</strong>
        {recent.length === 0 ? (
          <p className="dieta-muted">아직 없어요.</p>
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
