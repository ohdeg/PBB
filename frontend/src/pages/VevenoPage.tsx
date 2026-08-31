import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { vevenoApi } from '../api/vevenoApi';
import { VevenoBadge } from '../components/veveno/VevenoBadge';
import { VevenoButton } from '../components/veveno/VevenoButton';
import { VevenoCard } from '../components/veveno/VevenoCard';
import { VevenoEmptyState } from '../components/veveno/VevenoEmptyState';
import { VevenoModal } from '../components/veveno/VevenoModal';
import { VevenoPosQrPanel } from '../components/veveno/VevenoPosQrPanel';
import {
  VevenoSplashScreen,
  useVevenoSplash,
} from '../components/veveno/VevenoSplashScreen';
import { VevenoInput } from '../components/veveno/VevenoInput';
import { VevenoStoreRow } from '../components/veveno/VevenoStoreRow';
import { VevenoVisibilityBadge } from '../components/veveno/VevenoVisibilityBadge';
import { hubTodayLine } from '../components/veveno/vevenoHubTodayLine';
import { VevenoLangSwitch } from '../components/veveno/VevenoLangSwitch';
import { getVevenoErrorMessage } from '../features/veveno/i18n/error';
import { useTranslation } from '../features/veveno/i18n/LanguageContext';
import { getDemoPosSession } from '../features/veveno/pos/demoSession';
import { VEVENO_DEMO_STORE_ID } from '../features/veveno/vevenoDemo';
import {
  clearVevenoPosToken,
  getVevenoPosToken,
} from '../features/veveno/pos/session';
import { useAuthStore } from '../stores/authStore';
import type { VevenoStore } from '../types/veveno';

type HubPanel = 'none' | 'find' | 'create';

