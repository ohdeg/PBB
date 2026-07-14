import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { useAuthStore } from '../stores/authStore';
import { getErrorMessage } from '../utils/error';

export function ProfilePage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const nickname = useAuthStore((state) => state.nickname);
  const email = useAuthStore((state) => state.email);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

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
      void navigate('/');
    }
  };

  return (
    <main className="profile-main">
      <div className="profile-toolbar">
        <h1>내 프로필</h1>
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
      </div>
      <p className="profile-lead">계정 기본 정보를 확인할 수 있습니다.</p>

      <dl className="profile-info">
        <div>
          <dt>닉네임</dt>
          <dd>{nickname ?? '-'}</dd>
        </div>
        <div>
          <dt>이메일</dt>
          <dd>{email ?? '-'}</dd>
        </div>
      </dl>

      {logoutError ? (
        <p className="form-error" role="alert">
          {logoutError}
        </p>
      ) : null}

      <div className="btn-row profile-actions">
        <Link to="/" className="btn-secondary link-as-btn">
          메인
        </Link>
        <Link to="/hobbies/analyze-baseball" className="btn-primary link-as-btn">
          Analyze Baseball 열기
        </Link>
      </div>
    </main>
  );
}
