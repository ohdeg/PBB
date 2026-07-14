import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { useAuthStore } from '../stores/authStore';
import { getErrorMessage } from '../utils/error';

export function AppShell() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const nickname = useAuthStore((state) => state.nickname);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLogoutError('');
    setLoggingOut(true);
    try {
      await authApi.logout();
    } catch (error: unknown) {
      setLogoutError(getErrorMessage(error, '로그아웃 요청에 실패했습니다.'));
    } finally {
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
              <Link to="/login">로그인</Link>
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
