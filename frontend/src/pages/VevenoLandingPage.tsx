import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { brewApi } from '../api/brewApi';
import { useAuthStore } from '../stores/authStore';

const HUB_PATH = '/hobbies/veveno/hub';

interface LandingFeature {
  label: string;
  title: string;
  body: string;
}

interface LandingStep {
  step: string;
  title: string;
  body: string;
}

type GateState = 'guest' | 'checking' | 'skip' | 'show';

const FEATURES: LandingFeature[] = [
  {
    label: '메뉴',
    title: '만드는 법을 살짝 적어 두기',
    body: '메뉴마다 레시피를 남겨 두면, 바쁠 때도 조금 더 마음이 놓여요.',
  },
  {
    label: '재고',
    title: '무엇이 부족한지 먼저 보기',
    body: '재고를 한눈에 두고, 필요할 때만 근무 중에 숫자를 고쳐 보시면 좋아요.',
  },
  {
    label: '근무',
    title: '누가 언제 오는지 맞추기',
    body: '정규 근무부터 대타·추가까지, 달력으로 보면서 서로 맞춰 가시면 됩니다.',
  },
  {
    label: '도구',
    title: '가게에서 바로 쓰는 작은 도구',
    body: '단위를 바꾸거나 타이머를 맞춰 둘 때, 다른 앱을 따로 찾지 않아도 돼요.',
  },
];

const STEPS: LandingStep[] = [
  {
    step: '01',
    title: '시작하기를 눌러 주세요',
    body: '처음이시면 로그인·가입으로 안내해 드릴게요. 이미 들어와 계시면 가게 목록으로 이어질 수 있어요.',
  },
  {
    step: '02',
    title: '가게를 만들거나 찾아 주세요',
    body: '사장님이시면 가게를 하나 만드시면 되고, 직원이시면 이름이나 코드로 찾아 가입을 신청해 보시면 됩니다.',
  },
  {
    step: '03',
    title: '필요한 탭만 열어 쓰기',
    body: '메뉴, 재고, 근무, 도구… 그날 필요한 곳만 열어서 이어 가시면 충분해요.',
  },
];

/** 공개 소개 랜딩 — SEO 대상. 앱 허브는 /hobbies/veveno/hub */
export function VevenoLandingPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [gate, setGate] = useState<GateState>(accessToken ? 'checking' : 'guest');

  useEffect(() => {
    if (!accessToken) {
      setGate('guest');
      return;
    }

    let cancelled = false;
    setGate('checking');

    void (async () => {
      try {
        const [mine, subs] = await Promise.all([
          brewApi.myStores(),
          brewApi.subscriptions(),
        ]);
        if (cancelled) {
          return;
        }
        const hasStore = mine.data.length > 0 || subs.data.length > 0;
        setGate(hasStore ? 'skip' : 'show');
      } catch {
        if (!cancelled) {
          setGate('show');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const handleStart = () => {
    if (accessToken) {
      void navigate(HUB_PATH);
      return;
    }
    void navigate('/login', { state: { from: HUB_PATH } });
  };

  if (gate === 'skip') {
    return <Navigate to={HUB_PATH} replace />;
  }

  if (gate === 'checking') {
    return (
      <main className="veveno-landing veveno-landing--gate" aria-busy="true">
        <p className="veveno-landing__gate-copy">잠시만요…</p>
      </main>
    );
  }

  return (
    <main className="veveno-landing">
      <div className="veveno-landing__inner">
        <header className="veveno-landing__hero">
          <p className="veveno-landing__kicker">라이프 · 가게 노트</p>
          <p className="veveno-landing__brand">Veveno</p>
          <h1 className="veveno-landing__headline">가게 일을 조금 더 편하게</h1>
          <p className="veveno-landing__lead">
            메뉴, 재고, 근무를 한곳에 모아 두는 작은 노트예요. 사장님과 직원이
            같은 화면을 보면서, 하루를 맞춰 가시면 좋을 것 같아요.
          </p>
          <div className="veveno-landing__actions">
            <button
              type="button"
              className="veveno-landing__btn veveno-landing__btn--primary"
              onClick={handleStart}
            >
              시작하기
            </button>
            <Link to="/" className="veveno-landing__btn veveno-landing__btn--ghost">
              홈으로
            </Link>
          </div>
        </header>

        <section className="veveno-landing__section" aria-labelledby="veveno-features-title">
          <p className="veveno-landing__section-label">이런 앱이에요</p>
          <h2 id="veveno-features-title" className="veveno-landing__section-title">
            이런 걸 도와드려요
          </h2>
          <ul className="veveno-landing__features">
            {FEATURES.map((feature) => (
              <li key={feature.label} className="veveno-landing__feature">
                <p className="veveno-landing__feature-label">{feature.label}</p>
                <p className="veveno-landing__feature-title">{feature.title}</p>
                <p className="veveno-landing__feature-body">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="veveno-landing__section" aria-labelledby="veveno-howto-title">
          <p className="veveno-landing__section-label">시작은 이렇게</p>
          <h2 id="veveno-howto-title" className="veveno-landing__section-title">
            이렇게 시작해 보시면 좋아요
          </h2>
          <ol className="veveno-landing__steps">
            {STEPS.map((item) => (
              <li key={item.step} className="veveno-landing__step">
                <span className="veveno-landing__step-num" aria-hidden="true">
                  {item.step}
                </span>
                <div>
                  <p className="veveno-landing__step-title">{item.title}</p>
                  <p className="veveno-landing__step-body">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="veveno-landing__closing" aria-label="시작 유도">
          <p className="veveno-landing__closing-copy">
            준비되셨다면 시작해 보세요. 들어가시면 가게를 만들거나 찾아 보실 수 있어요.
          </p>
          <button
            type="button"
            className="veveno-landing__btn veveno-landing__btn--primary"
            onClick={handleStart}
          >
            시작하기
          </button>
        </section>
      </div>
    </main>
  );
}
