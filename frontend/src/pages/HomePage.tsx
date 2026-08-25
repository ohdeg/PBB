import { Link } from 'react-router-dom';
import { HobbyProductShot } from '../components/HobbyProductShot';
import {
  getNavHobbies,
  type HobbyApp,
  type HobbyBlockTone,
} from '../data/hobbies';
import { useAuthStore } from '../stores/authStore';

export function HomePage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const isDev = useAuthStore((state) => state.userClass === 'dev');
  const gridApps = getNavHobbies(isDev);

  return (
    <main className="figma-home">
      <section className="figma-hero figma-hero--compact" aria-label="PBB 소개">
        <p className="figma-eyebrow">Play beom&apos;s BAG</p>
        <h1 className="figma-hero__title">무엇을 시작할까요?</h1>
        <p className="figma-hero__lead">
          가게 관리부터 악보, 옷장까지.
        </p>
        <p>
          원하는 앱을 고르면 내 일상과 바로 연결됩니다.
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

function ColorBlock({
  app,
  featured = false,
}: {
  app: HobbyApp;
  featured?: boolean;
}) {
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
        <HobbyProductShot
          light={app.productImage ?? app.iconSrc}
          dark={app.productImageDark}
          fallback={app.name.slice(0, 1)}
        />
      </div>
    </article>
  );
}
