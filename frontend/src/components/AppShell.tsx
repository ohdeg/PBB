import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { useAuthStore } from '../stores/authStore';
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
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const loginReturnPath = readReturnPath(location.state);

  useEffect(() => {
    // pathname이 바뀐 뒤에만 플래그를 해제 (같은 틱에 풀리면 가드가 다시 /login으로 보냄)
    if (!useAuthStore.getState().suppressLoginRedirect) {
      return;
    }
    setSuppressLoginRedirect(false);
  }, [location.pathname, setSuppressLoginRedirect]);

  const handleLogout = async () => {
    setLogoutError('');
    setLoggingOut(true);
    const from = `${location.pathname}${location.search}`;
    const landing = logoutLandingPath(location.pathname);
    try {
      await authApi.logout();
    } catch (error: unknown) {
      setLogoutError(getErrorMessage(error, '로그아웃 요청에 실패했습니다.'));
    } finally {
      // 가드가 /login으로 보내기 전에 플래그로 막은 뒤 랜딩으로 이동
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
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand-block brand-link">
          <span className="brand">PBB</span>
          <span className="brand-full">Play beom&apos;s BAG</span>
        </Link>

        <nav className="home-nav" aria-label="계정">
          {accessToken ? (
            <>
              {nickname ? (
                <button
                  type="button"
                  className="nav-nickname"
                  onClick={() => {
                    void navigate('/profile');
                  }}
                >
                  {nickname}
                </button>
              ) : null}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  void handleLogout();
                }}
                disabled={loggingOut}
              >
                {loggingOut ? '로그아웃 중…' : '로그아웃'}
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                state={loginReturnPath ? { from: loginReturnPath } : undefined}
              >
                로그인
              </Link>
              <Link to="/signup" className="btn-primary link-as-btn">
                회원가입
              </Link>
            </>
          )}
        </nav>
      </header>

      {logoutError ? (
        <p className="form-error shell-error" role="alert">
          {logoutError}
        </p>
      ) : null}

      <Outlet />
    </div>
  );
}
