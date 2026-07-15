import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { devApi } from '../api/devApi';
import { useAuthStore } from '../stores/authStore';
import type { UserClass, UserResponse } from '../types/user';
import { getErrorMessage } from '../utils/error';

export function ProfilePage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const nickname = useAuthStore((state) => state.nickname);
  const email = useAuthStore((state) => state.email);
  const userClass = useAuthStore((state) => state.userClass);

  const [targetQuery, setTargetQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResponse[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResponse | null>(null);
  const [targetClass, setTargetClass] = useState<UserClass>('dev');
  const [promoteError, setPromoteError] = useState('');
  const [promoteSuccess, setPromoteSuccess] = useState('');
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    if (!accessToken || userClass !== 'dev') {
      return;
    }

    const query = targetQuery.trim();
    if (query.length < 1) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    if (selectedUser && (selectedUser.email === query || selectedUser.nickname === query)) {
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { data } = await devApi.searchUsers(query);
          if (!cancelled) {
            setSearchResults(data);
          }
        } catch {
          if (!cancelled) {
            setSearchResults([]);
          }
        } finally {
          if (!cancelled) {
            setSearching(false);
          }
        }
      })();
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [accessToken, targetQuery, userClass, selectedUser]);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  const handleSelectUser = (user: UserResponse) => {
    setSelectedUser(user);
    setTargetQuery(user.email);
    setSearchResults([]);
    setPromoteError('');
    setPromoteSuccess('');
  };

  const handlePromote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPromoteError('');
    setPromoteSuccess('');

    if (!selectedUser) {
      setPromoteError('목록에서 회원을 선택해 주세요.');
      return;
    }

    setPromoting(true);
    try {
      const { data } = await devApi.updateUserClass({
        query: selectedUser.email,
        userClass: targetClass,
      });
      setPromoteSuccess(
        `${data.nickname} (${data.email}) → ${data.userClass} 로 변경되었습니다. 대상은 다시 로그인해야 JWT가 갱신됩니다.`,
      );
      setSelectedUser({ ...data });
      setTargetQuery(data.email);
      setSearchResults([]);
    } catch (error: unknown) {
      setPromoteError(getErrorMessage(error, '등급 변경에 실패했습니다.'));
    } finally {
      setPromoting(false);
    }
  };

  return (
    <main className="profile-main">
      <h1>내 프로필</h1>
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
        <div>
          <dt>등급</dt>
          <dd>{userClass ?? 'free'}</dd>
        </div>
      </dl>

      <div className="btn-row profile-actions">
        <Link to="/profile/change-password" className="btn-secondary link-as-btn">
          비밀번호 변경
        </Link>
        <Link to="/" className="btn-secondary link-as-btn">
          메인
        </Link>
      </div>

      {userClass === 'dev' ? (
        <section className="profile-dev-panel" aria-label="회원 등급 관리">
          <h2>회원 등급 변경</h2>
          <p className="profile-lead">
            닉네임 또는 이메일로 검색한 뒤 목록에서 회원을 선택하세요.
          </p>
          <form className="auth-form profile-change-password-form" onSubmit={handlePromote} noValidate>
            <div className="form-field">
              <label htmlFor="promote-query">닉네임 또는 이메일</label>
              <input
                id="promote-query"
                type="text"
                value={targetQuery}
                onChange={(event) => {
                  setTargetQuery(event.target.value);
                  setSelectedUser(null);
                  setPromoteSuccess('');
                }}
                placeholder="닉네임 / 이메일 검색"
                autoComplete="off"
                disabled={promoting}
              />
            </div>

            {searching ? <p className="profile-search-status">검색 중…</p> : null}

            {!searching && targetQuery.trim().length > 0 && !selectedUser ? (
              searchResults.length > 0 ? (
                <ul className="profile-user-list" role="listbox" aria-label="검색 결과">
                  {searchResults.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        className="profile-user-list-item"
                        onClick={() => handleSelectUser(user)}
                      >
                        <span className="profile-user-list-name">{user.nickname}</span>
                        <span className="profile-user-list-email">{user.email}</span>
                        <span className="profile-user-list-class">{user.userClass}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="profile-search-status">검색 결과가 없습니다.</p>
              )
            ) : null}

            {selectedUser ? (
              <div className="profile-selected-user">
                <p>
                  선택: <strong>{selectedUser.nickname}</strong> ({selectedUser.email}) ·{' '}
                  {selectedUser.userClass}
                </p>
              </div>
            ) : null}

            <div className="form-field">
              <label htmlFor="promote-class">등급</label>
              <select
                id="promote-class"
                value={targetClass}
                onChange={(event) => setTargetClass(event.target.value as UserClass)}
                disabled={promoting}
              >
                <option value="dev">dev</option>
                <option value="free">free</option>
              </select>
            </div>
            {promoteSuccess ? <p className="form-success">{promoteSuccess}</p> : null}
            {promoteError ? (
              <p className="form-error" role="alert">
                {promoteError}
              </p>
            ) : null}
            <button
              type="submit"
              className="btn-primary"
              disabled={promoting || !selectedUser}
            >
              {promoting ? '변경 중…' : '등급 변경'}
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
