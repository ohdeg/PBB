import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const HUB_PATH = '/hobbies/veveno/hub';

/** 공개 소개 랜딩 — SEO 대상. 앱 허브는 /hobbies/veveno/hub */
export function VevenoLandingPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);

  const handleStart = () => {
    if (accessToken) {
      void navigate(HUB_PATH);
      return;
    }
    void navigate('/login', { state: { from: HUB_PATH } });
  };

  return (
    <main className="store-main veveno-landing">
      <header className="store-hero veveno-landing__hero">
        <div
          className="store-hero-glow veveno-landing__glow"
          aria-hidden="true"
        />
        <p className="page-kicker">라이프</p>
        <p className="veveno-landing__brand">Veveno</p>
        <h1>가게 노트를 가볍게</h1>
        <p className="store-hero-copy">
          메뉴·재고·근무를 한곳에 남기는 매장 노트. 업주와 직원이 같은 화면에서
          일상을 정리합니다.
        </p>
        <div className="veveno-landing__actions">
          <button type="button" className="btn-primary" onClick={handleStart}>
            시작하기
          </button>
          <Link to="/" className="btn-secondary link-as-btn">
            홈으로
          </Link>
        </div>
      </header>
    </main>
  );
}
