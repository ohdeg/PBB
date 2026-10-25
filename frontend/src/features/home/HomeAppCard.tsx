import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { HobbyApp } from '../../data/hobbies';
import { useThemeStore } from '../../stores/themeStore';

function HomeAppImage({ app }: { app: HobbyApp }) {
  const theme = useThemeStore((state) => state.theme);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = (theme === 'dark' ? app.productImageDark ?? app.productImage : app.productImage ?? app.productImageDark)
    ?? app.iconSrc;
  return (
    <div className="home-hub__media" aria-hidden="true">
      {src && src !== failedSrc ? (
        <img src={src} alt="" width={320} height={320} loading="lazy" decoding="async"
          draggable={false} onError={() => setFailedSrc(src)} />
      ) : <span className="home-hub__initial">{app.name.slice(0, 1)}</span>}
    </div>
  );
}

export function HomeAppCard({ app }: { app: HobbyApp }) {
  return (
    <article className={`home-hub__card home-hub__tone--${app.blockTone ?? 'cream'}`}>
      <HomeAppImage app={app} />
      <div className="home-hub__copy">
        <h3>{app.homeTitle ?? app.subtitle}</h3>
        <p className="home-hub__brand" translate="no">{app.name}</p>
        <p className="home-hub__description">{app.homeDescription ?? app.description}</p>
      </div>
      <div className="home-hub__actions">
        {app.path ? <>
          <Link to={app.startPath ?? app.path} className="home-hub__open" aria-label={`${app.name} 열기`}>열기</Link>
          {app.startPath && app.startPath !== app.path ? (
            <Link to={app.path} className="home-hub__about" aria-label={`${app.name} 소개`}>소개</Link>
          ) : null}
        </> : <span className="home-hub__unavailable">준비 중</span>}
      </div>
    </article>
  );
}
