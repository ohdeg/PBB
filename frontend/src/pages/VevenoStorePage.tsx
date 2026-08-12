import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { vevenoApi } from '../api/vevenoApi';
import { VevenoButton } from '../components/veveno/VevenoButton';
import { VevenoCard } from '../components/veveno/VevenoCard';
import { VevenoInput } from '../components/veveno/VevenoInput';
import { VevenoStoreDeleteDialog } from '../components/veveno/VevenoStoreDeleteDialog';
import { VevenoJoinApproveModal } from '../components/veveno/VevenoJoinApproveModal';
import type { VevenoJoinApprovePayload } from '../components/veveno/VevenoJoinApproveModal';
import { VevenoModal } from '../components/veveno/VevenoModal';
import { VevenoRecipeNotesEditor } from '../components/veveno/VevenoRecipeNotesEditor';
import { VevenoRecipeNotesView } from '../components/veveno/VevenoRecipeNotesView';
import { VevenoSchedulePanel } from '../components/veveno/VevenoSchedulePanel';
import { VevenoStoreStocksPanel } from '../components/veveno/VevenoStoreStocksPanel';
import { VevenoToolsPanel } from '../components/veveno/VevenoToolsPanel';
import {
  VevenoSplashScreen,
  useVevenoSplash,
} from '../components/veveno/VevenoSplashScreen';
import { VevenoVisibilityBadge } from '../components/veveno/VevenoVisibilityBadge';
import { VevenoBadge } from '../components/veveno/VevenoBadge';
import { useAuthStore } from '../stores/authStore';
import {
  formatVevenoNoticeDate as formatNoticeDate,
  useVevenoNotices,
} from '../hooks/useVevenoNotices';
import type {
  VevenoJoinRequest,
  VevenoMenu,
  VevenoRecipe,
  VevenoRecipeContent,
  VevenoStockCategory,
  VevenoStore,
  VevenoSubscriber,
} from '../types/veveno';
import {
  EMPTY_RECIPE_CONTENT,
  parseRecipeContents,
  stringifyRecipeContents,
} from '../types/veveno';
import { getErrorMessage } from '../utils/error';

type Tab = 'menus' | 'stocks' | 'schedule' | 'tools' | 'settings';

const TAB_IDS: readonly Tab[] = ['menus', 'stocks', 'schedule', 'tools', 'settings'];

function parseTabParam(raw: string | null): Tab {
  if (raw && (TAB_IDS as readonly string[]).includes(raw)) {
    return raw as Tab;
  }
  return 'menus';
}

