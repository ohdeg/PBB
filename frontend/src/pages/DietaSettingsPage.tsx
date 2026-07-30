import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { dietaApi } from '../api/dietaApi';
import type { DietaProfile } from '../features/dieta/types';
import { DIETA_STYLE_LABELS } from '../features/dieta/types';
import { useDietaUserKey } from '../features/dieta/useDietaUserKey';
import { useAuthStore } from '../stores/authStore';

export function DietaSettingsPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const userKey = useDietaUserKey();
  const [profile, setProfile] = useState<DietaProfile | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    void dietaApi.getProfile(userKey).then((p) => {
      setProfile(p);
      setLoaded(true);
    });
  }, [accessToken, userKey]);

  if (!accessToken) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: '/hobbies/dieta/settings' }}
      />
    );
  }

  if (!loaded) {
    return <p className="dieta-muted">불러오는 중…</p>;
  }

  if (!profile?.onboardingComplete) {
    return <Navigate to="/hobbies/dieta/onboarding" replace />;
  }

  const saveNumber = async (patch: Partial<DietaProfile>) => {
    const next = await dietaApi.updateProfile(patch, userKey);
    setProfile(next);
    setMsg('저장했어요.');
  };

  const changeMaintainMode = async (enabled: boolean) => {
    if (busy) {
      return;
    }
    if (enabled === (profile.goalType === 'MAINTAIN')) {
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const next = await dietaApi.setMaintainMode(enabled, userKey);
      setProfile(next);
      setMsg(
        enabled
          ? '유지 모드로 바꿨어요. 일일 목표는 TDEE예요.'
          : `${next.goalType === 'LOSS' ? '감량' : '증량'} 모드로 돌아갔어요.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const resetOnboarding = async () => {
    if (busy) {
      return;
    }
    const ok = window.confirm(
      '기존 체중·섭취·레시피·체크인 데이터가 모두 삭제됩니다. 온보딩을 다시 할까요?',
    );
    if (!ok) {
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await dietaApi.resetAll(userKey);
      void navigate('/hobbies/dieta/onboarding', { replace: true });
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : '온보딩 초기화에 실패했어요.');
      setBusy(false);
    }
  };

  const maintainOn = profile.goalType === 'MAINTAIN';

  return (
    <>
      <div className="dieta-title-row">
        <h1>설정</h1>
        <button
          type="button"
          className="dieta-link"
          disabled={busy}
          onClick={() => void resetOnboarding()}
        >
          온보딩 다시
        </button>
      </div>

      <section className="dieta-card">
        <strong>목표 모드</strong>
        <p className="dieta-muted" style={{ margin: '0.35rem 0 0.65rem' }}>
          목표 체중 도달 시 유지로 자동 전환돼요. 끄면 이전 감량·증량으로
          돌아가요.
        </p>
        <div className="dieta-switch-row">
          <span id="dieta-maintain-label" className="dieta-muted">
            유지 모드
            {maintainOn
              ? null
              : ` (현재 ${profile.goalType === 'LOSS' ? '감량' : '증량'})`}
          </span>
          <button
            type="button"
            role="switch"
            className="dieta-switch"
            aria-checked={maintainOn}
            aria-labelledby="dieta-maintain-label"
            disabled={busy}
            onClick={() => void changeMaintainMode(!maintainOn)}
          />
        </div>
        <div className="dieta-list-row">
          <span>목표 체중</span>
          <strong>
            {profile.targetWeightKg != null ? `${profile.targetWeightKg} kg` : '—'}
          </strong>
        </div>
        <div className="dieta-list-row">
          <span>주간 W</span>
          <strong>{profile.weeklyTargetKg} kg</strong>
        </div>
        <div className="dieta-list-row">
          <span>스타일</span>
          <strong>{DIETA_STYLE_LABELS[profile.dietStyle]}</strong>
        </div>
        <div className="dieta-list-row">
          <span>일일 목표</span>
          <strong>{profile.dailyKcal} kcal</strong>
        </div>
        <div className="dieta-list-row">
          <span>TDEE / BMR</span>
          <strong>
            {profile.tdeeKcal} / {profile.bmrKcal}
          </strong>
        </div>
        <div className="dieta-list-row">
          <span>탄단지 %</span>
          <strong>
            {Math.round(profile.macros.carbPct * 100)}/
            {Math.round(profile.macros.proteinPct * 100)}/
            {Math.round(profile.macros.fatPct * 100)}
          </strong>
        </div>
      </section>

      {profile.goalType !== 'MAINTAIN' ? (
        <section className="dieta-card">
          <strong>목표 조절</strong>
          <div className="dieta-field">
            <label>목표 체중 (kg)</label>
            <input
              key={`tw-${profile.goalType}-${profile.targetWeightKg ?? 'x'}`}
              defaultValue={profile.targetWeightKg ?? ''}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n > 0) {
                  void saveNumber({ targetWeightKg: n });
                }
              }}
            />
          </div>
          <div className="dieta-field">
            <label>주간 목표 W (kg)</label>
            <input
              key={`w-${profile.goalType}-${profile.weeklyTargetKg}`}
              defaultValue={profile.weeklyTargetKg}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 0) {
                  const derived = Math.round(n * 0.9 * 1000) / 1000;
                  void saveNumber({
                    weeklyTargetKg: n,
                    weeklyBodyFatLossKg:
                      profile.goalType === 'LOSS' ? derived : null,
                    weeklyMuscleGainKg:
                      profile.goalType === 'GAIN' ? derived : null,
                  });
                }
              }}
            />
          </div>
        </section>
      ) : (
        <section className="dieta-card">
          <strong>목표 체중</strong>
          <p className="dieta-muted" style={{ margin: '0.35rem 0 0.65rem' }}>
            유지 중에도 목표 체중은 남겨 둘 수 있어요. 유지 모드를 끌 때 그대로
            씁니다.
          </p>
          <div className="dieta-field">
            <label>목표 체중 (kg)</label>
            <input
              key={`tw-maintain-${profile.targetWeightKg ?? 'x'}`}
              defaultValue={profile.targetWeightKg ?? ''}
              onBlur={(e) => {
                const raw = e.target.value.trim();
                if (raw === '') {
                  void saveNumber({ targetWeightKg: null });
                  return;
                }
                const n = Number(raw);
                if (Number.isFinite(n) && n > 0) {
                  void saveNumber({ targetWeightKg: n });
                }
              }}
            />
          </div>
        </section>
      )}

      <section className="dieta-card">
        <strong>가감 kcal</strong>
        <div className="dieta-field">
          <label>정체 식사 감소</label>
          <input
            defaultValue={profile.lossCutKcal}
            onBlur={(e) =>
              void saveNumber({ lossCutKcal: Number(e.target.value) })
            }
          />
        </div>
        <div className="dieta-field">
          <label>정체 활동 +kcal</label>
          <input
            defaultValue={profile.lossActivityKcal}
            onBlur={(e) =>
              void saveNumber({ lossActivityKcal: Number(e.target.value) })
            }
          />
        </div>
        <div className="dieta-field">
          <label>GAIN 상한 δ</label>
          <input
            defaultValue={profile.gainCeilingDeltaKcal}
            onBlur={(e) =>
              void saveNumber({ gainCeilingDeltaKcal: Number(e.target.value) })
            }
          />
        </div>
        <label className="dieta-muted" style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={profile.geminiMealConsent}
            onChange={(e) =>
              void saveNumber({ geminiMealConsent: e.target.checked })
            }
          />
          식단 AI 마감 분석 동의 (하루 큐 → Gemini)
        </label>
        {msg ? <p className="dieta-muted">{msg}</p> : null}
      </section>
    </>
  );
}
