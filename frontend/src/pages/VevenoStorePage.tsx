import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { vevenoApi } from '../api/vevenoApi';
import {
  isVevenoDemoStoreId,
  VEVENO_DEMO_STORE_ID,
  type VevenoDemoRole,
} from '../features/veveno/vevenoDemo';
import { currentDemoStore, getDemoRole, setDemoRole } from '../features/veveno/vevenoDemoApi';
import { VevenoButton } from '../components/veveno/VevenoButton';
import { VevenoHelpTip } from '../components/veveno/VevenoHelpTip';
import { VevenoCard } from '../components/veveno/VevenoCard';
import { VevenoEmptyState } from '../components/veveno/VevenoEmptyState';
import { VevenoInput } from '../components/veveno/VevenoInput';
import { VevenoStoreDeleteDialog } from '../components/veveno/VevenoStoreDeleteDialog';
import { VevenoJoinApproveModal } from '../components/veveno/VevenoJoinApproveModal';
import type { VevenoJoinApprovePayload } from '../components/veveno/VevenoJoinApproveModal';
import { VevenoModal } from '../components/veveno/VevenoModal';
import { VevenoRecipeNotesEditor } from '../components/veveno/VevenoRecipeNotesEditor';
import { VevenoRecipeNotesView } from '../components/veveno/VevenoRecipeNotesView';
import { VevenoChecklistPanel } from '../components/veveno/VevenoChecklistPanel';
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
  VevenoChecklistToday,
  VevenoPosDevice,
} from '../types/veveno';
import {
  EMPTY_RECIPE_CONTENT,
  parseRecipeContents,
  stringifyRecipeContents,
} from '../types/veveno';
import { getVevenoErrorMessage } from '../features/veveno/i18n/error';
import { useTranslation } from '../features/veveno/i18n/LanguageContext';
import { VevenoLangSwitch } from '../components/veveno/VevenoLangSwitch';
import { VevenoPosScanModal } from '../components/veveno/VevenoPosScanModal';
import {
  clearDemoPosSession,
  extendDemoPosSession,
  getDemoPosSession,
  switchToDemoPos,
} from '../features/veveno/pos/demoSession';
import {
  clearVevenoPosToken,
  isVevenoPosKioskPath,
  setVevenoPosToken,
} from '../features/veveno/pos/session';

type Tab = 'menus' | 'stocks' | 'checklists' | 'schedule' | 'tools' | 'settings';

const TAB_IDS: readonly Tab[] = [
  'menus',
  'stocks',
  'checklists',
  'schedule',
  'tools',
  'settings',
];

const TAB_HINT_KEYS: Record<
  Tab,
  | 'store.tabHints.menus'
  | 'store.tabHints.stocks'
  | 'store.tabHints.checklists'
  | 'store.tabHints.schedule'
  | 'store.tabHints.tools'
  | 'store.tabHints.settings'
> = {
  menus: 'store.tabHints.menus',
  stocks: 'store.tabHints.stocks',
  checklists: 'store.tabHints.checklists',
  schedule: 'store.tabHints.schedule',
  tools: 'store.tabHints.tools',
  settings: 'store.tabHints.settings',
};

const EMPTY_MENU_CREATE = {
  categoryKey: '',
  customCategoryName: '',
  title: '',
  notes: '',
};

function storeRoleKey(store: VevenoStore): 'owner' | 'staff' | 'guest' {
  if (store.owned) return 'owner';
  if (store.subscribed) return 'staff';
  return 'guest';
}

function seoulDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function interruptKey(storeId: string, templateId: string): string {
  return `veveno:cl-int:${storeId}:${seoulDate()}:${templateId}`;
}

function parseTabParam(raw: string | null): Tab {
  if (raw && (TAB_IDS as readonly string[]).includes(raw)) {
    return raw as Tab;
  }
  return 'menus';
}

