import { NavLink, Outlet } from 'react-router-dom';

const NAV = [
  { to: '/hobbies/dieta/home', label: '홈', ico: '◈' },
  { to: '/hobbies/dieta/meals', label: '섭취', ico: '◎' },
  { to: '/hobbies/dieta/activity', label: '활동', ico: '△' },
  { to: '/hobbies/dieta/settings', label: '설정', ico: '◍' },
] as const;

export function DietaLayout() {
  return (
    <div className="dieta-app">
      <div className="dieta-shell">
        <Outlet />
      </div>
      <nav className="dieta-nav" aria-label="Dieta">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? 'is-active' : undefined)}
          >
            <span className="dieta-nav__ico" aria-hidden>
              {item.ico}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
