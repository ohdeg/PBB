import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import '../features/sranko/sranko.css';
import {
  SRANKO_CLOSET,
  SRANKO_COMMUNITY,
  SRANKO_LOOKS,
} from '../features/sranko/paths';
import { useAuthStore } from '../stores/authStore';

const AUTH_PREFIXES = [SRANKO_CLOSET, SRANKO_LOOKS] as const;

function requiresAuth(pathname: string): boolean {
  return AUTH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function SrankoLayout() {
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const suppressLoginRedirect = useAuthStore((s) => s.suppressLoginRedirect);

  if (
    requiresAuth(location.pathname)
    && !accessToken
    && !suppressLoginRedirect
  ) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return (
    <div className="sranko-app figma-home">
      <div className="sranko-shell">
        <nav className="sranko-nav" aria-label="슈란코">
          <NavLink
            to={SRANKO_CLOSET}
            className={({ isActive }) => (isActive ? 'is-active' : undefined)}
          >
            옷장
          </NavLink>
          <NavLink
            to={SRANKO_LOOKS}
            className={({ isActive }) => (isActive ? 'is-active' : undefined)}
          >
            내 룩
          </NavLink>
          <NavLink
            to={SRANKO_COMMUNITY}
            end={false}
            className={({ isActive }) => (isActive ? 'is-active' : undefined)}
          >
            커뮤니티
          </NavLink>
        </nav>
        <Outlet />
      </div>
    </div>
  );
}