export function VevenoPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const t = useTranslation();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { showSplash, handleSplashFinish } = useVevenoSplash();
  const wantPos = searchParams.get('pos') === '1';
  const [posOpen, setPosOpen] = useState(false);
  const [posRestoring, setPosRestoring] = useState(
    () =>
      !accessToken
      && Boolean(getVevenoPosToken() || getDemoPosSession()),
  );
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
  const [todayLines, setTodayLines] = useState<Record<string, string>>({});
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
          setError(getVevenoErrorMessage(err, t('errors.failLoadStores'), t));
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
  }, [accessToken, t]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    const ids = [
      ...new Set([...myStores, ...subscriptions].map((store) => store.id)),
    ];
    if (ids.length === 0) {
      setTodayLines({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const { data } = await vevenoApi.listTodayChecklists(id);
            return [id, hubTodayLine(data, t)] as const;
          } catch {
            return [id, undefined] as const;
          }
        }),
      );
      if (cancelled) {
        return;
      }
      const next: Record<string, string> = {};
      for (const [id, line] of entries) {
        if (line) {
          next[id] = line;
        }
      }
      setTodayLines(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, myStores, subscriptions, t]);

  useEffect(() => {
    if (panel === 'none') {
      return;
    }
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [panel]);

  useEffect(() => {
    if (accessToken) {
      setPosRestoring(false);
      return;
    }
    if (getDemoPosSession()) {
      void navigate(`/hobbies/veveno/pos/store/${VEVENO_DEMO_STORE_ID}`, {
        replace: true,
      });
      return;
    }
    if (!getVevenoPosToken()) {
      setPosRestoring(false);
      return;
    }
    let cancelled = false;
    void vevenoApi
      .posMe()
      .then((res) => {
        if (!cancelled) {
          void navigate(`/hobbies/veveno/pos/store/${res.data.storeId}`, {
            replace: true,
          });
        }
      })
      .catch(() => {
        clearVevenoPosToken();
        if (!cancelled) {
          setPosRestoring(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, navigate]);

  useEffect(() => {
    if (accessToken && wantPos) {
      setSearchParams({}, { replace: true });
    }
  }, [accessToken, setSearchParams, wantPos]);

  useEffect(() => {
    if (!accessToken && wantPos && !posRestoring) {
      setPosOpen(true);
    }
  }, [accessToken, wantPos, posRestoring]);

  const closePosModal = () => {
    setPosOpen(false);
    if (wantPos) {
      setSearchParams({}, { replace: true });
    }
  };

  if (!accessToken) {
    return (
      <>
        {showSplash ? <VevenoSplashScreen onFinish={handleSplashFinish} /> : null}
        <main className="veveno-shell">
          <div className="veveno-shell__inner veveno-shell__inner--hub">
            <div className="veveno-shell__top">
              <Link to="/" className="veveno-shell__back">
                {t('common.backMain')}
              </Link>
              <VevenoLangSwitch />
            </div>
            {posRestoring ? (
              <div className="veveno-shell__loading">{t('hub.loading')}</div>
            ) : (
              <>
                <header className="veveno-shell__hero veveno-shell__hero--hub">
                  <p className="veveno-shell__hero-brand">Veveno</p>
                  <p className="veveno-hub-guest__badge">{t('hub.guestBadge')}</p>
                  <p className="veveno-shell__meta">{t('hub.guestBody')}</p>
                  <div className="veveno-hero-cta">
                    <VevenoButton
                      onClick={() => {
                        void navigate('/login', {
                          state: { from: '/hobbies/veveno/hub' },
                        });
                      }}
                    >
                      {t('hub.guestLogin')}
                    </VevenoButton>
                    <VevenoButton
                      variant="secondary"
                      onClick={() => {
                        setPosOpen(true);
                      }}
                    >
                      {t('hub.openPos')}
                    </VevenoButton>
                  </div>
                </header>
              </>
            )}
          </div>
        </main>
        {posOpen && !posRestoring ? (
          <VevenoModal
            open
            title={t('pos.waitingTitle')}
            onClose={closePosModal}
          >
            <VevenoPosQrPanel />
          </VevenoModal>
        ) : null}
      </>
    );
  }

  const openPanel = (next: HubPanel) => {
    setPanel((prev) => (prev === next ? 'none' : next));
  };

  const handleSearch = async () => {
    const q = joinQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchMessage(t('hub.searchEmptyQuery'));
      return;
    }
    setSearching(true);
    setSearchMessage(null);
    setError('');
    try {
      const { data } = await vevenoApi.searchStores(q);
      setSearchResults(data);
      setSearchMessage(data.length === 0 ? t('hub.searchNone') : null);
    } catch (err: unknown) {
      setSearchResults([]);
      setSearchMessage(getVevenoErrorMessage(err, t('errors.failSearch'), t));
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
      setError(t('hub.nameRequired'));
      return;
    }
    setCreating(true);
    setError('');
    try {
      const { data } = await vevenoApi.createStore({ name, isPublic });
      void navigate(`/hobbies/veveno/stores/${data.id}`);
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('errors.failCreateStore'), t));
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
      setFeedback(t('hub.joinOk'));
      setJoinQuery('');
      setSearchResults([]);
      setSearchMessage(null);
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('errors.failJoin'), t));
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
        <div className="veveno-shell__inner veveno-shell__loading">{t('hub.loading')}</div>
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
            {t('common.backMain')}
          </Link>
          <VevenoLangSwitch />
        </div>

        <header className="veveno-shell__hero veveno-shell__hero--hub">
          <p className="veveno-shell__hero-brand">Veveno</p>
          {bothEmpty ? null : (
            <div className="veveno-hero-cta">
              <VevenoButton onClick={() => openPanel('create')}>{t('hub.register')}</VevenoButton>
              <VevenoButton variant="secondary" onClick={() => openPanel('find')}>
                {t('hub.find')}
              </VevenoButton>
            </div>
          )}
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
          <VevenoEmptyState
            title={t('hub.emptyTitle')}
            body={t('hub.emptyBody')}
            action={
              <>
                <VevenoButton onClick={() => openPanel('create')}>{t('hub.register')}</VevenoButton>
                <VevenoButton variant="secondary" onClick={() => openPanel('find')}>
                  {t('hub.find')}
                </VevenoButton>
              </>
            }
          />
        ) : (
        <div className="veveno-hub-grid">
          <section className="veveno-section">
            <VevenoCard title={t('hub.myStores')}>
              {hasOwned ? (
                <div className="veveno-stack">
                  {myStores.map((store) => (
                    <VevenoStoreRow
                      key={store.id}
                      name={store.name}
                      subtitle={todayLines[store.id]}
                      onDuty={store.onDuty}
                      onClick={() => {
                        void navigate(`/hobbies/veveno/stores/${store.id}`);
                      }}
                      badge={
                        <>
                          <VevenoVisibilityBadge isPublic={store.isPublic} />
                          {store.onDuty ? (
                            <VevenoBadge variant="success">{t('hub.onDuty')}</VevenoBadge>
                          ) : null}
                        </>
                      }
                    />
                  ))}
                </div>
              ) : (
                <VevenoEmptyState
                  title={t('hub.noMineTitle')}
                  body={t('hub.noMineBody')}
                  action={
                    <VevenoButton onClick={() => openPanel('create')}>{t('hub.register')}</VevenoButton>
                  }
                />
              )}
            </VevenoCard>
          </section>

          <section className="veveno-section">
            <VevenoCard title={t('hub.workStores')}>
              {hasSubs ? (
                <div className="veveno-stack">
                  {subscriptions.map((store) => (
                    <VevenoStoreRow
                      key={store.id}
                      name={store.name}
                      subtitle={todayLines[store.id]}
                      onDuty={store.onDuty}
                      onClick={() => {
                        void navigate(`/hobbies/veveno/stores/${store.id}`);
                      }}
                      badge={
                        <>
                          <VevenoVisibilityBadge isPublic={store.isPublic} />
                          {store.onDuty ? (
                            <VevenoBadge variant="success">{t('hub.onDuty')}</VevenoBadge>
                          ) : null}
                        </>
                      }
                    />
                  ))}
                </div>
              ) : (
                <VevenoEmptyState
                  title={t('hub.noWorkTitle')}
                  body={t('hub.noWorkBody')}
                  action={
                    <VevenoButton variant="secondary" onClick={() => openPanel('find')}>
                      {t('hub.find')}
                    </VevenoButton>
                  }
                />
              )}
            </VevenoCard>
          </section>
        </div>
        )}

        {panel !== 'none' ? (
          <section className="veveno-section veveno-hub-panel" ref={panelRef}>
            <div className="veveno-hub-panel__bar">
              <p className="veveno-section__label">
                {panel === 'find' ? t('hub.findPanel') : t('hub.createPanel')}
              </p>
              <VevenoButton size="sm" variant="ghost" onClick={() => setPanel('none')}>
                {t('common.close')}
              </VevenoButton>
            </div>

            {panel === 'find' ? (
              <VevenoCard title={t('hub.searchCard')}>
                <p className="veveno-card-lead">{t('hub.searchLead')}</p>
                <div className="veveno-search-row">
                  <VevenoInput
                    value={joinQuery}
                    onChange={(e) => setJoinQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder={t('hub.searchPlaceholder')}
                    autoComplete="off"
                  />
                  <VevenoButton onClick={() => void handleSearch()} loading={searching}>
                    {t('common.search')}
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
                                <VevenoBadge variant="info">{t('hub.myStoreBadge')}</VevenoBadge>
                              ) : null}
                              {store.subscribed ? (
                                <VevenoBadge variant="success">{t('hub.subscribedBadge')}</VevenoBadge>
                              ) : null}
                              {store.onDuty ? (
                                <VevenoBadge variant="success">{t('hub.onDuty')}</VevenoBadge>
                              ) : null}
                            </div>
                            {!canOpen ? (
                              <p className="veveno-store-row__sub">
                                {t('hub.privateHint')}
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
                              {t('common.open')}
                            </VevenoButton>
                            {!store.owned && !store.subscribed ? (
                              <VevenoButton
                                size="sm"
                                loading={joiningStoreId === store.id}
                                onClick={() => {
                                  void handleJoin(store);
                                }}
                              >
                                {t('hub.join')}
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
              <VevenoCard title={t('hub.createTitle')}>
                <p className="veveno-card-lead">{t('hub.createLead')}</p>
                <form className="veveno-form-stack" onSubmit={handleCreateStore}>
                  <VevenoInput
                    label={t('hub.storeName')}
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder={t('hub.storeNamePh')}
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
                    {t('hub.publicStore')}
                  </label>
                  <VevenoButton type="submit" loading={creating}>
                    {t('hub.createSubmit')}
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
