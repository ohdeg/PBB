import { Link } from 'react-router-dom';
import { SRANKO_CLOSET } from '../features/sranko/paths';
import {
  useSrankoLooks,
  useSrankoMutations,
} from '../features/sranko/useSrankoStore';
import { useAuthStore } from '../stores/authStore';

export function SrankoLooksPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { looks, reload } = useSrankoLooks();
  const { removeLook } = useSrankoMutations();

  if (!accessToken) {
    return (
      <section className="sranko-panel">
        <h1>내 룩</h1>
        <div className="sranko-empty">
          <Link className="sranko-link" to="/login" state={{ from: '/hobbies/sranko/looks' }}>
            로그인
          </Link>
          이 필요합니다.
        </div>
      </section>
    );
  }

  return (
    <section className="sranko-panel">
      <h1>내 룩</h1>
      <p className="sranko-panel__lede">입어보기·합성 결과를 모아 둡니다.</p>
      {looks.length === 0 ? (
        <div className="sranko-empty">
          등록된 look이 없습니다.{' '}
          <Link className="sranko-link" to={SRANKO_CLOSET}>
            옷장에서 입어보기
          </Link>
        </div>
      ) : (
        <div className="sranko-grid">
          {looks.map((look) => (
            <article key={look.id} className="sranko-card">
              <img src={look.imageUrl} alt={look.name} />
              <div className="sranko-card__body">
                <strong>{look.name}</strong>
                <span>{look.source === 'TRY_ON' ? '입어보기' : '합성'}</span>
                <div className="sranko-card__actions">
                  <button
                    type="button"
                    className="sranko-btn sranko-btn--ghost sranko-btn--sm"
                    onClick={() => {
                      if (window.confirm('이 룩을 삭제할까요?')) {
                        void removeLook(look.id).then(() => reload());
                      }
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
