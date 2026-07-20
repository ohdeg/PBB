import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { brewApi } from '../api/brewApi';
import { BrewBadge } from '../components/brew/BrewBadge';
import { BrewButton } from '../components/brew/BrewButton';
import { BrewCard } from '../components/brew/BrewCard';
import {
  VevenoSplashScreen,
  useVevenoSplash,
} from '../components/brew/VevenoSplashScreen';
import { BrewInput } from '../components/brew/BrewInput';
import { BrewStoreRow } from '../components/brew/BrewStoreRow';
import { BrewVisibilityBadge } from '../components/brew/BrewVisibilityBadge';
import { useAuthStore } from '../stores/authStore';
import type { BrewStore } from '../types/brew';
import { getErrorMessage } from '../utils/error';

type HubPanel = 'none' | 'find' | 'create';

export function BrewNotePage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { showSplash, handleSplashFinish } = useVevenoSplash();
  const [myStores, setMyStores] = useState<BrewStore[]>([]);
  const [subscriptions, setSubscriptions] = useState<BrewStore[]>([]);
  const [joinQuery, setJoinQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BrewStore[]>([]);
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
          brewApi.myStores(),
          brewApi.subscriptions(),
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
    return <Navigate to="/login" replace state={{ from: '/hobbies/brew-note' }} />;
  }

  const openPanel = (next: HubPanel) => {
    setPanel((prev) => (prev === next ? 'none' : next));
  };

  const handleSearch = async () => {
    const q = joinQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchMessage('가게 이름을 입력해 주세요.');
      return;
    }
    setSearching(true);
    setSearchMessage(null);
    setError('');
    try {
      const { data } = await brewApi.searchStores(q);
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
      const { data } = await brewApi.createStore({ name, isPublic });
      void navigate(`/hobbies/brew-note/stores/${data.id}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '가게 등록에 실패했습니다.'));
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (store: BrewStore) => {
    if (store.owned || store.subscribed) {
      return;
    }
    setJoiningStoreId(store.id);
    setError('');
    setFeedback('');
    try {
      await brewApi.requestJoin(store.id);
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
      <main className="brew-shell">
        <div className="brew-shell__inner brew-shell__loading">Brewing…</div>
      </main>
    );
  }

  return (
    <>
      {showSplash ? <VevenoSplashScreen onFinish={handleSplashFinish} /> : null}
      <main className="brew-shell">
      <div className="brew-shell__inner brew-shell__inner--hub">
        <div className="brew-shell__top">
          <Link to="/" className="brew-shell__back">
            ← 메인
          </Link>
        </div>

        <header className="brew-shell__hero brew-shell__hero--hub">
          <p className="brew-shell__hero-brand">Veveno</p>
          <p>메뉴·재고·근무를 한곳에 남겨 두는 가벼운 가게 노트</p>
          <div className="brew-hero-cta">
            <BrewButton onClick={() => openPanel('create')}>가게 등록</BrewButton>
            <BrewButton variant="secondary" onClick={() => openPanel('find')}>
              가게 찾기
            </BrewButton>
          </div>
        </header>

        {error ? (
          <p className="brew-notice brew-notice--error" role="alert">
            {error}
          </p>
        ) : null}
        {feedback ? (
          <p className="brew-notice brew-notice--success" role="status">
            {feedback}
          </p>
        ) : null}

        {bothEmpty ? (
          <p className="brew-notice brew-notice--info" role="status">
            아직 등록·구독 중인 가게가 없습니다. 위에서 만들거나 찾아보세요.
          </p>
        ) : null}

        <div className="brew-hub-grid">
          <section className="brew-section">
            <p className="brew-section__label">My stores</p>
            <BrewCard title="내 가게">
              {hasOwned ? (
                <div className="brew-stack">
                  {myStores.map((store) => (
                    <BrewStoreRow
                      key={store.id}
                      name={store.name}
                      onClick={() => {
                        void navigate(`/hobbies/brew-note/stores/${store.id}`);
                      }}
                      badge={<BrewVisibilityBadge isPublic={store.isPublic} />}
                    />
                  ))}
                </div>
              ) : (
                <p className="brew-empty">등록된 가게가 없습니다.</p>
              )}
            </BrewCard>
          </section>

          <section className="brew-section">
            <p className="brew-section__label">Subscribed</p>
            <BrewCard title="구독 가게">
              {hasSubs ? (
                <div className="brew-stack">
                  {subscriptions.map((store) => (
                    <BrewStoreRow
                      key={store.id}
                      name={store.name}
                      onClick={() => {
                        void navigate(`/hobbies/brew-note/stores/${store.id}`);
                      }}
                      badge={<BrewVisibilityBadge isPublic={store.isPublic} />}
                    />
                  ))}
                </div>
              ) : (
                <p className="brew-empty">구독 중인 가게가 없습니다.</p>
              )}
            </BrewCard>
          </section>
        </div>

        {panel !== 'none' ? (
          <section className="brew-section brew-hub-panel" ref={panelRef}>
            <div className="brew-hub-panel__bar">
              <p className="brew-section__label">
                {panel === 'find' ? 'Find a café' : 'Open yours'}
              </p>
              <BrewButton size="sm" variant="ghost" onClick={() => setPanel('none')}>
                닫기
              </BrewButton>
            </div>

            {panel === 'find' ? (
              <BrewCard title="가게 검색 · 가입">
                <p className="brew-card-lead">
                  이름으로 찾아 가입을 신청하거나, 이미 구독 중이면 바로 엽니다.
                </p>
                <div className="brew-search-row">
                  <BrewInput
                    value={joinQuery}
                    onChange={(e) => setJoinQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="가게 이름"
                    autoComplete="off"
                  />
                  <BrewButton onClick={() => void handleSearch()} loading={searching}>
                    검색
                  </BrewButton>
                </div>

                {searchMessage ? (
                  <p className="brew-card-lead brew-card-lead--mt">{searchMessage}</p>
                ) : null}

                {searchResults.length > 0 ? (
                  <div className="brew-stack brew-stack--mt">
                    {searchResults.map((store) => {
                      const canOpen = store.owned || store.subscribed || store.isPublic;
                      return (
                        <div key={store.id} className="brew-search-result">
                          <div>
                            <div className="brew-store-row__title-row">
                              <p className="brew-store-row__name">{store.name}</p>
                              <BrewVisibilityBadge isPublic={store.isPublic} />
                              {store.owned ? (
                                <BrewBadge variant="info">내 가게</BrewBadge>
                              ) : null}
                              {store.subscribed ? (
                                <BrewBadge variant="success">구독 중</BrewBadge>
                              ) : null}
                            </div>
                            {!canOpen ? (
                              <p className="brew-store-row__sub">
                                비공개 가게입니다. 가입 승인 후 열람할 수 있습니다.
                              </p>
                            ) : null}
                          </div>
                          <div className="brew-search-result__actions">
                            <BrewButton
                              size="sm"
                              variant="secondary"
                              disabled={!canOpen}
                              onClick={() => {
                                void navigate(`/hobbies/brew-note/stores/${store.id}`);
                              }}
                            >
                              열기
                            </BrewButton>
                            {!store.owned && !store.subscribed ? (
                              <BrewButton
                                size="sm"
                                loading={joiningStoreId === store.id}
                                onClick={() => {
                                  void handleJoin(store);
                                }}
                              >
                                가입 신청
                              </BrewButton>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </BrewCard>
            ) : (
              <BrewCard title="가게 등록">
                <p className="brew-card-lead">
                  이름과 공개 여부만 정하면 새 노트를 시작할 수 있습니다.
                </p>
                <form className="brew-form-stack" onSubmit={handleCreateStore}>
                  <BrewInput
                    label="가게 이름"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="예: 5DEG Roasters"
                    maxLength={120}
                    disabled={creating}
                  />
                  <label className="brew-check">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      disabled={creating}
                    />
                    공개 가게
                  </label>
                  <BrewButton type="submit" loading={creating}>
                    가게 생성
                  </BrewButton>
                </form>
              </BrewCard>
            )}
          </section>
        ) : null}
      </div>
    </main>
    </>
  );
}