function formatPosExpiry(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VevenoStorePage() {
  const { storeId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isPosKiosk = isVevenoPosKioskPath(location.pathname);
  const [searchParams, setSearchParams] = useSearchParams();
  const accessToken = useAuthStore((state) => state.accessToken);
  const isDemo = isVevenoDemoStoreId(storeId);
  const [demoRole, setDemoRoleState] = useState<VevenoDemoRole>(() =>
    isVevenoDemoStoreId(storeId) ? getDemoRole() : 'owner',
  );
  const { showSplash, handleSplashFinish } = useVevenoSplash();
  const t = useTranslation();

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
  const [todayChecklists, setTodayChecklists] = useState<VevenoChecklistToday[]>([]);
  const [interruptId, setInterruptId] = useState<string | null>(null);
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
  const [menuCreateOpen, setMenuCreateOpen] = useState(false);
  const [creatingMenuRecipe, setCreatingMenuRecipe] = useState(false);
  const [menuCreateForm, setMenuCreateForm] = useState(EMPTY_MENU_CREATE);
  const [recipeForm, setRecipeForm] = useState<VevenoRecipeContent>(EMPTY_RECIPE_CONTENT);
  const [storeForm, setStoreForm] = useState({
    name: '',
    isPublic: false,
    stockEditOffDuty: false,
    stockUsageHint: false,
  });
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<{
    userId: string;
    nickname: string;
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
  const [posScanOpen, setPosScanOpen] = useState(false);
  const [posDevices, setPosDevices] = useState<VevenoPosDevice[]>([]);
  const [posExpiresAt, setPosExpiresAt] = useState<string | null>(null);
  const [posExtending, setPosExtending] = useState(false);
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
    if (!storeId || (!accessToken && !isVevenoDemoStoreId(storeId) && !isPosKiosk)) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await vevenoApi.getStore(storeId);
      setStore(data);
      setStoreForm({
        name: data.name,
        isPublic: data.isPublic,
        stockEditOffDuty: data.stockEditOffDuty,
        stockUsageHint: data.stockUsageHint,
      });
      const menusRes = await vevenoApi.listMenus(storeId);
      setMenus(menusRes.data);
      if (data.owned || data.subscribed) {
        try {
          const noticesRes = await vevenoApi.listNotices(storeId);
          setNotices(noticesRes.data);
        } catch {
          setNotices([]);
        }
        try {
          const todayRes = await vevenoApi.listTodayChecklists(storeId);
          setTodayChecklists(todayRes.data);
        } catch {
          setTodayChecklists([]);
        }
      } else {
        setNotices([]);
        setTodayChecklists([]);
      }
      if (data.canEditStock || isPosKiosk) {
        const stocksRes = await vevenoApi.listStocks(storeId);
        setStockCategories(stocksRes.data);
      } else {
        setStockCategories([]);
      }
      if (data.owned && !isPosKiosk) {
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
      if (isPosKiosk) {
        if (isDemo) {
          clearDemoPosSession();
        } else {
          clearVevenoPosToken();
        }
        void navigate('/hobbies/veveno/pos', { replace: true });
        return;
      }
      setError(getVevenoErrorMessage(err, t('errors.failLoadStore'), t));
    } finally {
      setLoading(false);
    }
  }, [accessToken, storeId, setNotices, isPosKiosk, isDemo, t, navigate]);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  useEffect(() => {
    if (!isPosKiosk) {
      return;
    }
    if (isDemo) {
      const session = getDemoPosSession();
      if (!session) {
        void navigate('/hobbies/veveno/pos', { replace: true });
        return;
      }
      setPosExpiresAt(session.expiresAt);
      return;
    }
    void vevenoApi
      .posMe()
      .then((res) => setPosExpiresAt(res.data.expiresAt))
      .catch(() => {
        clearVevenoPosToken();
        void navigate('/hobbies/veveno/pos', { replace: true });
      });
  }, [isPosKiosk, isDemo, navigate]);

  useEffect(() => {
    if (isDemo || !store?.owned || tab !== 'settings') {
      return;
    }
    void vevenoApi
      .listPosDevices(storeId)
      .then((res) => setPosDevices(res.data))
      .catch(() => setPosDevices([]));
  }, [isDemo, store?.owned, tab, storeId]);

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
    if (tab === 'stocks' && !store.canEditStock && !isPosKiosk) {
      setTab('menus');
      return;
    }
    if ((tab === 'schedule' || tab === 'settings') && isPosKiosk) {
      setTab('menus');
      return;
    }
    if (tab === 'checklists' && !store.owned && !store.subscribed) {
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
    if (tab === 'settings' && !store.owned && !store.subscribed) {
      setTab('menus');
    }
  }, [tab, store, setTab, isPosKiosk]);

  useEffect(() => {
    if (!storeId) {
      setInterruptId(null);
      return;
    }
    const next = todayChecklists.find(
      (list) =>
        list.due &&
        list.interrupt &&
        list.checkedCount < list.totalCount &&
        sessionStorage.getItem(interruptKey(storeId, list.templateId)) !== '1',
    );
    setInterruptId(next?.templateId ?? null);
  }, [todayChecklists, storeId]);

  useEffect(() => {
    if (tab !== 'stocks' || !storeId || (!accessToken && !isDemo && !isPosKiosk) || (!store?.canEditStock && !isPosKiosk)) {
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
  }, [tab, storeId, accessToken, isDemo, store?.canEditStock, isPosKiosk]);

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
          setError(getVevenoErrorMessage(err, t('errors.failLoadRecipe'), t));
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

  const handleDemoRole = (next: VevenoDemoRole) => {
    setDemoRole(next);
    setDemoRoleState(next);
    void loadStore();
  };

  const handleDemoPosSwitch = () => {
    setError('');
    try {
      switchToDemoPos(getDemoRole() === 'owner', currentDemoStore().canEditStock);
      void navigate(`/hobbies/veveno/pos/store/${VEVENO_DEMO_STORE_ID}`);
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('errors.failPosApprove'), t));
    }
  };

  const handlePosExtend = async () => {
    setPosExtending(true);
    setError('');
    try {
      if (isDemo) {
        setPosExpiresAt(extendDemoPosSession().expiresAt);
        return;
      }
      const { data } = await vevenoApi.posExtend();
      setVevenoPosToken(data.accessToken);
      setPosExpiresAt(data.expiresAt);
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('errors.failPosExtend'), t));
    } finally {
      setPosExtending(false);
    }
  };

  const handlePosLogout = async () => {
    if (isDemo) {
      clearDemoPosSession();
      void navigate('/hobbies/veveno/pos', { replace: true });
      return;
    }
    try {
      await vevenoApi.posLogout();
    } catch {
      /* token already dead */
    }
    clearVevenoPosToken();
    void navigate('/hobbies/veveno/pos', { replace: true });
  };

  const handleRevokePosDevice = async (deviceRowId: string) => {
    if (!window.confirm(t('settings.posRevokeConfirm'))) {
      return;
    }
    try {
      await vevenoApi.revokePosDevice(storeId, deviceRowId);
      setPosDevices((prev) => prev.filter((device) => device.id !== deviceRowId));
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('errors.failPosRevoke'), t));
    }
  };

  if (!accessToken && !isDemo && !isPosKiosk) {
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
      setError(getVevenoErrorMessage(err, t('errors.failAddMenu'), t));
    }
  };

  const openMenuCreate = (categoryId?: string) => {
    if (!store?.owned) {
      return;
    }
    setError('');
    const hasMenus = menus.length > 0;
    setMenuCreateForm({
      ...EMPTY_MENU_CREATE,
      categoryKey: !hasMenus
        ? '__custom__'
        : (categoryId ?? selectedMenuId ?? ''),
    });
    setMenuCreateOpen(true);
  };

  const closeMenuCreate = () => {
    if (creatingMenuRecipe) {
      return;
    }
    setMenuCreateOpen(false);
    setMenuCreateForm(EMPTY_MENU_CREATE);
  };

  const handleCreateMenuRecipe = async (event: FormEvent) => {
    event.preventDefault();
    if (!store?.owned) {
      return;
    }
    const title = menuCreateForm.title.trim();
    if (!title) {
      setError(t('menus.titleRequired'));
      return;
    }
    const isCustom = menuCreateForm.categoryKey === '__custom__';
    if (!menuCreateForm.categoryKey) {
      setError(t('menus.pickCategoryRequired'));
      return;
    }
    if (isCustom && !menuCreateForm.customCategoryName.trim()) {
      setError(t('menus.categoryNameRequired'));
      return;
    }

    setCreatingMenuRecipe(true);
    setError('');
    try {
      let menuId: string;
      if (isCustom) {
        const name = menuCreateForm.customCategoryName.trim();
        const existing = menus.find(
          (menu) => menu.name.toLowerCase() === name.toLowerCase(),
        );
        if (existing) {
          menuId = existing.id;
        } else {
          const { data } = await vevenoApi.createMenu(storeId, name);
          setMenus((prev) => [...prev, data]);
          menuId = data.id;
        }
      } else {
        menuId = menuCreateForm.categoryKey;
      }

      const contents = stringifyRecipeContents({
        title,
        notes: menuCreateForm.notes,
      });
      const { data } = await vevenoApi.createRecipe(menuId, contents);
      if (selectedMenuId === menuId) {
        setRecipes((prev) => [...prev, data]);
      }
      setSelectedMenuId(menuId);
      setMenuCreateOpen(false);
      setMenuCreateForm(EMPTY_MENU_CREATE);
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('errors.failRegisterMenu'), t));
    } finally {
      setCreatingMenuRecipe(false);
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
      setError(getVevenoErrorMessage(err, t('errors.failRenameMenu'), t));
    } finally {
      setSavingMenu(false);
    }
  };

  const handleDeleteMenu = async (menuId: string) => {
    if (!window.confirm(t('menus.confirmDeleteMenu'))) return;
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
      setError(getVevenoErrorMessage(err, t('errors.failDeleteMenu'), t));
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
      setError(getVevenoErrorMessage(err, t('errors.failSaveRecipe'), t));
    }
  };

  const handleDeleteRecipe = async () => {
    if (!selectedRecipeId) return;
    if (!window.confirm(t('menus.confirmDeleteRecipe'))) return;
    try {
      await vevenoApi.deleteRecipe(selectedRecipeId);
      setRecipes((prev) => prev.filter((r) => r.id !== selectedRecipeId));
      setSelectedRecipeId(null);
      setRecipeForm(EMPTY_RECIPE_CONTENT);
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('errors.failDeleteRecipe'), t));
    }
  };

  const handleSaveStore = async (event: FormEvent) => {
    event.preventDefault();
    if (!store?.owned) return;
    try {
      const { data } = await vevenoApi.updateStore(storeId, storeForm);
      setStore(data);
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('errors.failSaveStore'), t));
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
      setError(t('errors.failCopyCode'));
    }
  };

  const handleRegenerateInviteCode = async () => {
    if (!store?.owned) {
      return;
    }
    const ok = window.confirm(
      t('settings.regenerateConfirm'),
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
      setError(getVevenoErrorMessage(err, t('errors.failRegenCode'), t));
    } finally {
      setRegeneratingCode(false);
    }
  };

  const openLeaveDialog = (target: {
    userId: string;
    nickname: string;
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
    setLeaving(true);
    setError('');
    try {
      const { data: coverCount } = await vevenoApi.countCoversAfterLeave(
        storeId,
        leaveTarget.userId,
        leaveDate,
      );
      if (coverCount.count > 0) {
        const ok = window.confirm(
          t('settings.confirmLeaveCovers', {
            leaveDate,
            count: coverCount.count,
          }),
        );
        if (!ok) {
          return;
        }
      }
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
      setLeaveOpen(false);
      setLeaveTarget(null);
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('errors.failLeave'), t));
    } finally {
      setLeaving(false);
    }
  };

  const handleClearLeave = async (userId: string) => {
    setError('');
    try {
      const { data } = await vevenoApi.clearSubscriberLeave(storeId, userId);
      setSubscribers((prev) =>
        prev.map((s) => (s.userId === data.userId ? data : s)),
      );
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('errors.failClearLeave'), t));
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
      setError(getVevenoErrorMessage(err, t('errors.failApprove'), t));
    } finally {
      setApproving(false);
    }
  };

  const handleTodayCheck = async (
    templateId: string,
    itemId: number,
    checked: boolean,
  ) => {
    try {
      const { data } = await vevenoApi.setChecklistCheck(storeId, templateId, {
        itemId,
        checked,
      });
      setTodayChecklists(data);
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('errors.failCheck'), t));
    }
  };

  const handleDeleteStore = async () => {
    setDeleting(true);
    setError('');
    try {
      await vevenoApi.deleteStore(storeId);
      setDeleteDialogOpen(false);
      void navigate(isDemo ? '/hobbies/veveno' : '/hobbies/veveno/hub');
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('errors.failDeleteStore'), t));
    } finally {
      setDeleting(false);
    }
  };

  const dueToday = todayChecklists.filter((list) => list.due);
  const checklistOpenCount = dueToday.filter(
    (list) => list.checkedCount < list.totalCount,
  ).length;
  const checklistBanner = dueToday.find((list) => list.checkedCount < list.totalCount);
  const interruptList =
    dueToday.find((list) => list.templateId === interruptId) ?? null;

  const tabs: { id: Tab; label: string; visible?: boolean; badge?: string }[] = [
    { id: 'menus', label: t('store.tabs.menus'), visible: true },
    { id: 'stocks', label: t('store.tabs.stocks'), visible: canEditStock || isPosKiosk },
    {
      id: 'checklists',
      label: t('store.tabs.checklists'),
      visible: Boolean(store?.owned || store?.subscribed),
      badge: checklistOpenCount > 0 ? String(checklistOpenCount) : undefined,
    },
    { id: 'schedule', label: t('store.tabs.schedule'), visible: !isPosKiosk && Boolean(store?.owned || store?.subscribed) },
    {
      id: 'tools',
      label: t('store.tabs.tools'),
      visible: Boolean(store?.owned || store?.subscribed),
    },
    { id: 'settings', label: t('store.tabs.settings'), visible: !isPosKiosk && Boolean(store?.owned || store?.subscribed) },
  ];
  const visibleTabs = tabs.filter((tabItem) => tabItem.visible);

  return (
    <>
      {showSplash && !isPosKiosk ? <VevenoSplashScreen onFinish={handleSplashFinish} /> : null}
      {loading ? (
        <main className="veveno-shell">
          <div className="veveno-shell__inner veveno-shell__loading">{t('store.loading')}</div>
        </main>
      ) : (
      <main className="veveno-shell">
      <div className="veveno-shell__inner veveno-shell__inner--wide">
        <div className="veveno-store-chrome">
          <div className="veveno-detail-head">
            <div>
              {isPosKiosk ? (
                <p className="veveno-shell__back">POS</p>
              ) : (
              <Link
                to={isDemo ? '/hobbies/veveno' : '/hobbies/veveno/hub'}
                className="veveno-shell__back"
              >
                ← Veveno
              </Link>
              )}
              {store ? (
                <>
                  <h1>{store.name}</h1>
                  <p className="veveno-shell__meta">
                    {t(
                      storeRoleKey(store) === 'owner'
                        ? 'store.roles.owner'
                        : storeRoleKey(store) === 'staff'
                          ? 'store.roles.staff'
                          : 'store.roles.guest',
                    )}
                    {' · '}
                    <VevenoVisibilityBadge isPublic={store.isPublic} />
                    {store.onDuty ? (
                      <>
                        {' · '}
                        <VevenoBadge variant="success">{t('store.onDuty')}</VevenoBadge>
                      </>
                    ) : null}
                    {store.subscribed && store.leaveDate ? (
                      <>
                        {' · '}
                        <span>{t('store.leaveSoon', { date: store.leaveDate })}</span>
                      </>
                    ) : null}
                  </p>
                </>
              ) : null}
            </div>
            {store && (store.owned || store.subscribed) ? (
              <div className="veveno-store-head-actions">
                {isPosKiosk ? (
                  <>
                    {posExpiresAt ? (
                      <span className="veveno-pos-expiry">{t('pos.until', { time: formatPosExpiry(posExpiresAt) })}</span>
                    ) : null}
                    <VevenoButton
                      type="button"
                      disabled={posExtending}
                      onClick={() => {
                        void handlePosExtend();
                      }}
                    >
                      {posExtending ? t('common.processing') : t('pos.extend')}
                    </VevenoButton>
                    <VevenoButton
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        void handlePosLogout();
                      }}
                    >
                      {t('pos.logout')}
                    </VevenoButton>
                  </>
                ) : null}
                {isDemo && !isPosKiosk ? (
                  <VevenoButton type="button" onClick={handleDemoPosSwitch}>
                    {t('store.demoPos')}
                  </VevenoButton>
                ) : null}
                {!isPosKiosk && !isDemo && accessToken ? (
                  <button
                    type="button"
                    className="veveno-notice-icon-btn"
                    aria-label={t('pos.scanTitle')}
                    title={t('pos.scanTitle')}
                    onClick={() => setPosScanOpen(true)}
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
                      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                      <rect x="7" y="7" width="10" height="10" rx="1" />
                    </svg>
                  </button>
                ) : null}
              <button
                type="button"
                className="veveno-notice-icon-btn"
                aria-label={t('store.notices')}
                title={t('store.notices')}
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
              </div>
            ) : null}
          </div>
          {isDemo && !isPosKiosk ? (
            <div className="veveno-demo-bar" role="status">
              <p className="veveno-demo-bar__copy">
                {t('store.demoBanner')}
              </p>
              <div className="veveno-demo-bar__actions">
                <div
                  className="veveno-demo-role"
                  role="group"
                  aria-label={t('store.demoRole')}
                >
                  <button
                    type="button"
                    className={demoRole === 'owner' ? 'is-active' : ''}
                    onClick={() => handleDemoRole('owner')}
                  >
                    {t('store.demoOwner')}
                  </button>
                  <button
                    type="button"
                    className={demoRole === 'staff' ? 'is-active' : ''}
                    onClick={() => handleDemoRole('staff')}
                  >
                    {t('store.demoStaff')}
                  </button>
                </div>
                {accessToken ? null : (
                  <Link
                    to="/login"
                    className="veveno-demo-bar__login"
                    state={{ from: '/hobbies/veveno/hub' }}
                  >
                    {t('store.demoLogin')}
                  </Link>
                )}
                <button
                  type="button"
                  className="veveno-demo-bar__end"
                  onClick={() => {
                    if (window.confirm(t('store.demoExitConfirm'))) {
                      void handleDeleteStore();
                    }
                  }}
                >
                  {t('store.demoExit')}
                </button>
              </div>
            </div>
          ) : null}
          {store ? (
            visibleTabs.length > 1 ? (
              <div className="veveno-seg-tabs-wrap">
                <div
                  className="veveno-seg-tabs veveno-seg-tabs--sticky"
                  role="tablist"
                  aria-label={t('store.tabsAria')}
                  style={{
                    gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)`,
                  }}
                >
                  {visibleTabs.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={tab === item.id}
                      className={tab === item.id ? 'is-active' : ''}
                      onClick={() => setTab(item.id)}
                    >
                      {item.label}
                      {item.badge ? (
                        <span className="veveno-tab-badge">{item.badge}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
                <p className="veveno-tab-hint">{t(TAB_HINT_KEYS[tab])}</p>
              </div>
            ) : (
              <p className="veveno-tab-hint">{t(TAB_HINT_KEYS[tab])}</p>
            )
          ) : null}
        </div>

        {error ? (
          <p className="veveno-notice veveno-notice--error" role="alert">
            {error}
          </p>
        ) : null}

        {store && checklistBanner ? (
          <button
            type="button"
            className="veveno-checklist-banner"
            onClick={() => setTab('checklists')}
          >
            {checklistBanner.title} {checklistBanner.checkedCount}/{checklistBanner.totalCount}
            {checklistOpenCount > 1 ? t('store.checklistMore', { count: checklistOpenCount - 1 }) : ''}
          </button>
        ) : null}

        {store ? (
          <>
            {tab === 'menus' ? (
              menus.length === 0 ? (
                <VevenoEmptyState
                  title={t('menus.emptyTitle')}
                  body={
                    store.owned
                      ? t('menus.emptyBodyOwner')
                      : t('menus.emptyBodyStaff')
                  }
                  action={
                    store.owned ? (
                      <VevenoButton onClick={() => openMenuCreate()}>{t('menus.add')}</VevenoButton>
                    ) : undefined
                  }
                />
              ) : (
              <div className="veveno-stack-lg">
                <div className="veveno-toolbar">
                  <VevenoInput
                    id="menu-tab-search"
                    label={t('common.search')}
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder={t('menus.searchPh')}
                  />
                </div>
                <div className="veveno-menu-layout">
                  <aside className="veveno-menu-rail">
                    <div className="veveno-menu-rail__head">
                      <h2 className="veveno-menu-rail__title">{t('menus.categories')}</h2>
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
                          {menuEditMode ? t('common.editDone') : t('common.edit')}
                        </VevenoButton>
                      ) : null}
                    </div>
                    {store.owned && menuEditMode ? (
                      <form className="veveno-search-row" onSubmit={handleCreateMenu}>
                        <VevenoInput
                          value={menuName}
                          onChange={(e) => setMenuName(e.target.value)}
                          placeholder={t('menus.categoryName')}
                        />
                        <VevenoButton type="submit">{t('common.add')}</VevenoButton>
                      </form>
                    ) : null}
                    <div className="veveno-menu-rail__list">
                      {filteredMenus.length === 0 ? (
                        <p className="veveno-empty">{t('menus.searchNone')}</p>
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
                              <span className="veveno-rail-item__hint">{t('menus.hintEdit')}</span>
                            ) : null}
                          </button>
                        ))
                      )}
                    </div>
                  </aside>

                  <div className="veveno-menu-main">
                    <VevenoCard
                      title={t('menus.recipes')}
                      action={
                        store.owned ? (
                          <div className="veveno-card__actions">
                            <VevenoButton
                              size="sm"
                              onClick={() => openMenuCreate(selectedMenuId ?? undefined)}
                            >
                              {t('common.createNew')}
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
                              {recipeEditMode ? t('common.editDone') : t('common.edit')}
                            </VevenoButton>
                          </div>
                        ) : null
                      }
                    >
                      {!selectedMenuId ? (
                        <p className="veveno-empty">{t('menus.pickMenu')}</p>
                      ) : recipes.length === 0 ? (
                        store.owned && !recipeEditMode ? (
                          <VevenoEmptyState
                            title={t('menus.emptyRecipesTitle')}
                            body={t('menus.emptyRecipesBody')}
                            action={
                              <VevenoButton
                                onClick={() =>
                                  openMenuCreate(selectedMenuId ?? undefined)
                                }
                              >
                                {t('menus.firstRecipe')}
                              </VevenoButton>
                            }
                          />
                        ) : (
                          <p className="veveno-empty">{t('menus.noRecipes')}</p>
                        )
                      ) : filteredRecipes.length === 0 ? (
                        <p className="veveno-empty">{t('menus.searchNone')}</p>
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
                                    {parsed.title || t('menus.recipeFallback')}
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

                    {store.owned && recipeEditMode && selectedMenuId && selectedRecipe ? (
                      <VevenoCard title={t('menus.editRecipe')}>
                        <form className="veveno-form-stack" onSubmit={handleSaveRecipe}>
                          <VevenoInput
                            label={t('common.title')}
                            id="recipe-title"
                            value={recipeForm.title}
                            onChange={(e) =>
                              setRecipeForm((prev) => ({
                                ...prev,
                                title: e.target.value,
                              }))
                            }
                            placeholder={t('menus.recipeTitlePh')}
                          />
                          <div className="veveno-field">
                            <span className="veveno-field__label" id="recipe-notes-label">
                              {t('common.notes')}
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
                              placeholder={t('menus.notesPlaceholder')}
                              rows={8}
                            />
                            <p className="veveno-field__hint">
                              {t('menus.notesHint')}
                            </p>
                          </div>
                          <div className="veveno-btn-row">
                            <VevenoButton type="submit">{t('common.saveEdit')}</VevenoButton>
                            <VevenoButton
                              variant="danger"
                              onClick={() => {
                                void handleDeleteRecipe();
                              }}
                            >
                              {t('common.delete')}
                            </VevenoButton>
                          </div>
                        </form>
                      </VevenoCard>
                    ) : null}
                  </div>
                </div>
              </div>
              )
            ) : null}

            <VevenoStoreStocksPanel
              active={tab === 'stocks' && (canEditStock || isPosKiosk)}
              storeId={storeId}
              owned={store.owned}
              onDuty={store.onDuty}
              stockEditOffDuty={store.stockEditOffDuty}
              canEditStock={canEditStock}
              stockCategories={stockCategories}
              setStockCategories={setStockCategories}
              onError={setError}
            />

            {tab === 'checklists' && (store.owned || store.subscribed) ? (
              <VevenoChecklistPanel
                storeId={storeId}
                owned={store.owned}
                today={todayChecklists}
                onTodayChange={setTodayChecklists}
                onError={setError}
              />
            ) : null}

            {tab === 'schedule' && !isPosKiosk && (store.owned || store.subscribed) ? (
              <VevenoSchedulePanel
                storeId={storeId}
                storeName={store.name}
                owned={store.owned}
                subscribed={store.subscribed}
                onError={setError}
                onGoSettings={() => setTab('settings')}
              />
            ) : null}

            {tab === 'tools' && (store.owned || store.subscribed) ? (
              <VevenoToolsPanel storeId={storeId} />
            ) : null}

            {tab === 'settings' && !isPosKiosk && (store.owned || store.subscribed) ? (
              <div className="veveno-settings-stack">
                <VevenoCard title={t('settings.language')}>
                  <p className="veveno-card-lead">{t('settings.languageHelp')}</p>
                  <VevenoLangSwitch />
                </VevenoCard>
                {store.owned ? (
                <div className="veveno-settings-owner">
                {isDemo ? null : (
                <VevenoCard title={t('settings.posDevices')}>
                  <p className="veveno-card-lead">{t('settings.posDevicesHelp')}</p>
                  {posDevices.length === 0 ? (
                    <p className="veveno-empty">{t('settings.posEmpty')}</p>
                  ) : (
                    <ul className="veveno-pos-device-list">
                      {posDevices.map((device) => (
                        <li key={device.id} className="veveno-pos-device-list__row">
                          <div>
                            <p>…{device.deviceId.slice(-8)}</p>
                            <p className="veveno-shell__meta">
                              {device.enrolledByNickname}
                              {' · '}
                              {formatPosExpiry(device.createdAt)}
                            </p>
                          </div>
                          <VevenoButton
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              void handleRevokePosDevice(device.id);
                            }}
                          >
                            {t('settings.posRevoke')}
                          </VevenoButton>
                        </li>
                      ))}
                    </ul>
                  )}
                </VevenoCard>
                )}
                <VevenoCard title={t('settings.storeInfo')}>
                  <form className="veveno-form-stack" onSubmit={handleSaveStore}>
                    <VevenoInput
                      label={t('hub.storeName')}
                      id="store-name"
                      value={storeForm.name}
                      onChange={(e) =>
                        setStoreForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                    <div className="veveno-check-row">
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
                        {t('settings.publicStore')}
                      </label>
                      <VevenoHelpTip text={t('settings.publicHelp')} />
                    </div>
                    <div className="veveno-check-row">
                      <label className="veveno-check">
                        <input
                          type="checkbox"
                          checked={storeForm.stockEditOffDuty}
                          onChange={(e) =>
                            setStoreForm((prev) => ({
                              ...prev,
                              stockEditOffDuty: e.target.checked,
                            }))
                          }
                        />
                        {t('settings.stockOffDuty')}
                      </label>
                      <VevenoHelpTip text={t('settings.stockOffDutyHelp')} />
                    </div>
                    <div className="veveno-check-row">
                      <label className="veveno-check">
                        <input
                          type="checkbox"
                          checked={storeForm.stockUsageHint}
                          onChange={(e) =>
                            setStoreForm((prev) => ({
                              ...prev,
                              stockUsageHint: e.target.checked,
                            }))
                          }
                        />
                        {t('settings.stockHint')}
                      </label>
                      <VevenoHelpTip text={t('settings.stockHintHelp')} />
                    </div>
                    <div className="veveno-invite-code">
                      <div className="veveno-check-row">
                        <p className="veveno-field__label">{t('settings.inviteCode')}</p>
                        <VevenoHelpTip text={t('settings.inviteHelp')} />
                      </div>
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
                                ? t('common.copied')
                                : t('common.tapToCopy')
                              : undefined
                          }
                          aria-label={
                            store.inviteCode
                              ? t('settings.inviteCodeAria', { code: store.inviteCode })
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
                      <VevenoButton type="submit">{t('common.saveEdit')}</VevenoButton>
                      <VevenoButton
                        type="button"
                        variant="secondary"
                        loading={regeneratingCode}
                        onClick={() => {
                          void handleRegenerateInviteCode();
                        }}
                      >
                        {t('settings.regenerate')}
                      </VevenoButton>
                    </div>
                  </form>
                </VevenoCard>

                <VevenoCard title={t('settings.joinApprove')}>
                  {joinRequests.length === 0 ? (
                    <p className="veveno-empty">{t('settings.joinEmpty')}</p>
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
                              {t('common.approve')}
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
                              {t('common.reject')}
                            </VevenoButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </VevenoCard>

                <VevenoCard title={t('settings.staffPerms')}>
                  <p className="veveno-card-lead">
                    {t('settings.staffPermsLead')}
                  </p>
                  {subscribers.length === 0 ? (
                    <p className="veveno-empty">{t('settings.noSubscribers')}</p>
                  ) : (
                    <div className="veveno-stack">
                      {subscribers.map((sub) => (
                        <div key={sub.userId} className="veveno-search-result">
                          <div>
                            <p className="veveno-store-row__name">{sub.nickname}</p>
                            <p className="veveno-store-row__sub">
                              {sub.email}
                              {sub.workStartDate
                                ? ` · ${t('settings.workStart', { date: sub.workStartDate })}`
                                : ''}
                              {sub.leaveDate
                                ? ` · ${t('settings.leaveSoon', { date: sub.leaveDate })}`
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
                                        getVevenoErrorMessage(err, t('errors.failPermission'), t),
                                      );
                                    }
                                  })();
                                }}
                              />
                              {t('settings.stockEdit')}
                            </label>
                            {sub.leaveDate ? (
                              <VevenoButton
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  void handleClearLeave(sub.userId)
                                }
                              >
                                {t('settings.cancelLeave')}
                              </VevenoButton>
                            ) : (
                              <VevenoButton
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  openLeaveDialog({
                                    userId: sub.userId,
                                    nickname: sub.nickname,
                                  })
                                }
                              >
                                {t('settings.leave')}
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
                    {isDemo ? t('store.demoExit') : t('settings.deleteStore')}
                  </VevenoButton>
                </div>
                </div>
                ) : null}
              </div>
            ) : null}

          </>
        ) : null}
      </div>

      <VevenoPosScanModal
        open={posScanOpen}
        storeId={storeId}
        onClose={() => setPosScanOpen(false)}
      />
      <VevenoModal open={noticesOpen} title={t('store.notices')} onClose={closeNotices}>
        <div className="veveno-stack-lg">
          {store?.owned ? (
            <form className="veveno-form-stack veveno-notice-form" onSubmit={(e) => void handleSaveNotice(e)}>
              <VevenoInput
                label={editingNoticeId ? t('notices.editTitle') : t('notices.newTitle')}
                value={noticeForm.title}
                onChange={(e) =>
                  setNoticeForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder={t('notices.titlePh')}
                disabled={savingNotice}
              />
              <div className="veveno-field">
                <label className="veveno-field__label" htmlFor="notice-body">
                  {t('notices.body')}
                </label>
                <textarea
                  id="notice-body"
                  className="veveno-field__input veveno-notice-body"
                  rows={5}
                  value={noticeForm.body}
                  onChange={(e) =>
                    setNoticeForm((prev) => ({ ...prev, body: e.target.value }))
                  }
                  placeholder={t('notices.bodyPh')}
                  disabled={savingNotice}
                />
              </div>
              <div className="veveno-btn-row">
                <VevenoButton
                  type="submit"
                  loading={savingNotice}
                  disabled={!noticeForm.title.trim() || !noticeForm.body.trim()}
                >
                  {editingNoticeId ? t('notices.saveEdit') : t('notices.create')}
                </VevenoButton>
                {editingNoticeId ? (
                  <VevenoButton
                    type="button"
                    variant="secondary"
                    disabled={savingNotice}
                    onClick={cancelNoticeEdit}
                  >
                    {t('notices.cancelEdit')}
                  </VevenoButton>
                ) : null}
              </div>
            </form>
          ) : null}

          {notices.length === 0 ? (
            <p className="veveno-empty">{t('notices.empty')}</p>
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
                        {t('common.edit')}
                      </VevenoButton>
                      <VevenoButton
                        size="sm"
                        variant="danger"
                        disabled={savingNotice}
                        onClick={() => void handleDeleteNotice(notice.id)}
                      >
                        {t('common.delete')}
                      </VevenoButton>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}

          <div className="veveno-modal__actions">
            <VevenoButton variant="secondary" onClick={closeNotices} disabled={savingNotice}>
              {t('common.close')}
            </VevenoButton>
          </div>
        </div>
      </VevenoModal>

      <VevenoModal
        open={menuCreateOpen}
        title={t('menus.register')}
        onClose={closeMenuCreate}
        closeOnBackdrop={!creatingMenuRecipe}
      >
        <form className="veveno-form-stack" onSubmit={handleCreateMenuRecipe}>
          {error ? (
            <p className="veveno-notice veveno-notice--error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="veveno-field">
            <label className="veveno-field__label" htmlFor="menu-create-category">
              {t('menus.category')}
            </label>
            <select
              id="menu-create-category"
              className="veveno-field__input"
              value={menuCreateForm.categoryKey}
              onChange={(e) =>
                setMenuCreateForm((prev) => ({
                  ...prev,
                  categoryKey: e.target.value,
                  customCategoryName:
                    e.target.value === '__custom__' ? prev.customCategoryName : '',
                }))
              }
              disabled={creatingMenuRecipe}
            >
              <option value="">{t('menus.pickCategory')}</option>
              {menus.map((menu) => (
                <option key={menu.id} value={menu.id}>
                  {menu.name}
                </option>
              ))}
              <option value="__custom__">{t('units.custom')}</option>
            </select>
          </div>
          {menuCreateForm.categoryKey === '__custom__' ? (
            <VevenoInput
              label={t('menus.categoryName')}
              value={menuCreateForm.customCategoryName}
              onChange={(e) =>
                setMenuCreateForm((prev) => ({
                  ...prev,
                  customCategoryName: e.target.value,
                }))
              }
              placeholder={t('menus.newCategoryPh')}
              disabled={creatingMenuRecipe}
            />
          ) : null}
          <VevenoInput
            label={t('common.title')}
            value={menuCreateForm.title}
            onChange={(e) =>
              setMenuCreateForm((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder={t('menus.menuTitlePh')}
            disabled={creatingMenuRecipe}
          />
          <div className="veveno-field">
            <span className="veveno-field__label" id="menu-create-notes-label">
              {t('common.notes')}
            </span>
                            <VevenoRecipeNotesEditor
              id="menu-create-notes"
              value={menuCreateForm.notes}
              onChange={(notes) =>
                setMenuCreateForm((prev) => ({ ...prev, notes }))
              }
              placeholder={t('menus.notesPlaceholder')}
              rows={6}
              disabled={creatingMenuRecipe}
            />
            <p className="veveno-field__hint">
              {t('menus.notesHint')}
            </p>
          </div>
          <div className="veveno-modal__actions">
            <VevenoButton
              variant="secondary"
              disabled={creatingMenuRecipe}
              onClick={closeMenuCreate}
            >
              {t('common.cancel')}
            </VevenoButton>
            <VevenoButton type="submit" loading={creatingMenuRecipe}>
              {t('common.add')}
            </VevenoButton>
          </div>
        </form>
      </VevenoModal>

      <VevenoModal
        open={menuEditOpen}
        title={t('menus.editMenu')}
        onClose={closeMenuEditModal}
        closeOnBackdrop={!savingMenu}
      >
        <form className="veveno-form-stack" onSubmit={handleSaveMenuName}>
          <VevenoInput
            label={t('common.name')}
            id="edit-menu-name"
            value={editingMenuName}
            onChange={(e) => setEditingMenuName(e.target.value)}
            placeholder={t('menus.categoryName')}
            disabled={savingMenu}
          />
          <div className="veveno-modal__actions">
            <VevenoButton type="submit" disabled={savingMenu || !editingMenuName.trim()}>
              {savingMenu ? t('common.saving') : t('common.save')}
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
              {t('common.delete')}
            </VevenoButton>
            <VevenoButton
              type="button"
              variant="secondary"
              disabled={savingMenu}
              onClick={closeMenuEditModal}
            >
              {t('common.cancel')}
            </VevenoButton>
          </div>
        </form>
      </VevenoModal>

      <VevenoModal
        open={recipeViewOpen}
        title={viewRecipeContent.title || t('menus.recipeFallback')}
        onClose={() => setRecipeViewOpen(false)}
      >
        <div className="veveno-recipe-view">
          {viewRecipeContent.notes ? (
            <VevenoRecipeNotesView notes={viewRecipeContent.notes} />
          ) : (
            <p className="veveno-empty">{t('menus.noNotes')}</p>
          )}
        </div>
        <div className="veveno-modal__actions">
          <VevenoButton variant="secondary" onClick={() => setRecipeViewOpen(false)}>
            {t('common.close')}
          </VevenoButton>
        </div>
      </VevenoModal>

      <VevenoModal
        open={Boolean(interruptList)}
        title={interruptList ? interruptList.title : t('store.tabs.checklists')}
        onClose={() => {
          if (interruptList) {
            sessionStorage.setItem(interruptKey(storeId, interruptList.templateId), '1');
          }
          setInterruptId(null);
        }}
      >
        {interruptList ? (
          <ul className="veveno-checklist">
            {interruptList.items.map((item) => (
              <li key={item.id}>
                <label className="veveno-check">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(event) =>
                      void handleTodayCheck(
                        interruptList.templateId,
                        item.id,
                        event.target.checked,
                      )
                    }
                  />
                  {item.body}
                </label>
              </li>
            ))}
          </ul>
        ) : null}
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
        title={t('settings.leaveTitle', { nickname: leaveTarget?.nickname ?? '' })}
        onClose={() => {
          if (!leaving) {
            setLeaveOpen(false);
            setLeaveTarget(null);
          }
        }}
      >
        <form className="veveno-form-stack" onSubmit={(e) => void handleConfirmLeave(e)}>
          <p className="veveno-card-lead">
            {t('settings.leaveLead')}
          </p>
          <VevenoInput
            label={t('settings.leaveDate')}
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
              {t('common.cancel')}
            </VevenoButton>
            <VevenoButton type="submit" variant="danger" loading={leaving}>
              {t('settings.leaveSubmit')}
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
