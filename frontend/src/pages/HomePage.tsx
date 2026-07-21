import { useEffect, useRef, useState } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';
import { Link } from 'react-router-dom';
import { configApi } from '../api/configApi';
import {
  getFeaturedHobby,
  getHobbyById,
  getHobbiesByCategory,
  HOBBY_CATEGORIES,
  type HobbyApp,
} from '../data/hobbies';

const FEATURED_ROTATE_MS = 5000;

export function HomePage() {
  const [featured, setFeatured] = useState<HobbyApp[]>(() => [getFeaturedHobby()]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await configApi.getFeaturedApps();
        const apps = data.appIds
          .map((id) => getHobbyById(id))
          .filter((app): app is HobbyApp => Boolean(app));
        if (!cancelled && apps.length > 0) {
          setFeatured(apps);
        }
      } catch {
        // 조회 실패 시 기본 추천 앱 유지
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="store-main">
      <header className="store-hero">
        <div className="store-hero-glow" aria-hidden="true" />
        <p className="page-kicker">Today</p>
        <h1>취미를 골라 시작하세요</h1>
        <p className="store-hero-copy">
          종류별로 모아둔 취미 앱에 들어가 보세요.
        </p>
      </header>

      <section className="store-featured" aria-label="추천 앱">
        <FeaturedCarousel apps={featured} />
      </section>

      {HOBBY_CATEGORIES.map((category) => {
        const apps = getHobbiesByCategory(category);
        if (apps.length === 0) {
          return null;
        }

        return (
          <section key={category} className="store-category" aria-label={category}>
            <div className="store-category-head">
              <h2>{category}</h2>
              <span className="store-category-count">{apps.length}</span>
            </div>
            <ul className="store-row">
              {apps.map((app) => (
                <li key={app.id}>
                  <HobbyAppTile app={app} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}

function FeaturedCarousel({ apps }: { apps: HobbyApp[] }) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const count = apps.length;

  const current = Math.min(index, count - 1);

  const goTo = (next: number) => {
    setIndex(((next % count) + count) % count);
  };

  useEffect(() => {
    if (count <= 1) {
      return;
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % count);
    }, FEATURED_ROTATE_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [count]);

  if (count === 0) {
    return null;
  }

  if (count === 1) {
    return <HobbyFeaturedTile app={apps[0]} />;
  }

  const handleTouchStart = (event: ReactTouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: ReactTouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null) {
      return;
    }
    const delta = (event.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(delta) < 40) {
      return;
    }
    goTo(delta < 0 ? current + 1 : current - 1);
  };

  return (
    <div className="featured-carousel" aria-roledescription="carousel">
      <div
        className="featured-carousel__viewport"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="featured-carousel__track"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {apps.map((app, i) => (
            <div
              className="featured-carousel__slide"
              key={app.id}
              aria-hidden={i !== current}
            >
              <HobbyFeaturedTile app={app} />
            </div>
          ))}
        </div>
      </div>

      <div className="featured-carousel__controls">
        <button
          type="button"
          className="featured-carousel__arrow"
          onClick={() => goTo(current - 1)}
          aria-label="이전 추천 앱"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 3.5 5.5 8l4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="featured-carousel__dots" role="tablist" aria-label="추천 앱 선택">
          {apps.map((app, i) => (
            <button
              type="button"
              key={app.id}
              className={
                i === current
                  ? 'featured-carousel__dot featured-carousel__dot--active'
                  : 'featured-carousel__dot'
              }
              onClick={() => goTo(i)}
              aria-label={`${app.name} 보기`}
              aria-selected={i === current}
              role="tab"
            />
          ))}
        </div>

        <button
          type="button"
          className="featured-carousel__arrow"
          onClick={() => goTo(current + 1)}
          aria-label="다음 추천 앱"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M6 3.5 10.5 8 6 12.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function HobbyFeaturedTile({ app }: { app: HobbyApp }) {
  const content = (
    <>
      <div
        className={`featured-icon${app.iconSrc ? ' has-image' : ''}`}
        style={app.iconSrc ? undefined : { background: app.accent }}
      >
        {app.iconSrc ? (
          <img src={app.iconSrc} alt="" width={88} height={88} draggable={false} />
        ) : (
          app.name.slice(0, 1)
        )}
      </div>
      <div className="featured-copy">
        <p className="featured-category">{app.category}</p>
        <h2>{app.name}</h2>
        <p className="featured-subtitle">{app.subtitle}</p>
        <p className="featured-desc">{app.description}</p>
        <span className={`featured-action${app.available ? '' : ' is-soon'}`}>
          {app.available ? '열기' : '곧 공개'}
          {app.available ? (
            <svg
              className="featured-arrow"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5.5 3.5 10 8l-4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </span>
      </div>
    </>
  );

  if (app.available && app.path) {
    return (
      <Link to={app.path} className="featured-tile">
        {content}
      </Link>
    );
  }

  return (
    <div className="featured-tile is-disabled" aria-disabled="true">
      {content}
    </div>
  );
}

function HobbyAppTile({ app }: { app: HobbyApp }) {
  const body = (
    <>
      <div
        className={`app-icon${app.iconSrc ? ' has-image' : ''}`}
        style={app.iconSrc ? undefined : { background: app.accent }}
        aria-hidden="true"
      >
        {app.iconSrc ? (
          <img src={app.iconSrc} alt="" width={50} height={50} draggable={false} />
        ) : (
          app.name.slice(0, 1)
        )}
      </div>
      <div className="app-meta">
        <p className="app-name">{app.name}</p>
        <p className="app-subtitle">{app.subtitle}</p>
      </div>
      <span className={`app-cta ${app.available ? '' : 'is-soon'}`}>
        {app.available ? '열기' : '준비중'}
      </span>
    </>
  );

  if (app.available && app.path) {
    return (
      <Link to={app.path} className="app-tile">
        {body}
      </Link>
    );
  }

  return (
    <div className="app-tile is-disabled" aria-disabled="true">
      {body}
    </div>
  );
}
