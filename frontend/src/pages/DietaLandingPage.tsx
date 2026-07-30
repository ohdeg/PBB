import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { dietaApi } from '../api/dietaApi';
import '../features/dieta/dieta.css';
import { useDietaUserKey } from '../features/dieta/useDietaUserKey';
import { useAuthStore } from '../stores/authStore';

const HOME = '/hobbies/dieta/home';
const ONBOARDING = '/hobbies/dieta/onboarding';

export function DietaLandingPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const userKey = useDietaUserKey();
  const [gate, setGate] = useState<'show' | 'skip-home' | 'skip-onboarding' | 'checking'>(
    accessToken ? 'checking' : 'show',
  );

  useEffect(() => {
    if (!accessToken) {
      setGate('show');
      return;
    }
    let cancelled = false;
    setGate('checking');
    void dietaApi.getProfile(userKey).then((p) => {
      if (cancelled) return;
      if (p?.onboardingComplete) {
        setGate('skip-home');
      } else {
        setGate('show');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, userKey]);

  const handleStart = () => {
    if (accessToken) {
      void navigate(ONBOARDING);
      return;
    }
    void navigate('/login', { state: { from: ONBOARDING } });
  };

  if (gate === 'skip-home') {
    return <Navigate to={HOME} replace />;
  }

  if (gate === 'checking') {
    return (
      <div className="dieta-app dieta-landing">
        <p className="dieta-muted" style={{ padding: '2rem', textAlign: 'center' }}>
          잠시만요…
        </p>
      </div>
    );
  }

  return (
    <div className="dieta-app dieta-landing">
      <div className="dieta-landing__orb dieta-landing__orb--a" aria-hidden />
      <div className="dieta-landing__orb dieta-landing__orb--b" aria-hidden />
      <header className="dieta-landing__hero">
        <p className="dieta-badge">Esperanto · diet</p>
        <h1 className="dieta-landing__brand">Dieta</h1>
        <p className="dieta-landing__tag">
          체중과 평소 리듬을 기준으로, 키토플루를 피하며 한 주씩 부드럽게
          조절하는 코칭 노트.
        </p>
        <div className="dieta-landing__cta">
          <button
            type="button"
            className="dieta-btn dieta-btn--primary"
            onClick={handleStart}
          >
            시작하기
          </button>
        </div>
      </header>

      <section className="dieta-landing__section">
        <h2 className="dieta-display">이런 걸 할 수 있어요</h2>
        <div className="dieta-feature-grid">
          <article className="dieta-feature">
            <strong>내 목표에 맞는 하루 식사량</strong>
            <p>감량·증량 목표를 정하면, 매일 얼마나 먹으면 좋을지 알려 줘요.</p>
          </article>
          <article className="dieta-feature">
            <strong>체중 변화를 한눈에</strong>
            <p>
              원하면 매일, 아니면 주간 체크인 때 체중을 남기고 변화를 따라가 볼 수
              있어요.
            </p>
          </article>
          <article className="dieta-feature">
            <strong>먹은 걸 끼니별로 쌓아 두기</strong>
            <p>
              아침·점심·저녁·간식으로 적어 두고, 하루가 끝나면 한 번에 분석해요.
            </p>
          </article>
          <article className="dieta-feature">
            <strong>이번 주 걷을 걸음·운동으로</strong>
            <p>활동이 더 필요할 때, 몇 보·몇 분이면 되는지 바로 보여 줘요.</p>
          </article>
        </div>
      </section>
    </div>
  );
}
