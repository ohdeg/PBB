import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BREW_RECIPES } from '../data/brews';

export function BrewNotePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const recipe = useMemo(
    () => BREW_RECIPES.find((item) => item.id === selectedId) ?? null,
    [selectedId],
  );

  return (
    <main className="brew-main">
      <Link to="/" className="back-link">
        ← 메인
      </Link>
      <p className="page-kicker">라이프</p>
      <h1>Brew Note</h1>
      <p className="brew-lead">원두·추출·테이스팅을 레시피로 모아두는 홈카페 노트입니다.</p>

      {BREW_RECIPES.length === 0 ? (
        <p className="empty-state">저장된 레시피가 없습니다.</p>
      ) : (
        <div className="brew-layout">
          <aside className="brew-list" aria-label="레시피 목록">
            <h2>레시피</h2>
            <ul>
              {BREW_RECIPES.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={
                      item.id === recipe?.id
                        ? 'brew-list-item is-active'
                        : 'brew-list-item'
                    }
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className="brew-list-title">{item.name}</span>
                    <span className="brew-list-meta">{item.method}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="brew-detail" aria-label="레시피 상세">
            {recipe ? (
              <>
                <header className="brew-detail-head">
                  <h2>{recipe.name}</h2>
                  <p>{recipe.method}</p>
                </header>

                <dl className="brew-specs">
                  <div>
                    <dt>원두</dt>
                    <dd>{recipe.beans}</dd>
                  </div>
                  <div>
                    <dt>Dose</dt>
                    <dd>{recipe.dose}</dd>
                  </div>
                  <div>
                    <dt>Water</dt>
                    <dd>{recipe.water}</dd>
                  </div>
                  <div>
                    <dt>온도</dt>
                    <dd>{recipe.temperature}</dd>
                  </div>
                  <div>
                    <dt>시간</dt>
                    <dd>{recipe.time}</dd>
                  </div>
                  <div>
                    <dt>분쇄</dt>
                    <dd>{recipe.grind}</dd>
                  </div>
                </dl>

                <div className="brew-notes">
                  <h3>노트</h3>
                  <p>{recipe.notes}</p>
                </div>
              </>
            ) : (
              <p className="empty-state">레시피를 선택해 주세요.</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
