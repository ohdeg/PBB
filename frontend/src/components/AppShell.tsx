import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { ThemeToggle } from './ThemeToggle';
import { VevenoStockCheckHost } from './veveno/VevenoStockCheckHost';
import { getNavHobbies } from '../data/hobbies';
import { isVevenoToolsPopPath } from '../features/veveno/tools/compact';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { getErrorMessage } from '../utils/error';
import { isTemporiViewerPath } from '../features/tempori/utils/focusMode';
import { TemporiViewerFrame } from './TemporiViewerDock';
import { RecentAppTracker } from '../features/home/RecentAppTracker';

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
  const [accountOpen, setAccountOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const accountSummaryRef = useRef<HTMLElement>(null);

  const loginReturnPath = readReturnPath(location.state);
  const isDev = useAuthStore((state) => state.userClass === 'dev');
  const navHobbies = getNavHobbies(isDev);
  const isHome = location.pathname === '/';
  const isSranko = location.pathname.startsWith('/hobbies/sranko');
  const isToolsPop = isVevenoToolsPopPath(location.pathname);
  const isTemporiScore = isTemporiViewerPath(location.pathname);

  useEffect(() => {
    if (!useAuthStore.getState().suppressLoginRedirect) {
      return;
    }
    setSuppressLoginRedirect(false);
  }, [location.pathname, setSuppressLoginRedirect]);

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isHome || (!menuOpen && !accountOpen)) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (accountOpen) {
        setAccountOpen(false);
        accountSummaryRef.current?.focus();
      } else {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isHome, menuOpen, accountOpen]);

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
    <div
      className={`app-shell${isHome ? ' app-shell--home' : ''}${isHome || isSranko || isToolsPop || isTemporiScore ? ' app-shell--flush' : ''}${isToolsPop ? ' app-shell--tools-pop' : ''}${isTemporiScore ? ' app-shell--tempori-score' : ''}`}
    >
      {isToolsPop || isTemporiScore ? null : (
      <header className={`global-nav${isHome ? ' global-nav--home' : ''}`}>
        {isHome ? <a href="#home-main" className="home-nav__skip">본문으로 바로가기</a> : null}
        <div className="global-nav__inner">
          <Link to="/" className="global-nav__brand" aria-label="PBB 홈">
            <img src="/pbb-logo.png" alt="" className="global-nav__logo" />
          </Link>

          <nav className="global-nav__tabs" aria-label={isHome ? '홈 탐색' : '취미 탭'}>
            {isHome ? <a href="#apps" className="global-nav__link home-nav__apps" onClick={() => setMenuOpen(false)}>앱</a> : (
            <>
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
            </>
            )}
          </nav>

          <div className="global-nav__actions">
            <ThemeToggle />
            {accessToken ? (
              <>
                {nickname ? (
                  <button
                    type="button"
                    className="global-nav__link global-nav__link--button global-nav__account-wide"
                    onClick={() => {
                      void navigate('/profile');
                    }}
                  >
                    {nickname}
                  </button>
                ) : null}
                <details
                  className="global-nav__account"
                  open={accountOpen}
                  onToggle={(event) => {
                    setAccountOpen(event.currentTarget.open);
                  }}
                >
                  <summary ref={accountSummaryRef} className="global-nav__link global-nav__link--button">
                    {nickname ?? '계정'}
                  </summary>
                  <div className="global-nav__account-menu" role={isHome ? undefined : 'menu'}>
                    <button
                      type="button"
                      role={isHome ? undefined : 'menuitem'}
                      className="global-nav__account-item"
                      onClick={() => {
                        setAccountOpen(false);
                        void navigate('/profile');
                      }}
                    >
                      설정
                    </button>
                    <button
                      type="button"
                      role={isHome ? undefined : 'menuitem'}
                      className="global-nav__account-item"
                      disabled={loggingOut}
                      onClick={() => {
                        setAccountOpen(false);
                        void handleLogout();
                      }}
                    >
                      {loggingOut ? '…' : '로그아웃'}
                    </button>
                  </div>
                </details>
                <button
                  type="button"
                  className="figma-pill figma-pill--secondary figma-pill--nav global-nav__logout"
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
                  className={`figma-pill figma-pill--nav ${isHome ? 'figma-pill--primary' : 'figma-pill--secondary'}`}
                  state={loginReturnPath ? { from: loginReturnPath } : undefined}
                >
                  로그인
                </Link>
                <Link to="/signup" className={isHome ? 'home-nav__signup' : 'figma-pill figma-pill--primary figma-pill--nav'}>
                  가입
                </Link>
              </>
            )}

            <button
              ref={menuButtonRef}
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
          <nav id="global-nav-drawer" className="global-nav__drawer" aria-label="앱 목록">
            {navHobbies.map((app) => (
              <Link key={app.id} to={app.path ?? '/'} className="global-nav__drawer-link" onClick={() => setMenuOpen(false)}>
                <span translate="no">{app.name}</span>
                {isHome ? <span className="home-nav__app-description">{app.homeTitle ?? app.subtitle}</span> : null}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      )}

      <RecentAppTracker />
      {isTemporiScore ? <TemporiViewerFrame key={location.pathname}><Outlet /></TemporiViewerFrame> : <Outlet />}
      <VevenoStockCheckHost />
    </div>
  );
}
