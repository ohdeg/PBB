import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { vevenoApi } from '../api/vevenoApi';
import { VevenoBadge } from '../components/veveno/VevenoBadge';
import { VevenoButton } from '../components/veveno/VevenoButton';
import { VevenoCard } from '../components/veveno/VevenoCard';
import {
  VevenoSplashScreen,
  useVevenoSplash,
} from '../components/veveno/VevenoSplashScreen';
import { VevenoInput } from '../components/veveno/VevenoInput';
import { VevenoStoreRow } from '../components/veveno/VevenoStoreRow';
import { VevenoVisibilityBadge } from '../components/veveno/VevenoVisibilityBadge';
import { useAuthStore } from '../stores/authStore';
import type { VevenoStore } from '../types/veveno';
import { getErrorMessage } from '../utils/error';

type HubPanel = 'none' | 'find' | 'create';

export function VevenoPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { showSplash, handleSplashFinish } = useVevenoSplash();
  const [myStores, setMyStores] = useState<VevenoStore[]>([]);
  const [subscriptions, setSubscriptions] = useState<VevenoStore[]>([]);
  const [joinQuery, setJoinQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VevenoStore[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [joiningStoreId, setJoiningStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [panel, setPanel] = useState<HubPanel>('none');
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Veveno';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const [mine, subs] = await Promise.all([
          vevenoApi.myStores(),
          vevenoApi.subscriptions(),
        ]);
        if (!cancelled) {
          setMyStores(mine.data);
          setSubscriptions(subs.data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(err, '가게 목록을 불러오지 못했습니다.'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (panel === 'none') {
      return;
    }
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [panel]);

  if (!accessToken) {
    if (useAuthStore.getState().suppressLoginRedirect) {
      return null;
    }
    return <Navigate to="/login" replace state={{ from: '/hobbies/veveno/hub' }} />;
  }

  const openPanel = (next: HubPanel) => {
    setPanel((prev) => (prev === next ? 'none' : next));
  };

  const handleSearch = async () => {
    const q = joinQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchMessage('가게 이름 또는 코드를 입력해 주세요.');
      return;
    }
    setSearching(true);
    setSearchMessage(null);
    setError('');
    try {
      const { data } = await vevenoApi.searchStores(q);
      setSearchResults(data);
      setSearchMessage(data.length === 0 ? '검색 결과가 없습니다.' : null);
    } catch (err: unknown) {
      setSearchResults([]);
      setSearchMessage(getErrorMessage(err, '가게 검색에 실패했습니다.'));
    } finally {
      setSearching(false);
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleSearch();
    }
  };

  const handleCreateStore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = storeName.trim();
    if (!name) {
      setError('가게 이름을 입력해 주세요.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const { data } = await vevenoApi.createStore({ name, isPublic });
      void navigate(`/hobbies/veveno/stores/${data.id}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '가게 등록에 실패했습니다.'));
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (store: VevenoStore) => {
    if (store.owned || store.subscribed) {
      return;
    }
    setJoiningStoreId(store.id);
    setError('');
    setFeedback('');
    try {
      await vevenoApi.requestJoin(store.id);
      setFeedback('가입 신청이 접수되었습니다. 업주 승인을 기다려 주세요.');
      setJoinQuery('');
      setSearchResults([]);
      setSearchMessage(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '가입 신청에 실패했습니다.'));
    } finally {
      setJoiningStoreId(null);
    }
  };

  const hasOwned = myStores.length > 0;
  const hasSubs = subscriptions.length > 0;
  const bothEmpty = !hasOwned && !hasSubs;

  if (loading) {
    return (
      <main className="veveno-shell">
        <div className="veveno-shell__inner veveno-shell__loading">불러오는 중…</div>
      </main>
    );
  }

  return (
    <>
      {showSplash ? <VevenoSplashScreen onFinish={handleSplashFinish} /> : null}
      <main className="veveno-shell">
      <div className="veveno-shell__inner veveno-shell__inner--hub">
        <div className="veveno-shell__top">
          <Link to="/" className="veveno-shell__back">
            ← 메인
          </Link>
        </div>

        <header className="veveno-shell__hero veveno-shell__hero--hub">
          <p className="veveno-shell__hero-brand">Veveno</p>
          <div className="veveno-hero-cta">
            <VevenoButton onClick={() => openPanel('create')}>가게 등록</VevenoButton>
            <VevenoButton variant="secondary" onClick={() => openPanel('find')}>
              가게 찾기
            </VevenoButton>
          </div>
        </header>

        {error ? (
          <p className="veveno-notice veveno-notice--error" role="alert">
            {error}
          </p>
        ) : null}
        {feedback ? (
          <p className="veveno-notice veveno-notice--success" role="status">
            {feedback}
          </p>
        ) : null}

        {bothEmpty ? (
          <p className="veveno-notice veveno-notice--info" role="status">
            아직 등록·구독 중인 가게가 없습니다. 위에서 만들거나 찾아보세요.
          </p>
        ) : null}

        <div className="veveno-hub-grid">
          <section className="veveno-section">
            <VevenoCard title="내 가게">
              {hasOwned ? (
                <div className="veveno-stack">
                  {myStores.map((store) => (
                    <VevenoStoreRow
                      key={store.id}
                      name={store.name}
                      onDuty={store.onDuty}
                      onClick={() => {
                        void navigate(`/hobbies/veveno/stores/${store.id}`);
                      }}
                      badge={
                        <>
                          <VevenoVisibilityBadge isPublic={store.isPublic} />
                          {store.onDuty ? (
                            <VevenoBadge variant="success">근무중</VevenoBadge>
                          ) : null}
                        </>
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="veveno-empty">등록된 가게가 없습니다. 위에서 만들어 보세요.</p>
              )}
            </VevenoCard>
          </section>

          <section className="veveno-section">
            <VevenoCard title="근무 가게">
              {hasSubs ? (
                <div className="veveno-stack">
                  {subscriptions.map((store) => (
                    <VevenoStoreRow
                      key={store.id}
                      name={store.name}
                      onDuty={store.onDuty}
                      onClick={() => {
                        void navigate(`/hobbies/veveno/stores/${store.id}`);
                      }}
                      badge={
                        <>
                          <VevenoVisibilityBadge isPublic={store.isPublic} />
                          {store.onDuty ? (
                            <VevenoBadge variant="success">근무중</VevenoBadge>
                          ) : null}
                        </>
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="veveno-empty">근무 중인 가게가 없습니다. 가게 찾기로 가입해 보세요.</p>
              )}
            </VevenoCard>
          </section>
        </div>

        {panel !== 'none' ? (
          <section className="veveno-section veveno-hub-panel" ref={panelRef}>
            <div className="veveno-hub-panel__bar">
              <p className="veveno-section__label">
                {panel === 'find' ? '가게 찾기' : '가게 등록'}
              </p>
              <VevenoButton size="sm" variant="ghost" onClick={() => setPanel('none')}>
                닫기
              </VevenoButton>
            </div>

            {panel === 'find' ? (
              <VevenoCard title="가게 검색 · 가입">
                <p className="veveno-card-lead">
                  가게 이름 또는 가게 코드(8자)로 찾아 가입을 신청합니다. 동명이 있을 때는
                  코드를 쓰면 정확히 찾을 수 있습니다.
                </p>
                <div className="veveno-search-row">
                  <VevenoInput
                    value={joinQuery}
                    onChange={(e) => setJoinQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="가게 이름 또는 코드"
                    autoComplete="off"
                  />
                  <VevenoButton onClick={() => void handleSearch()} loading={searching}>
                    검색
                  </VevenoButton>
                </div>

                {searchMessage ? (
                  <p className="veveno-card-lead veveno-card-lead--mt">{searchMessage}</p>
                ) : null}

                {searchResults.length > 0 ? (
                  <div className="veveno-stack veveno-stack--mt">
                    {searchResults.map((store) => {
                      const canOpen = store.owned || store.subscribed || store.isPublic;
                      return (
                        <div key={store.id} className="veveno-search-result">
                          <div>
                            <div className="veveno-store-row__title-row">
                              <p className="veveno-store-row__name">{store.name}</p>
                              <VevenoVisibilityBadge isPublic={store.isPublic} />
                              {store.owned ? (
                                <VevenoBadge variant="info">내 가게</VevenoBadge>
                              ) : null}
                              {store.subscribed ? (
                                <VevenoBadge variant="success">구독 중</VevenoBadge>
                              ) : null}
                              {store.onDuty ? (
                                <VevenoBadge variant="success">근무중</VevenoBadge>
                              ) : null}
                            </div>
                            {!canOpen ? (
                              <p className="veveno-store-row__sub">
                                비공개 가게입니다. 가입 승인 후 열람할 수 있습니다.
                              </p>
                            ) : null}
                          </div>
                          <div className="veveno-search-result__actions">
                            <VevenoButton
                              size="sm"
                              variant="secondary"
                              disabled={!canOpen}
                              onClick={() => {
                                void navigate(`/hobbies/veveno/stores/${store.id}`);
                              }}
                            >
                              열기
                            </VevenoButton>
                            {!store.owned && !store.subscribed ? (
                              <VevenoButton
                                size="sm"
                                loading={joiningStoreId === store.id}
                                onClick={() => {
                                  void handleJoin(store);
                                }}
                              >
                                가입 신청
                              </VevenoButton>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </VevenoCard>
            ) : (
              <VevenoCard title="가게 등록">
                <p className="veveno-card-lead">
                  이름과 공개 여부만 정하면 새 노트를 시작할 수 있습니다.
                </p>
                <form className="veveno-form-stack" onSubmit={handleCreateStore}>
                  <VevenoInput
                    label="가게 이름"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="예: 5DEG Roasters"
                    maxLength={120}
                    disabled={creating}
                  />
                  <label className="veveno-check">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      disabled={creating}
                    />
                    공개 가게
                  </label>
                  <VevenoButton type="submit" loading={creating}>
                    가게 생성
                  </VevenoButton>
                </form>
              </VevenoCard>
            )}
          </section>
        ) : null}
      </div>
    </main>
    </>
  );
}
