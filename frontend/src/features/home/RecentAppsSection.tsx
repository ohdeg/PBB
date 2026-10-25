import { Link } from 'react-router-dom';
import type { HobbyApp } from '../../data/hobbies';
import { useAuthStore } from '../../stores/authStore';
import { getVisibleRecentApps, readRecentAppIds } from './homeRecentStorage';

export function RecentAppsSection({ visibleApps }: { visibleApps: readonly HobbyApp[] }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.userId);
  // Read this render's identity; never display a previous account while an effect catches up.
  const recent = accessToken && userId
    ? getVisibleRecentApps(readRecentAppIds(userId), visibleApps) : [];
  if (!recent.length) return null;
  return (
    <section className="home-hub__recent" aria-labelledby="home-recent-title">
      <h2 id="home-recent-title" className="home-hub__section-title">최근 사용</h2>
      <div className="home-hub__shortcuts">
        {recent.map((app) => (
          <Link key={app.id} to={app.startPath ?? app.path!}
            className={`home-hub__shortcut home-hub__tone--${app.blockTone ?? 'cream'}`}
            aria-label={`${app.name} ${app.homeTitle ?? app.subtitle} 열기`}>
            <span className="home-hub__shortcut-icon" aria-hidden="true">{app.name.slice(0, 1)}</span>
            <span className="home-hub__shortcut-copy">
              <strong translate="no">{app.name}</strong>
              <span>{app.homeTitle ?? app.subtitle}</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </Link>
        ))}
      </div>
    </section>
  );
}
