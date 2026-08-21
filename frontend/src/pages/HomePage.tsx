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

  return (
    <main className="figma-home">
      <section className="figma-hero figma-hero--compact" aria-label="PBB 소개">
        <p className="figma-eyebrow">Play beom&apos;s BAG</p>
        <h1 className="figma-hero__title">열어 볼 앱</h1>
        <p className="figma-hero__lead">
          가게 노트, 악보, 체중, 옷장. 고르면 바로 이어집니다.
        </p>
        {!accessToken ? (
          <div className="figma-hero__actions">
            <Link to="/login" className="figma-pill figma-pill--primary">
              로그인
            </Link>
            <Link to="/signup" className="figma-pill figma-pill--secondary">
              가입하기
            </Link>
          </div>
        ) : null}
      </section>

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
      className={`figma-block figma-block--${tone}${featured ? ' figma-block--featured' : ''}`}
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
                열기
              </Link>
              {app.startPath && app.startPath !== app.path ? (
                <Link
                  to={app.path}
                  className={`figma-link${inverse ? ' figma-link--inverse' : ''}`}
                >
                  소개
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
