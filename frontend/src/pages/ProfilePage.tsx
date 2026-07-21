import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { brewApi } from '../api/brewApi';
import { configApi } from '../api/configApi';
import { devApi } from '../api/devApi';
import { HOBBY_APPS } from '../data/hobbies';
import { useAuthStore } from '../stores/authStore';
import type { BrewStore } from '../types/brew';
import type { UserClass, UserResponse } from '../types/user';
import { getErrorMessage } from '../utils/error';

type WithdrawStep = 'closed' | 'veveno-warning' | 'password';

export function ProfilePage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const nickname = useAuthStore((state) => state.nickname);
  const email = useAuthStore((state) => state.email);
  const userClass = useAuthStore((state) => state.userClass);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const [targetQuery, setTargetQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResponse[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResponse | null>(null);
  const [targetClass, setTargetClass] = useState<UserClass>('dev');
  const [promoteError, setPromoteError] = useState('');
  const [promoteSuccess, setPromoteSuccess] = useState('');
  const [promoting, setPromoting] = useState(false);

  const [featuredList, setFeaturedList] = useState<string[]>([]);
  const [featuredAddValue, setFeaturedAddValue] = useState('');
  const [featuredDragIndex, setFeaturedDragIndex] = useState<number | null>(null);
  const [featuredSaving, setFeaturedSaving] = useState(false);
  const [featuredError, setFeaturedError] = useState('');
  const [featuredSuccess, setFeaturedSuccess] = useState('');

  const [withdrawStep, setWithdrawStep] = useState<WithdrawStep>('closed');
  const [ownedStores, setOwnedStores] = useState<BrewStore[]>([]);
  const [subscribedStores, setSubscribedStores] = useState<BrewStore[]>([]);
  const [withdrawPassword, setWithdrawPassword] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

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

  useEffect(() => {
    if (!accessToken || userClass !== 'dev') {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const { data } = await configApi.getFeaturedApps();
        if (!cancelled) {
          setFeaturedList(data.appIds.slice(0, 5));
        }
      } catch {
        if (!cancelled) {
          setFeaturedList([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, userClass]);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  const clearFeaturedStatus = () => {
    setFeaturedSuccess('');
    setFeaturedError('');
  };

  const handleAddFeatured = () => {
    const id = featuredAddValue;
    if (!id) {
      return;
    }
    setFeaturedList((prev) => {
      if (prev.includes(id)) {
        return prev;
      }
      const base = prev.length >= 5 ? prev.slice(0, 4) : prev;
      return [...base, id];
    });
    setFeaturedAddValue('');
    clearFeaturedStatus();
  };

  const handleRemoveFeatured = (id: string) => {
    setFeaturedList((prev) => prev.filter((item) => item !== id));
    clearFeaturedStatus();
  };

  const handleMoveFeatured = (index: number, direction: -1 | 1) => {
    setFeaturedList((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
    clearFeaturedStatus();
  };

  const handleFeaturedDragEnter = (index: number) => {
    setFeaturedList((prev) => {
      if (featuredDragIndex === null || featuredDragIndex === index) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(featuredDragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setFeaturedDragIndex(index);
  };

  const handleSaveFeaturedApp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeaturedError('');
    setFeaturedSuccess('');

    const appIds = featuredList.filter(
      (id, i, arr) => id.length > 0 && arr.indexOf(id) === i,
    );

    if (appIds.length === 0) {
      setFeaturedError('추천 앱을 하나 이상 추가해 주세요.');
      return;
    }
    setFeaturedSaving(true);
    try {
      const { data } = await devApi.updateFeaturedApp({ appIds });
      setFeaturedList(data.appIds.slice(0, 5));
      const names = data.appIds.map(
        (id) => HOBBY_APPS.find((item) => item.id === id)?.name ?? id,
      );
      setFeaturedSuccess(`메인 추천 앱 ${names.length}개를 설정했습니다: ${names.join(', ')}`);
    } catch (error: unknown) {
      setFeaturedError(getErrorMessage(error, '추천 앱 설정에 실패했습니다.'));
    } finally {
      setFeaturedSaving(false);
    }
  };

  const closeWithdraw = () => {
    if (withdrawLoading) {
      return;
    }
    setWithdrawStep('closed');
    setOwnedStores([]);
    setSubscribedStores([]);
    setWithdrawPassword('');
    setWithdrawError('');
  };

  const startWithdraw = async () => {
    setWithdrawError('');
    setWithdrawLoading(true);
    try {
      const [ownedRes, subRes] = await Promise.all([
        brewApi.myStores(),
        brewApi.subscriptions(),
      ]);
      setOwnedStores(ownedRes.data);
      setSubscribedStores(subRes.data);
      setWithdrawPassword('');
      const hasVeveno =
        ownedRes.data.length > 0 || subRes.data.length > 0;
      setWithdrawStep(hasVeveno ? 'veveno-warning' : 'password');
    } catch (error: unknown) {
      setWithdrawError(
        getErrorMessage(error, '탈퇴 준비 중 오류가 발생했습니다.'),
      );
      setOwnedStores([]);
      setSubscribedStores([]);
      setWithdrawStep('password');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleDeleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!withdrawPassword.trim()) {
      setWithdrawError('비밀번호를 입력해 주세요.');
      return;
    }
    setWithdrawLoading(true);
    setWithdrawError('');
    try {
      await authApi.deleteAccount({ password: withdrawPassword });
      clearAuth();
      navigate('/login', { replace: true });
    } catch (error: unknown) {
      setWithdrawError(getErrorMessage(error, '회원 탈퇴에 실패했습니다.'));
    } finally {
      setWithdrawLoading(false);
    }
  };

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
      await devApi.updateUserClass({
        query: selectedUser.email,
        userClass: targetClass,
      });
      setPromoteSuccess(
        `${selectedUser.nickname} 등급을 ${targetClass}(으)로 변경했습니다.`,
      );
      setSelectedUser(null);
      setTargetQuery('');
      setSearchResults([]);
    } catch (error: unknown) {
      setPromoteError(getErrorMessage(error, '등급 변경에 실패했습니다.'));
    } finally {
      setPromoting(false);
    }
  };

  const displayClass = userClass ?? 'free';
  const avatarInitial = (nickname ?? email ?? '?').trim().slice(0, 1).toUpperCase();

  return (
    <main className="profile-main">
      <header className="profile-header">
        <div className="profile-avatar" aria-hidden="true">
          {avatarInitial}
        </div>
        <h1>{nickname ?? '내 프로필'}</h1>
        <span className={`profile-class-badge profile-class-badge--${displayClass}`}>
          {displayClass}
        </span>
      </header>

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
          <dd>
            <span className={`profile-class-badge profile-class-badge--${displayClass}`}>
              {displayClass}
            </span>
          </dd>
        </div>
      </dl>

      <div className="btn-row profile-actions">
        <Link to="/profile/change-password" className="btn-secondary link-as-btn">
          비밀번호 변경
        </Link>
        <Link to="/" className="btn-secondary link-as-btn">
          메인
        </Link>
        <button
          type="button"
          className="btn-secondary profile-withdraw-btn"
          onClick={() => {
            void startWithdraw();
          }}
          disabled={withdrawLoading && withdrawStep === 'closed'}
        >
          회원 탈퇴
        </button>
      </div>

      {userClass === 'dev' ? (
        <section className="profile-dev-panel" aria-label="개발자 설정">
          <div className="profile-dev-card">
            <h2>메인 추천 앱</h2>
            <p className="profile-lead">
              메인 상단에 노출되는 추천 앱을 추가하세요. 최대 5개이며 여러 개면
              자동으로 로테이션됩니다. 드래그(또는 ↑↓)로 순서를 바꾸고 ×로
              삭제합니다. 5개가 찬 상태에서 추가하면 마지막 항목이 밀려납니다.
            </p>
            <form
              className="auth-form profile-change-password-form"
              onSubmit={(e) => void handleSaveFeaturedApp(e)}
              noValidate
            >
              <div className="featured-add-row">
                <select
                  aria-label="추가할 앱"
                  value={featuredAddValue}
                  onChange={(event) => setFeaturedAddValue(event.target.value)}
                  disabled={featuredSaving}
                >
                  <option value="">추가할 앱 선택</option>
                  {HOBBY_APPS.filter(
                    (app) => !featuredList.includes(app.id),
                  ).map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name} · {app.subtitle}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary featured-add-btn"
                  onClick={handleAddFeatured}
                  disabled={featuredSaving || !featuredAddValue}
                >
                  추가
                </button>
              </div>

              {featuredList.length > 0 ? (
                <ul className="featured-order-list">
                  {featuredList.map((id, index) => {
                    const app = HOBBY_APPS.find((item) => item.id === id);
                    return (
                      <li
                        key={id}
                        className={
                          featuredDragIndex === index
                            ? 'featured-order-item featured-order-item--dragging'
                            : 'featured-order-item'
                        }
                        draggable={!featuredSaving}
                        onDragStart={() => setFeaturedDragIndex(index)}
                        onDragEnter={() => handleFeaturedDragEnter(index)}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnd={() => setFeaturedDragIndex(null)}
                      >
                        <span className="featured-order-handle" aria-hidden="true">
                          ⠿
                        </span>
                        <span className="featured-order-index">{index + 1}</span>
                        <span className="featured-order-name">
                          {app ? app.name : id}
                          {app ? (
                            <small className="featured-order-sub">{app.subtitle}</small>
                          ) : null}
                        </span>
                        <span className="featured-order-actions">
                          <button
                            type="button"
                            className="featured-order-btn"
                            onClick={() => handleMoveFeatured(index, -1)}
                            disabled={featuredSaving || index === 0}
                            aria-label={`${app ? app.name : id} 위로`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="featured-order-btn"
                            onClick={() => handleMoveFeatured(index, 1)}
                            disabled={featuredSaving || index === featuredList.length - 1}
                            aria-label={`${app ? app.name : id} 아래로`}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="featured-order-btn featured-order-btn--remove"
                            onClick={() => handleRemoveFeatured(id)}
                            disabled={featuredSaving}
                            aria-label={`${app ? app.name : id} 삭제`}
                          >
                            ×
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="profile-search-status">아직 추가한 추천 앱이 없습니다.</p>
              )}

              {featuredSuccess ? (
                <p className="form-success">{featuredSuccess}</p>
              ) : null}
              {featuredError ? (
                <p className="form-error" role="alert">
                  {featuredError}
                </p>
              ) : null}
              <button type="submit" className="btn-primary" disabled={featuredSaving}>
                {featuredSaving ? '저장 중…' : '추천 앱 저장'}
              </button>
            </form>
          </div>

          <div className="profile-dev-card">
          <h2>회원 등급 변경</h2>
          <p className="profile-lead">
            닉네임 또는 이메일로 검색한 뒤 목록에서 회원을 선택하세요.
          </p>
          <form
            className="auth-form profile-change-password-form"
            onSubmit={(e) => void handlePromote(e)}
            noValidate
          >
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
          </div>
        </section>
      ) : null}

      {withdrawStep !== 'closed' ? (
        <div className="profile-withdraw-overlay" role="presentation">
          <div
            className="profile-withdraw-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-title"
          >
            {withdrawStep === 'veveno-warning' ? (
              <>
                <h2 id="withdraw-title">Veveno 데이터가 있습니다</h2>
                <p className="profile-lead">
                  탈퇴와 함께 아래 Veveno 데이터가 <strong>영구 삭제</strong>
                  됩니다. 복구할 수 없습니다.
                </p>
                {ownedStores.length > 0 ? (
                  <>
                    <p className="profile-withdraw-section-label">소유 가게</p>
                    <p className="profile-lead profile-withdraw-hint">
                      가게와 메뉴·재고·근무·구독 데이터가 모두 삭제됩니다.
                    </p>
                    <ul className="profile-withdraw-store-list">
                      {ownedStores.map((store) => (
                        <li key={store.id}>{store.name}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {subscribedStores.length > 0 ? (
                  <>
                    <p className="profile-withdraw-section-label">구독 중 가게</p>
                    <p className="profile-lead profile-withdraw-hint">
                      구독·근무 일정이 해제되며, 해당 가게에서 더 이상 접근할 수
                      없습니다.
                    </p>
                    <ul className="profile-withdraw-store-list">
                      {subscribedStores.map((store) => (
                        <li key={store.id}>{store.name}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {withdrawError ? (
                  <p className="form-error" role="alert">
                    {withdrawError}
                  </p>
                ) : null}
                <div className="btn-row profile-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closeWithdraw}
                    disabled={withdrawLoading}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setWithdrawError('');
                      setWithdrawStep('password');
                    }}
                    disabled={withdrawLoading}
                  >
                    확인하고 계속
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={(e) => void handleDeleteAccount(e)}>
                <h2 id="withdraw-title">회원 탈퇴</h2>
                <p className="profile-lead">
                  탈퇴하면 계정과 관련 데이터가 삭제되며 복구할 수 없습니다.
                  {ownedStores.length > 0 || subscribedStores.length > 0
                    ? ' Veveno 소유·구독 데이터도 함께 삭제됩니다.'
                    : ''}{' '}
                  본인 확인을 위해 비밀번호를 입력해 주세요.
                </p>
                <div className="form-field">
                  <label htmlFor="withdraw-password">비밀번호</label>
                  <input
                    id="withdraw-password"
                    type="password"
                    autoComplete="current-password"
                    value={withdrawPassword}
                    onChange={(e) => setWithdrawPassword(e.target.value)}
                    disabled={withdrawLoading}
                    required
                  />
                </div>
                {withdrawError ? (
                  <p className="form-error" role="alert">
                    {withdrawError}
                  </p>
                ) : null}
                <div className="btn-row profile-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closeWithdraw}
                    disabled={withdrawLoading}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="btn-primary profile-withdraw-confirm"
                    disabled={withdrawLoading}
                  >
                    {withdrawLoading ? '처리 중…' : '탈퇴하기'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
