import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { configApi } from '../api/configApi';
import {
  getHobbyById,
  getHobbyMediaSrc,
  HOBBY_APPS,
  sortHobbiesByRecency,
  type HobbyApp,
  type HobbyBlockTone,
} from '../data/hobbies';
import { useAuthStore } from '../stores/authStore';

export function HomePage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await configApi.getFeaturedApps();
        const ids = data.appIds
          .map((id) => getHobbyById(id)?.id)
          .filter((id): id is string => Boolean(id));
        if (!cancelled) {
          setFeaturedIds(ids);
        }
      } catch {
        if (!cancelled) {
          setFeaturedIds([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const gridApps = useMemo(() => orderHomeApps(featuredIds), [featuredIds]);
  const marqueeApps = HOBBY_APPS.filter((app) => app.available);

  return (
    <main className="figma-home">
      <section className="figma-hero" aria-label="PBB 소개">
        <p className="figma-eyebrow">Play beom&apos;s BAG</p>
        <h1 className="figma-hero__title">취미 앱을 모은 가방</h1>
        <p className="figma-hero__lead">
          가게 노트부터 악보·체중·옷장까지. 골라 열고, 바로 이어서.
        </p>
        <div className="figma-hero__actions">
          <a href="#apps" className="figma-pill figma-pill--primary">
            취미 둘러보기
          </a>
          {!accessToken ? (
            <Link to="/signup" className="figma-pill figma-pill--secondary">
              가입하기
            </Link>
          ) : null}
        </div>
      </section>

      <div className="figma-marquee" aria-hidden="true">
        <div className="figma-marquee__track">
          {[...marqueeApps, ...marqueeApps].map((app, i) => (
            <span key={`${app.id}-${i}`} className="figma-marquee__item">
              {app.name}
            </span>
          ))}
        </div>
      </div>

      <section id="apps" className="figma-apps" aria-label="취미 앱">
        <div className="figma-apps__featured">
          {gridApps.slice(0, 2).map((app) => (
            <ColorBlock key={app.id} app={app} featured />
          ))}
        </div>
        <div className="figma-apps__grid">
          {gridApps.slice(2).map((app) => (
            <ColorBlock key={app.id} app={app} />
          ))}
        </div>
      </section>
    </main>
  );
}

function orderHomeApps(featuredIds: string[]): HobbyApp[] {
  const available = HOBBY_APPS.filter((app) => app.available);
  if (featuredIds.length === 0) {
    return sortHobbiesByRecency(available);
  }

  const byId = new Map(available.map((app) => [app.id, app]));
  const ordered: HobbyApp[] = [];
  const seen = new Set<string>();

  for (const id of featuredIds) {
    const app = byId.get(id);
    if (app && !seen.has(id)) {
      ordered.push(app);
      seen.add(id);
    }
  }

  for (const app of sortHobbiesByRecency(available)) {
    if (!seen.has(app.id)) {
      ordered.push(app);
    }
  }

  return ordered;
}

function ColorBlock({
  app,
  featured = false,
}: {
  app: HobbyApp;
  featured?: boolean;
}) {
  const mediaSrc = getHobbyMediaSrc(app);
  const tone: HobbyBlockTone = app.blockTone ?? 'cream';
  const inverse = tone === 'navy';

  return (
    <article
      className={`figma-block figma-block--${tone}${featured ? ' figma-block--featured' : ''}${inverse ? ' figma-block--inverse' : ''}`}
    >
      <div className="figma-block__copy">
        <p className="figma-eyebrow">{app.category}</p>
        <h2 className="figma-block__title">{app.name}</h2>
        <p className="figma-block__subhead">{app.subtitle}</p>
        <p className="figma-block__body">{app.description}</p>
        <div className="figma-block__actions">
          {app.path ? (
            <>
              <Link
                to={app.startPath ?? app.path}
                className={`figma-pill ${inverse ? 'figma-pill--secondary' : 'figma-pill--primary'}`}
              >
                시작하기
              </Link>
              {app.startPath && app.startPath !== app.path ? (
                <Link
                  to={app.path}
                  className={`figma-link${inverse ? ' figma-link--inverse' : ''}`}
                >
                  소개 보기
                </Link>
              ) : null}
            </>
          ) : (
            <span className="figma-pill figma-pill--disabled">준비중</span>
          )}
        </div>
      </div>
      <div className="figma-block__media" aria-hidden="true">
        {mediaSrc ? (
          <img src={mediaSrc} alt="" width={320} height={320} draggable={false} />
        ) : (
          <span className="figma-block__fallback">{app.name.slice(0, 1)}</span>
        )}
      </div>
    </article>
  );
}
