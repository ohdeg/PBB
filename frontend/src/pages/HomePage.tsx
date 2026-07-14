import { Link } from 'react-router-dom';
import {
  getFeaturedHobby,
  getHobbiesByCategory,
  HOBBY_CATEGORIES,
  type HobbyApp,
} from '../data/hobbies';

export function HomePage() {
  const featured = getFeaturedHobby();

  return (
    <main className="store-main">
      <header className="store-hero">
        <p className="page-kicker">Today</p>
        <h1>취미를 골라 시작하세요</h1>
        <p className="store-hero-copy">
          종류별로 모아둔 취미 앱에 들어가 보세요.
        </p>
      </header>

      <section className="store-featured" aria-label="추천 앱">
        <HobbyFeaturedTile app={featured} />
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

function HobbyFeaturedTile({ app }: { app: HobbyApp }) {
  const content = (
    <>
      <div className="featured-icon" style={{ background: app.accent }}>
        {app.name.slice(0, 1)}
      </div>
      <div className="featured-copy">
        <p className="featured-category">{app.category}</p>
        <h2>{app.name}</h2>
        <p className="featured-subtitle">{app.subtitle}</p>
        <p className="featured-desc">{app.description}</p>
        <span className="featured-action">
          {app.available ? '열기' : '곧 공개'}
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
      <div className="app-icon" style={{ background: app.accent }} aria-hidden="true">
        {app.name.slice(0, 1)}
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