export function VevenoStorePage() {
  const { storeId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const accessToken = useAuthStore((state) => state.accessToken);
  const myUserId = useAuthStore((state) => state.userId);
  const { showSplash, handleSplashFinish } = useVevenoSplash();

  const tab = parseTabParam(searchParams.get('tab'));
  const setTab = useCallback(
    (next: Tab) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === 'menus') {
            params.delete('tab');
          } else {
            params.set('tab', next);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const [store, setStore] = useState<VevenoStore | null>(null);
  const [menus, setMenus] = useState<VevenoMenu[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<VevenoRecipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [stockCategories, setStockCategories] = useState<VevenoStockCategory[]>([]);
  const [joinRequests, setJoinRequests] = useState<VevenoJoinRequest[]>([]);
  const [subscribers, setSubscribers] = useState<VevenoSubscriber[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recipeEditMode, setRecipeEditMode] = useState(false);
  const [menuEditMode, setMenuEditMode] = useState(false);
  const [menuEditOpen, setMenuEditOpen] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [editingMenuName, setEditingMenuName] = useState('');
  const [savingMenu, setSavingMenu] = useState(false);
  const [recipeViewOpen, setRecipeViewOpen] = useState(false);
  const [viewRecipeContent, setViewRecipeContent] =
    useState<VevenoRecipeContent>(EMPTY_RECIPE_CONTENT);

  const [menuName, setMenuName] = useState('');
  const [menuSearch, setMenuSearch] = useState('');
  const [recipeForm, setRecipeForm] = useState<VevenoRecipeContent>(EMPTY_RECIPE_CONTENT);
  const [storeForm, setStoreForm] = useState({ name: '', isPublic: false });
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<{
    userId: string;
    nickname: string;
    self: boolean;
  } | null>(null);
  const [leaveDate, setLeaveDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [leaving, setLeaving] = useState(false);
  const [approveTarget, setApproveTarget] = useState<VevenoJoinRequest | null>(null);
  const [approving, setApproving] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const {
    notices,
    setNotices,
    noticesOpen,
    noticeForm,
    setNoticeForm,
    editingNoticeId,
    savingNotice,
    openNotices,
    closeNotices,
    startEditNotice,
    cancelNoticeEdit,
    handleSaveNotice,
    handleDeleteNotice,
  } = useVevenoNotices({ store, storeId, setError });

  const loadStore = useCallback(async () => {
    if (!storeId || !accessToken) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await vevenoApi.getStore(storeId);
      setStore(data);
      setStoreForm({ name: data.name, isPublic: data.isPublic });
      const menusRes = await vevenoApi.listMenus(storeId);
      setMenus(menusRes.data);
      if (data.owned || data.subscribed) {
        try {
          const noticesRes = await vevenoApi.listNotices(storeId);
          setNotices(noticesRes.data);
        } catch {
          setNotices([]);
        }
      } else {
        setNotices([]);
      }
      if (data.canEditStock) {
        const stocksRes = await vevenoApi.listStocks(storeId);
        setStockCategories(stocksRes.data);
      } else {
        setStockCategories([]);
      }
      if (data.owned) {
        const [joinsRes, subsRes] = await Promise.all([
          vevenoApi.listJoinRequests(storeId),
          vevenoApi.listSubscribers(storeId),
        ]);
        setJoinRequests(joinsRes.data);
        setSubscribers(subsRes.data);
      } else {
        setJoinRequests([]);
        setSubscribers([]);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, '가게를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, storeId, setNotices]);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = store?.name ? `${store.name} · Veveno` : 'Veveno';
    return () => {
      document.title = previousTitle;
    };
  }, [store?.name]);

  useEffect(() => {
    if (!store) {
      return;
    }
    if (tab === 'stocks' && !store.canEditStock) {
      setTab('menus');
      return;
    }
    if (tab === 'schedule' && !store.owned && !store.subscribed) {
      setTab('menus');
      return;
    }
    if (tab === 'tools' && !store.owned && !store.subscribed) {
      setTab('menus');
      return;
    }
    if (tab === 'settings' && !store.owned) {
      setTab('menus');
    }
  }, [tab, store, setTab]);

  useEffect(() => {
    if (tab !== 'stocks' || !storeId || !accessToken || !store?.canEditStock) {
      return;
    }
    void (async () => {
      try {
        const { data } = await vevenoApi.getStore(storeId);
        setStore(data);
      } catch {
        /* keep previous store snapshot */
      }
    })();
  }, [tab, storeId, accessToken, store?.canEditStock]);

  useEffect(() => {
    if (menus.length === 0) {
      setSelectedMenuId(null);
      return;
    }
    const stillValid = selectedMenuId != null && menus.some((m) => m.id === selectedMenuId);
    if (!stillValid) {
      setSelectedMenuId(menus[0].id);
    }
  }, [menus, selectedMenuId]);

  useEffect(() => {
    if (!selectedMenuId) {
      setRecipes([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await vevenoApi.listRecipes(selectedMenuId);
        if (!cancelled) {
          setRecipes(data);
          // 목록만 로드. 상세 보기 모달은 열지 않음
          setRecipeViewOpen(false);
          setSelectedRecipeId(null);
          setRecipeForm(EMPTY_RECIPE_CONTENT);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(err, '레시피를 불러오지 못했습니다.'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedMenuId]);

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId) ?? null;
  const canEditStock = Boolean(store?.canEditStock);

  const normalizedMenuSearch = menuSearch.trim().toLowerCase();

  const filteredMenus = useMemo(() => {
    if (!normalizedMenuSearch) {
      return menus;
    }
    return menus.filter((menu) => menu.name.toLowerCase().includes(normalizedMenuSearch));
  }, [menus, normalizedMenuSearch]);

  const filteredRecipes = useMemo(() => {
    if (!normalizedMenuSearch) {
      return recipes;
    }
    return recipes.filter((recipe) => {
      const parsed = parseRecipeContents(recipe.contents);
      return (
        parsed.title.toLowerCase().includes(normalizedMenuSearch) ||
        parsed.notes.toLowerCase().includes(normalizedMenuSearch)
      );
    });
  }, [recipes, normalizedMenuSearch]);

  if (!accessToken) {
    if (useAuthStore.getState().suppressLoginRedirect) {
      return null;
    }
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `/hobbies/veveno/stores/${storeId}` }}
      />
    );
  }

  const handleCreateMenu = async (event: FormEvent) => {
    event.preventDefault();
    if (!menuName.trim() || !store?.owned) return;
    try {
      const { data } = await vevenoApi.createMenu(storeId, menuName.trim());
      setMenus((prev) => [...prev, data]);
      setMenuName('');
      setSelectedMenuId(data.id);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '메뉴 추가에 실패했습니다.'));
    }
  };

  const selectMenu = (menu: VevenoMenu) => {
    setSelectedMenuId(menu.id);
    setSelectedRecipeId(null);
    setRecipeForm(EMPTY_RECIPE_CONTENT);
    setRecipeViewOpen(false);
  };

  const openMenuEditModal = (menu: VevenoMenu) => {
    selectMenu(menu);
    if (!store?.owned || !menuEditMode) {
      return;
    }
    setEditingMenuId(menu.id);
    setEditingMenuName(menu.name);
    setMenuEditOpen(true);
    setError('');
  };

  const closeMenuEditModal = () => {
    if (savingMenu) {
      return;
    }
    setMenuEditOpen(false);
    setEditingMenuId(null);
    setEditingMenuName('');
  };

  const handleSaveMenuName = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingMenuId || !editingMenuName.trim() || !store?.owned) {
      return;
    }
    setSavingMenu(true);
    setError('');
    try {
      const { data } = await vevenoApi.updateMenu(editingMenuId, editingMenuName.trim());
      setMenus((prev) => prev.map((m) => (m.id === data.id ? data : m)));
      setMenuEditOpen(false);
      setEditingMenuId(null);
      setEditingMenuName('');
    } catch (err: unknown) {
      setError(getErrorMessage(err, '메뉴 이름 수정에 실패했습니다.'));
    } finally {
      setSavingMenu(false);
    }
  };

  const handleDeleteMenu = async (menuId: string) => {
    if (!window.confirm('메뉴와 하위 레시피를 삭제할까요?')) return;
    setSavingMenu(true);
    setError('');
    try {
      await vevenoApi.deleteMenu(menuId);
      setMenus((prev) => prev.filter((m) => m.id !== menuId));
      if (selectedMenuId === menuId) {
        setSelectedMenuId(null);
        setRecipes([]);
        setRecipeViewOpen(false);
      }
      setMenuEditOpen(false);
      setEditingMenuId(null);
      setEditingMenuName('');
    } catch (err: unknown) {
      setError(getErrorMessage(err, '메뉴 삭제에 실패했습니다.'));
    } finally {
      setSavingMenu(false);
    }
  };

  const handleSaveRecipe = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedMenuId || !store?.owned) return;
    const contents = stringifyRecipeContents(recipeForm);
    try {
      if (selectedRecipeId) {
        const { data } = await vevenoApi.updateRecipe(selectedRecipeId, contents);
        setRecipes((prev) => prev.map((r) => (r.id === data.id ? data : r)));
      } else {
        const { data } = await vevenoApi.createRecipe(selectedMenuId, contents);
        setRecipes((prev) => [...prev, data]);
        setSelectedRecipeId(data.id);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, '레시피 저장에 실패했습니다.'));
    }
  };

  const handleDeleteRecipe = async () => {
    if (!selectedRecipeId) return;
    if (!window.confirm('이 레시피를 삭제할까요?')) return;
    try {
      await vevenoApi.deleteRecipe(selectedRecipeId);
      setRecipes((prev) => prev.filter((r) => r.id !== selectedRecipeId));
      setSelectedRecipeId(null);
      setRecipeForm(EMPTY_RECIPE_CONTENT);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '레시피 삭제에 실패했습니다.'));
    }
  };

  const handleSaveStore = async (event: FormEvent) => {
    event.preventDefault();
    if (!store?.owned) return;
    try {
      const { data } = await vevenoApi.updateStore(storeId, storeForm);
      setStore(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '가게 설정 저장에 실패했습니다.'));
    }
  };

  const handleCopyInviteCode = async () => {
    const code = store?.inviteCode;
    if (!code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      setError('코드 복사에 실패했습니다.');
    }
  };

  const handleRegenerateInviteCode = async () => {
    if (!store?.owned) {
      return;
    }
    const ok = window.confirm(
      '가게 코드를 재발급할까요?\n이전 코드로는 더 이상 검색할 수 없습니다.',
    );
    if (!ok) {
      return;
    }
    setRegeneratingCode(true);
    setError('');
    try {
      const { data } = await vevenoApi.regenerateInviteCode(storeId);
      setStore(data);
      setCodeCopied(false);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '가게 코드 재발급에 실패했습니다.'));
    } finally {
      setRegeneratingCode(false);
    }
  };

  const openLeaveDialog = (target: {
    userId: string;
    nickname: string;
    self: boolean;
  }) => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setLeaveDate(`${y}-${m}-${day}`);
    setLeaveTarget(target);
    setLeaveOpen(true);
  };

  const handleConfirmLeave = async (event: FormEvent) => {
    event.preventDefault();
    if (!leaveTarget || !leaveDate) {
      return;
    }
    const targetUserId = leaveTarget.self ? myUserId : leaveTarget.userId;
    if (!targetUserId) {
      setError('사용자 정보를 확인할 수 없습니다.');
      return;
    }
    setLeaving(true);
    setError('');
    try {
      const { data: coverCount } = await vevenoApi.countCoversAfterLeave(
        storeId,
        targetUserId,
        leaveDate,
      );
      if (coverCount.count > 0) {
        const ok = window.confirm(
          `퇴사일(${leaveDate}) 이후에 대체·추가 근무가 ${coverCount.count}건 있습니다.\n확인하면 해당 건이 삭제되고 퇴사가 진행됩니다. 계속할까요?`,
        );
        if (!ok) {
          return;
        }
      }
      if (leaveTarget.self) {
        await vevenoApi.unsubscribe(storeId, leaveDate);
        const today = (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })();
        if (leaveDate < today) {
          navigate('/hobbies/veveno/hub');
          return;
        }
        await loadStore();
      } else {
        const { data } = await vevenoApi.resignSubscriber(
          storeId,
          leaveTarget.userId,
          leaveDate,
        );
        if (data && 'userId' in data) {
          setSubscribers((prev) =>
            prev.map((s) => (s.userId === data.userId ? data : s)),
          );
        } else {
          setSubscribers((prev) =>
            prev.filter((s) => s.userId !== leaveTarget.userId),
          );
        }
        const { data: subs } = await vevenoApi.listSubscribers(storeId);
        setSubscribers(subs);
      }
      setLeaveOpen(false);
      setLeaveTarget(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '퇴사 처리에 실패했습니다.'));
    } finally {
      setLeaving(false);
    }
  };

  const handleClearLeave = async (userId: string, self: boolean) => {
    setError('');
    try {
      if (self) {
        await vevenoApi.clearMyLeave(storeId);
        await loadStore();
      } else {
        const { data } = await vevenoApi.clearSubscriberLeave(storeId, userId);
        setSubscribers((prev) =>
          prev.map((s) => (s.userId === data.userId ? data : s)),
        );
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, '퇴사 예약 취소에 실패했습니다.'));
    }
  };

  const handleConfirmApprove = async (payload: VevenoJoinApprovePayload) => {
    if (!approveTarget) {
      return;
    }
    setApproving(true);
    setError('');
    try {
      await vevenoApi.approveJoin(storeId, approveTarget.userId, payload);
      setJoinRequests((prev) =>
        prev.filter((r) => r.userId !== approveTarget.userId),
      );
      const { data } = await vevenoApi.listSubscribers(storeId);
      setSubscribers(data);
      setApproveTarget(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '승인에 실패했습니다.'));
    } finally {
      setApproving(false);
    }
  };

  const handleDeleteStore = async () => {
    setDeleting(true);
    setError('');
    try {
      await vevenoApi.deleteStore(storeId);
      setDeleteDialogOpen(false);
      void navigate('/hobbies/veveno/hub');
    } catch (err: unknown) {
      setError(getErrorMessage(err, '가게 삭제에 실패했습니다.'));
    } finally {
      setDeleting(false);
    }
  };

  const tabs: { id: Tab; label: string; visible?: boolean }[] = [
    { id: 'menus', label: '메뉴', visible: true },
    { id: 'stocks', label: '재고', visible: canEditStock },
    {
      id: 'schedule',
      label: '근무',
      visible: Boolean(store?.owned || store?.subscribed),
    },
    {
      id: 'tools',
      label: '도구',
      visible: Boolean(store?.owned || store?.subscribed),
    },
    { id: 'settings', label: '설정', visible: Boolean(store?.owned) },
  ];
  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <>
      {showSplash ? <VevenoSplashScreen onFinish={handleSplashFinish} /> : null}
      {loading ? (
        <main className="veveno-shell">
          <div className="veveno-shell__inner veveno-shell__loading">Loading…</div>
        </main>
      ) : (
      <main className="veveno-shell">
      <div className="veveno-shell__inner veveno-shell__inner--wide">
        <div className="veveno-detail-head">
          <div>
            <Link to="/hobbies/veveno/hub" className="veveno-shell__back">
              ← Veveno
            </Link>
            {store ? (
              <>
                <h1>{store.name}</h1>
                <p className="veveno-shell__meta">
                  {store.owned ? 'Owner' : store.subscribed ? 'Staff' : 'Guest'}
                  {' · '}
                  <VevenoVisibilityBadge isPublic={store.isPublic} />
                  {store.onDuty ? (
                    <>
                      {' · '}
                      <VevenoBadge variant="success">근무중</VevenoBadge>
                    </>
                  ) : null}
                  {store.subscribed && store.leaveDate ? (
                    <>
                      {' · '}
                      <span>퇴사 예정 {store.leaveDate}</span>
                    </>
                  ) : null}
                </p>
              </>
            ) : null}
          </div>
          {store && (store.owned || store.subscribed) ? (
            <button
              type="button"
              className="veveno-notice-icon-btn"
              aria-label="공지"
              title="공지"
              onClick={openNotices}
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              {notices.length > 0 ? (
                <span className="veveno-notice-icon-btn__badge">
                  {notices.length > 99 ? '99+' : notices.length}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="veveno-notice veveno-notice--error" role="alert">
            {error}
          </p>
        ) : null}

        {store ? (
          <>
            {visibleTabs.length > 1 ? (
              <div className="veveno-seg-tabs-wrap">
                <div
                  className="veveno-seg-tabs veveno-seg-tabs--sticky"
                  style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)` }}
                >
                  {visibleTabs.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={tab === item.id ? 'is-active' : ''}
                      onClick={() => setTab(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {tab === 'menus' ? (
              <div className="veveno-stack-lg">
                <div className="veveno-toolbar">
                  <VevenoInput
                    id="menu-tab-search"
                    label="검색"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="메뉴·레시피 이름 검색"
                  />
                </div>
                <div className="veveno-menu-layout">
                  <aside className="veveno-menu-rail">
                    <div className="veveno-menu-rail__head">
                      <h2 className="veveno-menu-rail__title">카테고리</h2>
                      {store.owned ? (
                        <VevenoButton
                          size="sm"
                          variant={menuEditMode ? 'secondary' : 'ghost'}
                          onClick={() => {
                            setMenuEditMode((prev) => {
                              const next = !prev;
                              if (!next) {
                                setMenuEditOpen(false);
                                setEditingMenuId(null);
                                setEditingMenuName('');
                              }
                              return next;
                            });
                          }}
                        >
                          {menuEditMode ? '편집 종료' : '편집'}
                        </VevenoButton>
                      ) : null}
                    </div>
                    {store.owned && menuEditMode ? (
                      <form className="veveno-search-row" onSubmit={handleCreateMenu}>
                        <VevenoInput
                          value={menuName}
                          onChange={(e) => setMenuName(e.target.value)}
                          placeholder="메뉴 이름"
                        />
                        <VevenoButton type="submit">추가</VevenoButton>
                      </form>
                    ) : null}
                    <div className="veveno-menu-rail__list">
                      {menus.length === 0 ? (
                        <p className="veveno-empty">메뉴가 없습니다.</p>
                      ) : filteredMenus.length === 0 ? (
                        <p className="veveno-empty">검색 결과가 없습니다.</p>
                      ) : (
                        filteredMenus.map((menu) => (
                          <button
                            key={menu.id}
                            type="button"
                            className={
                              menu.id === selectedMenuId
                                ? 'veveno-rail-item is-active'
                                : 'veveno-rail-item'
                            }
                            onClick={() => openMenuEditModal(menu)}
                          >
                            <span className="veveno-rail-item__name">{menu.name}</span>
                            {store.owned && menuEditMode ? (
                              <span className="veveno-rail-item__hint">수정</span>
                            ) : null}
                          </button>
                        ))
                      )}
                    </div>
                  </aside>

                  <div className="veveno-menu-main">
                    <VevenoCard
                      title="레시피"
                      action={
                        store.owned ? (
                          <div className="veveno-card__actions">
                            <VevenoButton
                              size="sm"
                              disabled={!selectedMenuId}
                              onClick={() => {
                                if (!selectedMenuId) {
                                  return;
                                }
                                setRecipeEditMode(true);
                                setSelectedRecipeId(null);
                                setRecipeForm(EMPTY_RECIPE_CONTENT);
                                setError('');
                              }}
                            >
                              새로 추가
                            </VevenoButton>
                            <VevenoButton
                              size="sm"
                              variant={recipeEditMode ? 'secondary' : 'ghost'}
                              onClick={() => {
                                setRecipeEditMode((prev) => {
                                  const next = !prev;
                                  if (!next) {
                                    setSelectedRecipeId(null);
                                    setRecipeForm(EMPTY_RECIPE_CONTENT);
                                  }
                                  return next;
                                });
                              }}
                            >
                              {recipeEditMode ? '편집 종료' : '편집'}
                            </VevenoButton>
                          </div>
                        ) : null
                      }
                    >
                      {!selectedMenuId ? (
                        <p className="veveno-empty">왼쪽에서 메뉴를 선택해 주세요.</p>
                      ) : recipes.length === 0 ? (
                        <p className="veveno-empty">등록된 레시피가 없습니다.</p>
                      ) : filteredRecipes.length === 0 ? (
                        <p className="veveno-empty">검색 결과가 없습니다.</p>
                      ) : (
                        <div className="veveno-stack">
                          {filteredRecipes.map((recipe) => {
                            const parsed = parseRecipeContents(recipe.contents);
                            return (
                              <button
                                key={recipe.id}
                                type="button"
                                className={
                                  recipeEditMode && recipe.id === selectedRecipeId
                                    ? 'veveno-store-row is-clickable is-selected'
                                    : 'veveno-store-row is-clickable'
                                }
                                onClick={() => {
                                  if (recipeEditMode && store.owned) {
                                    setSelectedRecipeId(recipe.id);
                                    setRecipeForm(parseRecipeContents(recipe.contents));
                                    return;
                                  }
                                  setViewRecipeContent(parseRecipeContents(recipe.contents));
                                  setRecipeViewOpen(true);
                                }}
                              >
                                <div className="veveno-store-row__main">
                                  <p className="veveno-store-row__name">
                                    {parsed.title || '레시피'}
                                  </p>
                                  {parsed.notes ? (
                                    <p className="veveno-store-row__sub">
                                      {parsed.notes.length > 80
                                        ? `${parsed.notes.slice(0, 80)}…`
                                        : parsed.notes}
                                    </p>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </VevenoCard>

                    {store.owned && recipeEditMode && selectedMenuId ? (
                      <VevenoCard title={selectedRecipe ? '레시피 편집' : '레시피 추가'}>
                        <form className="veveno-form-stack" onSubmit={handleSaveRecipe}>
                          <VevenoInput
                            label="제목"
                            id="recipe-title"
                            value={recipeForm.title}
                            onChange={(e) =>
                              setRecipeForm((prev) => ({
                                ...prev,
                                title: e.target.value,
                              }))
                            }
                            placeholder="레시피 제목"
                          />
                          <div className="veveno-field">
                            <span className="veveno-field__label" id="recipe-notes-label">
                              노트
                            </span>
                            <VevenoRecipeNotesEditor
                              id="recipe-notes"
                              value={recipeForm.notes}
                              onChange={(notes) =>
                                setRecipeForm((prev) => ({
                                  ...prev,
                                  notes,
                                }))
                              }
                              placeholder="추출·원두·테이스팅 메모"
                              rows={8}
                            />
                            <p className="veveno-field__hint">
                              구분점·번호 목록은 툴바에서, 들여쓰기는 Tab / Shift+Tab 또는
                              툴바로 조절합니다.
                            </p>
                          </div>
                          <div className="veveno-btn-row">
                            <VevenoButton type="submit">
                              {selectedRecipe ? '저장/수정' : '레시피 추가'}
                            </VevenoButton>
                            {selectedRecipe ? (
                              <VevenoButton
                                variant="danger"
                                onClick={() => {
                                  void handleDeleteRecipe();
                                }}
                              >
                                삭제
                              </VevenoButton>
                            ) : null}
                          </div>
                        </form>
                      </VevenoCard>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <VevenoStoreStocksPanel
              active={tab === 'stocks' && canEditStock}
              storeId={storeId}
              owned={store.owned}
              onDuty={store.onDuty}
              stockCategories={stockCategories}
              setStockCategories={setStockCategories}
              onError={setError}
            />

            {tab === 'schedule' && (store.owned || store.subscribed) ? (
              <VevenoSchedulePanel
                storeId={storeId}
                storeName={store.name}
                owned={store.owned}
                subscribed={store.subscribed}
                onError={setError}
              />
            ) : null}

            {tab === 'tools' && (store.owned || store.subscribed) ? (
              <VevenoToolsPanel storeId={storeId} />
            ) : null}

            {tab === 'settings' && store.owned ? (
              <div className="veveno-settings-stack">
                <VevenoCard title="업장 정보">
                  <form className="veveno-form-stack" onSubmit={handleSaveStore}>
                    <VevenoInput
                      label="가게 이름"
                      id="store-name"
                      value={storeForm.name}
                      onChange={(e) =>
                        setStoreForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                    <label className="veveno-check">
                      <input
                        type="checkbox"
                        checked={storeForm.isPublic}
                        onChange={(e) =>
                          setStoreForm((prev) => ({
                            ...prev,
                            isPublic: e.target.checked,
                          }))
                        }
                      />
                      공개 가게 (is_public)
                    </label>
                    <div className="veveno-invite-code">
                      <p className="veveno-field__label">가게 코드</p>
                      <p className="veveno-card-lead">
                        직원에게 공유하면 이름 대신 코드로 정확히 찾을 수 있습니다.
                        (비공개 가게도 코드로 검색 가능)
                      </p>
                      <div className="veveno-invite-code__row">
                        <code
                          className={
                            store.inviteCode
                              ? 'veveno-invite-code__value veveno-invite-code__value--copyable'
                              : 'veveno-invite-code__value'
                          }
                          role={store.inviteCode ? 'button' : undefined}
                          tabIndex={store.inviteCode ? 0 : undefined}
                          title={
                            store.inviteCode
                              ? codeCopied
                                ? '복사됨'
                                : '탭하여 복사'
                              : undefined
                          }
                          aria-label={
                            store.inviteCode
                              ? `가게 코드 ${store.inviteCode}, 탭하여 복사`
                              : undefined
                          }
                          onClick={() => {
                            if (!store.inviteCode) {
                              return;
                            }
                            void handleCopyInviteCode();
                          }}
                          onKeyDown={(e) => {
                            if (!store.inviteCode) {
                              return;
                            }
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              void handleCopyInviteCode();
                            }
                          }}
                        >
                          {store.inviteCode ?? '—'}
                        </code>
                      </div>
                    </div>
                    <div className="veveno-btn-row">
                      <VevenoButton type="submit">저장/수정</VevenoButton>
                      <VevenoButton
                        type="button"
                        variant="secondary"
                        loading={regeneratingCode}
                        onClick={() => {
                          void handleRegenerateInviteCode();
                        }}
                      >
                        재발급
                      </VevenoButton>
                    </div>
                  </form>
                </VevenoCard>

                <VevenoCard title="가입 승인">
                  {joinRequests.length === 0 ? (
                    <p className="veveno-empty">대기 중인 신청이 없습니다.</p>
                  ) : (
                    <div className="veveno-stack">
                      {joinRequests.map((req) => (
                        <div key={req.userId} className="veveno-search-result">
                          <div>
                            <p className="veveno-store-row__name">{req.nickname}</p>
                            <p className="veveno-store-row__sub">{req.email}</p>
                          </div>
                          <div className="veveno-search-result__actions">
                            <VevenoButton
                              size="sm"
                              onClick={() => setApproveTarget(req)}
                            >
                              승인
                            </VevenoButton>
                            <VevenoButton
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                void (async () => {
                                  await vevenoApi.rejectJoin(storeId, req.userId);
                                  setJoinRequests((prev) =>
                                    prev.filter((r) => r.userId !== req.userId),
                                  );
                                })();
                              }}
                            >
                              거절
                            </VevenoButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </VevenoCard>

                <VevenoCard title="직원 · 재고 권한">
                  <p className="veveno-card-lead">
                    재고 수정 권한을 켠 구독자만 재고 탭이 보이며, 수량·등록을 변경할 수 있습니다.
                    퇴사일은 마지막 근무일이며, 그다음 날부터 구독·근무가 정리됩니다.
                  </p>
                  {subscribers.length === 0 ? (
                    <p className="veveno-empty">구독자가 없습니다.</p>
                  ) : (
                    <div className="veveno-stack">
                      {subscribers.map((sub) => (
                        <div key={sub.userId} className="veveno-search-result">
                          <div>
                            <p className="veveno-store-row__name">{sub.nickname}</p>
                            <p className="veveno-store-row__sub">
                              {sub.email}
                              {sub.workStartDate
                                ? ` · 근무 시작 ${sub.workStartDate}`
                                : ''}
                              {sub.leaveDate
                                ? ` · 퇴사 예정 ${sub.leaveDate}`
                                : ''}
                            </p>
                          </div>
                          <div className="veveno-search-result__actions">
                            <label className="veveno-check">
                              <input
                                type="checkbox"
                                checked={sub.canEditStock}
                                onChange={(e) => {
                                  const next = e.target.checked;
                                  void (async () => {
                                    try {
                                      const { data } = await vevenoApi.updateStockPermission(
                                        storeId,
                                        sub.userId,
                                        next,
                                      );
                                      setSubscribers((prev) =>
                                        prev.map((s) =>
                                          s.userId === data.userId ? data : s,
                                        ),
                                      );
                                    } catch (err: unknown) {
                                      setError(
                                        getErrorMessage(err, '권한 변경에 실패했습니다.'),
                                      );
                                    }
                                  })();
                                }}
                              />
                              재고 수정
                            </label>
                            {sub.leaveDate ? (
                              <VevenoButton
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  void handleClearLeave(sub.userId, false)
                                }
                              >
                                퇴사 취소
                              </VevenoButton>
                            ) : (
                              <VevenoButton
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  openLeaveDialog({
                                    userId: sub.userId,
                                    nickname: sub.nickname,
                                    self: false,
                                  })
                                }
                              >
                                퇴사
                              </VevenoButton>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </VevenoCard>

                <div className="veveno-btn-row">
                  <VevenoButton
                    variant="danger"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    가게 삭제
                  </VevenoButton>
                </div>
              </div>
            ) : null}

            {tab === 'schedule' && store.subscribed && !store.owned ? (
              <VevenoCard title="가게 나가기">
                <p className="veveno-card-lead">
                  퇴사일(마지막 근무일)을 지정하면 그날까지 근무할 수 있고, 다음날부터
                  구독이 해제됩니다. 이미 지난 날짜를 고르면 즉시 나갑니다.
                </p>
                {store.leaveDate ? (
                  <div className="veveno-btn-row">
                    <p className="veveno-card-lead">퇴사 예정: {store.leaveDate}</p>
                    <VevenoButton
                      variant="secondary"
                      onClick={() => void handleClearLeave('', true)}
                    >
                      퇴사 예약 취소
                    </VevenoButton>
                  </div>
                ) : (
                  <VevenoButton
                    variant="secondary"
                    onClick={() =>
                      openLeaveDialog({
                        userId: '',
                        nickname: '나',
                        self: true,
                      })
                    }
                  >
                    퇴사일 지정 · 나가기
                  </VevenoButton>
                )}
              </VevenoCard>
            ) : null}
          </>
        ) : null}
      </div>

      <VevenoModal open={noticesOpen} title="공지" onClose={closeNotices}>
        <div className="veveno-stack-lg">
          {store?.owned ? (
            <form className="veveno-form-stack" onSubmit={(e) => void handleSaveNotice(e)}>
              <VevenoInput
                label={editingNoticeId ? '제목 수정' : '새 공지 제목'}
                value={noticeForm.title}
                onChange={(e) =>
                  setNoticeForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="공지 제목"
                disabled={savingNotice}
              />
              <div className="veveno-field">
                <label className="veveno-field__label" htmlFor="notice-body">
                  본문
                </label>
                <textarea
                  id="notice-body"
                  className="veveno-field__input veveno-notice-body"
                  rows={5}
                  value={noticeForm.body}
                  onChange={(e) =>
                    setNoticeForm((prev) => ({ ...prev, body: e.target.value }))
                  }
                  placeholder="직원에게 전달할 내용"
                  disabled={savingNotice}
                />
              </div>
              <div className="veveno-btn-row">
                <VevenoButton
                  type="submit"
                  loading={savingNotice}
                  disabled={!noticeForm.title.trim() || !noticeForm.body.trim()}
                >
                  {editingNoticeId ? '수정 저장' : '공지 등록'}
                </VevenoButton>
                {editingNoticeId ? (
                  <VevenoButton
                    type="button"
                    variant="secondary"
                    disabled={savingNotice}
                    onClick={cancelNoticeEdit}
                  >
                    작성 취소
                  </VevenoButton>
                ) : null}
              </div>
            </form>
          ) : null}

          {notices.length === 0 ? (
            <p className="veveno-empty">등록된 공지가 없습니다.</p>
          ) : (
            <div className="veveno-stack">
              {notices.map((notice) => (
                <article key={notice.id} className="veveno-notice-item">
                  <div className="veveno-notice-item__head">
                    <h3 className="veveno-notice-item__title">{notice.title}</h3>
                    <p className="veveno-notice-item__meta">
                      {notice.authorNickname || 'Owner'} · {formatNoticeDate(notice.createdAt)}
                    </p>
                  </div>
                  <p className="veveno-notice-item__body">{notice.body}</p>
                  {store?.owned ? (
                    <div className="veveno-btn-row">
                      <VevenoButton
                        size="sm"
                        variant="secondary"
                        disabled={savingNotice}
                        onClick={() => startEditNotice(notice)}
                      >
                        수정
                      </VevenoButton>
                      <VevenoButton
                        size="sm"
                        variant="danger"
                        disabled={savingNotice}
                        onClick={() => void handleDeleteNotice(notice.id)}
                      >
                        삭제
                      </VevenoButton>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}

          <div className="veveno-modal__actions">
            <VevenoButton variant="secondary" onClick={closeNotices} disabled={savingNotice}>
              닫기
            </VevenoButton>
          </div>
        </div>
      </VevenoModal>

      <VevenoModal
        open={menuEditOpen}
        title="메뉴 수정"
        onClose={closeMenuEditModal}
        closeOnBackdrop={!savingMenu}
      >
        <form className="veveno-form-stack" onSubmit={handleSaveMenuName}>
          <VevenoInput
            label="이름"
            id="edit-menu-name"
            value={editingMenuName}
            onChange={(e) => setEditingMenuName(e.target.value)}
            placeholder="메뉴 이름"
            disabled={savingMenu}
          />
          <div className="veveno-modal__actions">
            <VevenoButton type="submit" disabled={savingMenu || !editingMenuName.trim()}>
              {savingMenu ? '저장 중…' : '저장'}
            </VevenoButton>
            <VevenoButton
              type="button"
              variant="danger"
              disabled={savingMenu || !editingMenuId}
              onClick={() => {
                if (editingMenuId) {
                  void handleDeleteMenu(editingMenuId);
                }
              }}
            >
              삭제
            </VevenoButton>
            <VevenoButton
              type="button"
              variant="secondary"
              disabled={savingMenu}
              onClick={closeMenuEditModal}
            >
              취소
            </VevenoButton>
          </div>
        </form>
      </VevenoModal>

      <VevenoModal
        open={recipeViewOpen}
        title={viewRecipeContent.title || '레시피'}
        onClose={() => setRecipeViewOpen(false)}
      >
        <div className="veveno-recipe-view">
          {viewRecipeContent.notes ? (
            <VevenoRecipeNotesView notes={viewRecipeContent.notes} />
          ) : (
            <p className="veveno-empty">노트가 없습니다.</p>
          )}
        </div>
        <div className="veveno-modal__actions">
          <VevenoButton variant="secondary" onClick={() => setRecipeViewOpen(false)}>
            닫기
          </VevenoButton>
        </div>
      </VevenoModal>

      <VevenoJoinApproveModal
        open={Boolean(approveTarget)}
        request={approveTarget}
        loading={approving}
        onClose={() => {
          if (!approving) {
            setApproveTarget(null);
          }
        }}
        onSave={(payload) => {
          void handleConfirmApprove(payload);
        }}
      />

      <VevenoModal
        open={leaveOpen}
        title={leaveTarget?.self ? '가게 나가기' : `${leaveTarget?.nickname ?? ''} 퇴사`}
        onClose={() => {
          if (!leaving) {
            setLeaveOpen(false);
            setLeaveTarget(null);
          }
        }}
      >
        <form className="veveno-form-stack" onSubmit={(e) => void handleConfirmLeave(e)}>
          <p className="veveno-card-lead">
            퇴사일(마지막 근무일)을 선택하세요. 그날까지 근무할 수 있고, 다음날부터
            구독이 해제됩니다. 이미 지난 날짜를 고르면 즉시 처리됩니다.
          </p>
          <VevenoInput
            label="퇴사일"
            id="leave-date"
            type="date"
            required
            value={leaveDate}
            onChange={(e) => setLeaveDate(e.target.value)}
          />
          <div className="veveno-btn-row">
            <VevenoButton
              type="button"
              variant="secondary"
              disabled={leaving}
              onClick={() => {
                setLeaveOpen(false);
                setLeaveTarget(null);
              }}
            >
              취소
            </VevenoButton>
            <VevenoButton type="submit" variant="danger" loading={leaving}>
              {leaveTarget?.self ? '나가기' : '퇴사 처리'}
            </VevenoButton>
          </div>
        </form>
      </VevenoModal>

      <VevenoStoreDeleteDialog
        open={deleteDialogOpen}
        storeName={store?.name ?? ''}
        loading={deleting}
        onConfirm={() => {
          void handleDeleteStore();
        }}
        onCancel={() => {
          if (!deleting) {
            setDeleteDialogOpen(false);
          }
        }}
      />
    </main>
      )}
    </>
  );
}
