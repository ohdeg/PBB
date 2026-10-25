import { getNavHobbies } from '../data/hobbies';
import { useAuthStore } from '../stores/authStore';
import { HomeAppCard } from '../features/home/HomeAppCard';
import { RecentAppsSection } from '../features/home/RecentAppsSection';
import '../features/home/home.css';

export function HomePage() {
  const isDev = useAuthStore((state) => state.userClass === 'dev');
  const apps = getNavHobbies(isDev);

  return (
    <main id="home-main" className="home-hub" tabIndex={-1}>
      <section className="home-hub__intro" aria-labelledby="home-title">
        <h1 id="home-title">일상에 필요한 도구, 한곳에.</h1>
        <p>하고 싶은 일을 고르고 바로 시작하세요.</p>
      </section>
      <RecentAppsSection visibleApps={apps} />
      <section id="apps" className="home-hub__apps" aria-labelledby="home-apps-title" tabIndex={-1}>
        <div className="home-hub__section-heading">
          <h2 id="home-apps-title" className="home-hub__section-title">전체 앱</h2>
          <span className="home-hub__count">{apps.length}개</span>
        </div>
        {apps.length ? (
          <div className="home-hub__grid">
            {apps.map((app) => <HomeAppCard key={app.id} app={app} />)}
          </div>
        ) : <p className="home-hub__empty">사용 가능한 앱이 없습니다.</p>}
      </section>
      <footer className="home-hub__footer">
        <span translate="no">PBB</span>
        <p>일상을 위한 작은 도구들</p>
      </footer>
    </main>
  );
}
