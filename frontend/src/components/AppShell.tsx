import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { getNavHobbies } from '../data/hobbies';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { getErrorMessage } from '../utils/error';

function readReturnPath(state: unknown): string | undefined {
  if (
    typeof state === 'object'
    && state !== null
    && 'from' in state
    && typeof (state as { from: unknown }).from === 'string'
  ) {
    const from = (state as { from: string }).from;
    if (from.startsWith('/') && !from.startsWith('//')) {
      return from;
    }
  }
  return undefined;
}

function logoutLandingPath(pathname: string): string {
  if (pathname.startsWith('/hobbies/veveno')) {
    return '/hobbies/veveno';
  }
  if (pathname.startsWith('/hobbies/dieta')) {
    return '/hobbies/dieta';
  }
  if (pathname.startsWith('/hobbies/sranko')) {
    return '/hobbies/sranko';
  }
  return '/';
}

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = useAuthStore((state) => state.accessToken);
  const nickname = useAuthStore((state) => state.nickname);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setSuppressLoginRedirect = useAuthStore(
    (state) => state.setSuppressLoginRedirect,
  );
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const loginReturnPath = readReturnPath(location.state);
  const navHobbies = getNavHobbies();
  const isHome = location.pathname === '/';

  useEffect(() => {
    if (!useAuthStore.getState().suppressLoginRedirect) {
      return;
    }
    setSuppressLoginRedirect(false);
  }, [location.pathname, setSuppressLoginRedirect]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setLoggingOut(true);
    const from = `${location.pathname}${location.search}`;
    const landing = logoutLandingPath(location.pathname);
    try {
      await authApi.logout();
      toast('로그아웃했어요.', 'success');
    } catch (error: unknown) {
      toast(getErrorMessage(error, '로그아웃 요청에 실패했습니다.'), 'error');
    } finally {
      setSuppressLoginRedirect(true);
      void navigate(landing, {
        replace: true,
        state: from !== landing ? { from } : undefined,
      });
      clearAuth();
      setLoggingOut(false);
    }
  };

  return (
    <div className={`app-shell${isHome ? ' app-shell--flush' : ''}`}>
      <header className="global-nav">
        <div className="global-nav__inner">
          <Link to="/" className="global-nav__brand" aria-label="PBB 홈">
            PBB
          </Link>

          <nav className="global-nav__tabs" aria-label="취미 탭">
            {navHobbies.map((app) => (
              <NavLink
                key={app.id}
                to={app.path ?? '/'}
                className={({ isActive }) =>
                  isActive ? 'global-nav__link is-active' : 'global-nav__link'
                }
              >
                {app.name}
              </NavLink>
            ))}
          </nav>

          <div className="global-nav__actions">
            {accessToken ? (
              <>
                {nickname ? (
                  <button
                    type="button"
                    className="global-nav__link global-nav__link--button"
                    onClick={() => {
                      void navigate('/profile');
                    }}
                  >
                    {nickname}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="figma-pill figma-pill--secondary figma-pill--nav"
                  onClick={() => {
                    void handleLogout();
                  }}
                  disabled={loggingOut}
                >
                  {loggingOut ? '…' : '로그아웃'}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="figma-pill figma-pill--secondary figma-pill--nav"
                  state={loginReturnPath ? { from: loginReturnPath } : undefined}
                >
                  로그인
                </Link>
                <Link to="/signup" className="figma-pill figma-pill--primary figma-pill--nav">
                  가입
                </Link>
              </>
            )}

            <button
              type="button"
              className="global-nav__menu-btn"
              aria-expanded={menuOpen}
              aria-controls="global-nav-drawer"
              aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span />
              <span />
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div id="global-nav-drawer" className="global-nav__drawer">
            {navHobbies.map((app) => (
              <Link key={app.id} to={app.path ?? '/'} className="global-nav__drawer-link">
                {app.name}
              </Link>
            ))}
          </div>
        ) : null}
      </header>

      <Outlet />
    </div>
  );
}
