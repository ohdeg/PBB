import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { brewApi } from '../api/brewApi';
import { BrewBadge } from '../components/brew/BrewBadge';
import { BrewButton } from '../components/brew/BrewButton';
import { BrewCard } from '../components/brew/BrewCard';
import { BrewInput } from '../components/brew/BrewInput';
import { BrewStoreDeleteDialog } from '../components/brew/BrewStoreDeleteDialog';
import { BrewModal } from '../components/brew/BrewModal';
import { BrewRecipeNotesEditor } from '../components/brew/BrewRecipeNotesEditor';
import { BrewRecipeNotesView } from '../components/brew/BrewRecipeNotesView';
import { BrewSchedulePanel } from '../components/brew/BrewSchedulePanel';
import { BrewToolsPanel } from '../components/brew/BrewToolsPanel';
import {
  VevenoSplashScreen,
  useVevenoSplash,
} from '../components/brew/VevenoSplashScreen';
import { BrewVisibilityBadge } from '../components/brew/BrewVisibilityBadge';
import { useAuthStore } from '../stores/authStore';
import type {
  BrewJoinRequest,
  BrewMenu,
  BrewRecipe,
  BrewRecipeContent,
  BrewStockCategory,
  BrewStore,
  BrewSubscriber,
} from '../types/brew';
import {
  EMPTY_RECIPE_CONTENT,
  parseRecipeContents,
  stringifyRecipeContents,
} from '../types/brew';
import { getErrorMessage } from '../utils/error';

type Tab = 'menus' | 'stocks' | 'schedule' | 'tools' | 'settings';

export function BrewStorePage() {
  const { storeId = '' } = useParams();
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { showSplash, handleSplashFinish } = useVevenoSplash();

  const [tab, setTab] = useState<Tab>('menus');
  const [store, setStore] = useState<BrewStore | null>(null);
  const [menus, setMenus] = useState<BrewMenu[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<BrewRecipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [stockCategories, setStockCategories] = useState<BrewStockCategory[]>([]);
  const [joinRequests, setJoinRequests] = useState<BrewJoinRequest[]>([]);
  const [subscribers, setSubscribers] = useState<BrewSubscriber[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stockCreateOpen, setStockCreateOpen] = useState(false);
  const [recipeEditMode, setRecipeEditMode] = useState(false);
  const [menuEditMode, setMenuEditMode] = useState(false);
  const [categoryEditMode, setCategoryEditMode] = useState(false);
  const [menuEditOpen, setMenuEditOpen] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [editingMenuName, setEditingMenuName] = useState('');
  const [savingMenu, setSavingMenu] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [recipeViewOpen, setRecipeViewOpen] = useState(false);
  const [viewRecipeContent, setViewRecipeContent] =
    useState<BrewRecipeContent>(EMPTY_RECIPE_CONTENT);

  const [menuName, setMenuName] = useState('');
  const [menuSearch, setMenuSearch] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [recipeForm, setRecipeForm] = useState<BrewRecipeContent>(EMPTY_RECIPE_CONTENT);
  const [storeForm, setStoreForm] = useState({ name: '', isPublic: false });
  const [stockForm, setStockForm] = useState({
    categoryKey: '',
    customCategoryName: '',
    stockName: '',
    stockNum: 0,
    stockMinNum: 0,
  });
  const [creatingStock, setCreatingStock] = useState(false);

  const loadStore = useCallback(async () => {
    if (!storeId || !accessToken) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await brewApi.getStore(storeId);
      setStore(data);
      setStoreForm({ name: data.name, isPublic: data.isPublic });
      const menusRes = await brewApi.listMenus(storeId);
      setMenus(menusRes.data);
      if (data.canEditStock) {
        const stocksRes = await brewApi.listStocks(storeId);
        setStockCategories(stocksRes.data);
      } else {
        setStockCategories([]);
      }
      if (data.owned) {
        const [joinsRes, subsRes] = await Promise.all([
          brewApi.listJoinRequests(storeId),
          brewApi.listSubscribers(storeId),
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
  }, [accessToken, storeId]);

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
    if (tab === 'stocks' && store && !store.canEditStock) {
      setTab('menus');
    }
    if (tab === 'schedule' && store && !store.owned && !store.subscribed) {
      setTab('menus');
    }
    if (tab === 'tools' && store && !store.owned && !store.subscribed) {
      setTab('menus');
    }
    if (tab === 'settings' && store && !store.owned) {
      setTab('menus');
    }
  }, [tab, store]);

  useEffect(() => {
    if (tab !== 'stocks' || !storeId || !accessToken || !store?.canEditStock) {
      return;
    }
    void (async () => {
      try {
        const { data } = await brewApi.getStore(storeId);
        setStore(data);
      } catch {
        /* keep previous store snapshot */
      }
    })();
  }, [tab, storeId, accessToken, store?.canEditStock]);

  useEffect(() => {
    if (!selectedMenuId) {
      setRecipes([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await brewApi.listRecipes(selectedMenuId);
        if (!cancelled) {
          setRecipes(data);
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

  if (!accessToken) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `/hobbies/brew-note/stores/${storeId}` }}
      />
    );
  }

  const handleCreateMenu = async (event: FormEvent) => {
    event.preventDefault();
    if (!menuName.trim() || !store?.owned) return;
    try {
      const { data } = await brewApi.createMenu(storeId, menuName.trim());
      setMenus((prev) => [...prev, data]);
      setMenuName('');
      setSelectedMenuId(data.id);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '메뉴 추가에 실패했습니다.'));
    }
  };

  const selectMenu = (menu: BrewMenu) => {
    setSelectedMenuId(menu.id);
    setSelectedRecipeId(null);
    setRecipeForm(EMPTY_RECIPE_CONTENT);
  };

  const openMenuEditModal = (menu: BrewMenu) => {
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
      const { data } = await brewApi.updateMenu(editingMenuId, editingMenuName.trim());
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
      await brewApi.deleteMenu(menuId);
      setMenus((prev) => prev.filter((m) => m.id !== menuId));
      if (selectedMenuId === menuId) {
        setSelectedMenuId(null);
        setRecipes([]);
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
        const { data } = await brewApi.updateRecipe(selectedRecipeId, contents);
        setRecipes((prev) => prev.map((r) => (r.id === data.id ? data : r)));
      } else {
        const { data } = await brewApi.createRecipe(selectedMenuId, contents);
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
      await brewApi.deleteRecipe(selectedRecipeId);
      setRecipes((prev) => prev.filter((r) => r.id !== selectedRecipeId));
      setSelectedRecipeId(null);
      setRecipeForm(EMPTY_RECIPE_CONTENT);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '레시피 삭제에 실패했습니다.'));
    }
  };

  const handleCreateCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryName.trim() || !canMutateStock) return;
    try {
      const { data } = await brewApi.createStockCategory(storeId, categoryName.trim());
      setStockCategories((prev) => [...prev, data]);
      setCategoryName('');
      setSelectedCategoryId(data.id);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '카테고리 추가에 실패했습니다.'));
    }
  };

  const handleSaveCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCategoryId || !categoryName.trim() || !canMutateStock) {
      return;
    }
    setError('');
    try {
      const { data } = await brewApi.updateStockCategory(
        selectedCategoryId,
        categoryName.trim(),
      );
      setStockCategories((prev) =>
        prev.map((cat) => (cat.id === data.id ? { ...cat, ...data } : cat)),
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, '카테고리 수정에 실패했습니다.'));
    }
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategoryId || !canMutateStock) {
      return;
    }
    if (!window.confirm('카테고리와 하위 재고를 삭제할까요?')) {
      return;
    }
    setError('');
    try {
      await brewApi.deleteStockCategory(selectedCategoryId);
      setStockCategories((prev) => prev.filter((c) => c.id !== selectedCategoryId));
      setSelectedCategoryId(null);
      setCategoryName('');
    } catch (err: unknown) {
      setError(getErrorMessage(err, '카테고리 삭제에 실패했습니다.'));
    }
  };

  const handleCreateStock = async (event: FormEvent) => {
    event.preventDefault();
    if (!canMutateStock || !stockForm.stockName.trim()) {
      return;
    }

    const isCustom = stockForm.categoryKey === '__custom__';
    if (!stockForm.categoryKey) {
      setError('카테고리를 선택해 주세요.');
      return;
    }
    if (isCustom && !stockForm.customCategoryName.trim()) {
      setError('카테고리 이름을 입력해 주세요.');
      return;
    }

    setCreatingStock(true);
    setError('');
    try {
      let categoryId: number;
      let createdCategory: BrewStockCategory | null = null;

      if (isCustom) {
        const name = stockForm.customCategoryName.trim();
        const existing = stockCategories.find(
          (cat) => cat.categoryName.toLowerCase() === name.toLowerCase(),
        );
        if (existing) {
          categoryId = existing.id;
        } else {
          const { data } = await brewApi.createStockCategory(storeId, name);
          createdCategory = data;
          categoryId = data.id;
        }
      } else {
        categoryId = Number(stockForm.categoryKey);
        if (!Number.isFinite(categoryId) || categoryId <= 0) {
          setError('카테고리를 선택해 주세요.');
          return;
        }
      }

      const { data } = await brewApi.createStock(categoryId, {
        stockName: stockForm.stockName.trim(),
        stockNum: stockForm.stockNum,
        stockMinNum: stockForm.stockMinNum,
      });

      setStockCategories((prev) => {
        if (createdCategory) {
          return [...prev, { ...createdCategory, stocks: [data] }];
        }
        return prev.map((cat) =>
          cat.id === data.categoryId
            ? { ...cat, stocks: [...cat.stocks, data] }
            : cat,
        );
      });

      setStockForm({
        categoryKey: isCustom ? '__custom__' : String(categoryId),
        customCategoryName: '',
        stockName: '',
        stockNum: 0,
        stockMinNum: 0,
      });
      setStockCreateOpen(false);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '재고 추가에 실패했습니다.'));
    } finally {
      setCreatingStock(false);
    }
  };

  const handleUpdateStockQty = async (
    stockId: number,
    categoryId: number,
    stockName: string,
    stockNum: number,
    stockMinNum: number | null,
  ) => {
    try {
      const { data } = await brewApi.updateStock(stockId, {
        stockName,
        stockNum,
        stockMinNum,
      });
      setStockCategories((prev) =>
        prev.map((cat) =>
          cat.id === categoryId
            ? {
                ...cat,
                stocks: cat.stocks.map((s) => (s.id === data.id ? data : s)),
              }
            : cat,
        ),
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, '재고 수량 변경에 실패했습니다.'));
    }
  };

  const handleSaveStore = async (event: FormEvent) => {
    event.preventDefault();
    if (!store?.owned) return;
    try {
      const { data } = await brewApi.updateStore(storeId, storeForm);
      setStore(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '가게 설정 저장에 실패했습니다.'));
    }
  };

  const handleDeleteStore = async () => {
    setDeleting(true);
    setError('');
    try {
      await brewApi.deleteStore(storeId);
      setDeleteDialogOpen(false);
      void navigate('/hobbies/brew-note');
    } catch (err: unknown) {
      setError(getErrorMessage(err, '가게 삭제에 실패했습니다.'));
    } finally {
      setDeleting(false);
    }
  };

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId) ?? null;
  const canEditStock = Boolean(store?.canEditStock);
  const canMutateStock = Boolean(
    store?.canEditStock && (store.owned || store.onDuty),
  );

  const normalizedMenuSearch = menuSearch.trim().toLowerCase();
  const normalizedStockSearch = stockSearch.trim().toLowerCase();

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

  const filteredStockCategories = useMemo(() => {
    if (!normalizedStockSearch) {
      return stockCategories;
    }
    return stockCategories
      .map((cat) => {
        const categoryMatched = cat.categoryName.toLowerCase().includes(normalizedStockSearch);
        const matchedStocks = cat.stocks.filter((stock) =>
          stock.stockName.toLowerCase().includes(normalizedStockSearch),
        );
        if (categoryMatched) {
          return cat;
        }
        if (matchedStocks.length === 0) {
          return null;
        }
        return { ...cat, stocks: matchedStocks };
      })
      .filter((cat): cat is BrewStockCategory => cat != null);
  }, [stockCategories, normalizedStockSearch]);

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
        <main className="brew-shell">
          <div className="brew-shell__inner brew-shell__loading">Loading…</div>
        </main>
      ) : (
      <main className="brew-shell">
      <div className="brew-shell__inner brew-shell__inner--wide">
        <div className="brew-detail-head">
          <div>
            <Link to="/hobbies/brew-note" className="brew-shell__back">
              ← Veveno
            </Link>
            {store ? (
              <>
                <h1>{store.name}</h1>
                <p className="brew-shell__meta">
                  {store.owned ? 'Owner' : store.subscribed ? 'Staff' : 'Guest'}
                  {' · '}
                  <BrewVisibilityBadge isPublic={store.isPublic} />
                </p>
              </>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="brew-notice brew-notice--error" role="alert">
            {error}
          </p>
        ) : null}

        {store ? (
          <>
            {visibleTabs.length > 1 ? (
              <div className="brew-seg-tabs-wrap">
                <div
                  className="brew-seg-tabs brew-seg-tabs--sticky"
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
              <div className="brew-stack-lg">
                <div className="brew-toolbar">
                  <BrewInput
                    id="menu-tab-search"
                    label="검색"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="메뉴·레시피 이름 검색"
                  />
                </div>
                <div className="brew-menu-layout">
                  <aside className="brew-menu-rail">
                    <div className="brew-menu-rail__head">
                      <h2 className="brew-menu-rail__title">카테고리</h2>
                      {store.owned ? (
                        <BrewButton
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
                        </BrewButton>
                      ) : null}
                    </div>
                    {store.owned && menuEditMode ? (
                      <form className="brew-search-row" onSubmit={handleCreateMenu}>
                        <BrewInput
                          value={menuName}
                          onChange={(e) => setMenuName(e.target.value)}
                          placeholder="메뉴 이름"
                        />
                        <BrewButton type="submit">추가</BrewButton>
                      </form>
                    ) : null}
                    <div className="brew-menu-rail__list">
                      {menus.length === 0 ? (
                        <p className="brew-empty">메뉴가 없습니다.</p>
                      ) : filteredMenus.length === 0 ? (
                        <p className="brew-empty">검색 결과가 없습니다.</p>
                      ) : (
                        filteredMenus.map((menu) => (
                          <button
                            key={menu.id}
                            type="button"
                            className={
                              menu.id === selectedMenuId
                                ? 'brew-rail-item is-active'
                                : 'brew-rail-item'
                            }
                            onClick={() => openMenuEditModal(menu)}
                          >
                            <span className="brew-rail-item__name">{menu.name}</span>
                            {store.owned && menuEditMode ? (
                              <span className="brew-rail-item__hint">수정</span>
                            ) : null}
                          </button>
                        ))
                      )}
                    </div>
                  </aside>

                  <div className="brew-menu-main">
                    <BrewCard
                      title="레시피"
                      action={
                        store.owned ? (
                          <div className="brew-card__actions">
                            <BrewButton
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
                            </BrewButton>
                            <BrewButton
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
                            </BrewButton>
                          </div>
                        ) : null
                      }
                    >
                      {!selectedMenuId ? (
                        <p className="brew-empty">왼쪽에서 메뉴를 선택해 주세요.</p>
                      ) : recipes.length === 0 ? (
                        <p className="brew-empty">등록된 레시피가 없습니다.</p>
                      ) : filteredRecipes.length === 0 ? (
                        <p className="brew-empty">검색 결과가 없습니다.</p>
                      ) : (
                        <div className="brew-stack">
                          {filteredRecipes.map((recipe) => {
                            const parsed = parseRecipeContents(recipe.contents);
                            return (
                              <button
                                key={recipe.id}
                                type="button"
                                className={
                                  recipeEditMode && recipe.id === selectedRecipeId
                                    ? 'brew-store-row is-clickable is-selected'
                                    : 'brew-store-row is-clickable'
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
                                <div className="brew-store-row__main">
                                  <p className="brew-store-row__name">
                                    {parsed.title || '레시피'}
                                  </p>
                                  {parsed.notes ? (
                                    <p className="brew-store-row__sub">
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
                    </BrewCard>

                    {store.owned && recipeEditMode && selectedMenuId ? (
                      <BrewCard title={selectedRecipe ? '레시피 편집' : '레시피 추가'}>
                        <form className="brew-form-stack" onSubmit={handleSaveRecipe}>
                          <BrewInput
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
                          <div className="brew-field">
                            <span className="brew-field__label" id="recipe-notes-label">
                              노트
                            </span>
                            <BrewRecipeNotesEditor
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
                            <p className="brew-field__hint">
                              구분점·번호 목록은 툴바에서, 들여쓰기는 Tab / Shift+Tab 또는
                              툴바로 조절합니다.
                            </p>
                          </div>
                          <div className="brew-btn-row">
                            <BrewButton type="submit">
                              {selectedRecipe ? '저장/수정' : '레시피 추가'}
                            </BrewButton>
                            {selectedRecipe ? (
                              <BrewButton
                                variant="danger"
                                onClick={() => {
                                  void handleDeleteRecipe();
                                }}
                              >
                                삭제
                              </BrewButton>
                            ) : null}
                          </div>
                        </form>
                      </BrewCard>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'stocks' && canEditStock ? (
              <div className="brew-stack-lg">
                {!canMutateStock ? (
                  <p className="brew-duty-banner">
                    근무 시간이 아니라 재고를 수정할 수 없습니다. 조회만 가능합니다.
                  </p>
                ) : null}
                <div className="brew-toolbar brew-toolbar--stock">
                  <BrewInput
                    id="stock-tab-search"
                    label="검색"
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    placeholder="카테고리·재고 이름 검색"
                  />
                  {canMutateStock ? (
                    <div className="brew-toolbar__actions">
                      <BrewButton
                        size="sm"
                        variant={categoryEditMode ? 'secondary' : 'ghost'}
                        onClick={() => {
                          setCategoryEditMode((prev) => {
                            const next = !prev;
                            if (!next) {
                              setSelectedCategoryId(null);
                              setCategoryName('');
                            }
                            return next;
                          });
                        }}
                      >
                        {categoryEditMode ? '카테고리 편집 종료' : '카테고리 편집'}
                      </BrewButton>
                      <BrewButton
                        size="sm"
                        onClick={() => {
                          setError('');
                          setStockCreateOpen(true);
                        }}
                      >
                        + 재고 추가
                      </BrewButton>
                    </div>
                  ) : null}
                </div>

                {canMutateStock && categoryEditMode ? (
                  <div className="brew-stock-edit-grid">
                    <BrewCard title="카테고리">
                      {stockCategories.length === 0 ? (
                        <p className="brew-empty">등록된 카테고리가 없습니다.</p>
                      ) : filteredStockCategories.length === 0 ? (
                        <p className="brew-empty">검색 결과가 없습니다.</p>
                      ) : (
                        <div className="brew-stack">
                          {filteredStockCategories.map((cat) => {
                            const selected = cat.id === selectedCategoryId;
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                className={
                                  selected
                                    ? 'brew-store-row is-clickable is-selected'
                                    : 'brew-store-row is-clickable'
                                }
                                onClick={() => {
                                  setSelectedCategoryId(cat.id);
                                  setCategoryName(cat.categoryName);
                                }}
                              >
                                <div className="brew-store-row__main">
                                  <p className="brew-store-row__name">{cat.categoryName}</p>
                                  <p className="brew-store-row__sub">
                                    재고 {cat.stocks.length}개
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </BrewCard>
                    <BrewCard
                      title="카테고리 편집"
                      action={
                        <BrewButton
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedCategoryId(null);
                            setCategoryName('');
                          }}
                        >
                          새로 작성
                        </BrewButton>
                      }
                    >
                      <form
                        className="brew-form-stack"
                        onSubmit={
                          selectedCategoryId ? handleSaveCategory : handleCreateCategory
                        }
                      >
                        <BrewInput
                          label="이름"
                          id="category-name"
                          value={categoryName}
                          onChange={(e) => setCategoryName(e.target.value)}
                          placeholder="카테고리 이름 (예: 원두)"
                        />
                        <div className="brew-btn-row">
                          <BrewButton type="submit">
                            {selectedCategoryId ? '저장/수정' : '카테고리 추가'}
                          </BrewButton>
                          {selectedCategoryId ? (
                            <BrewButton
                              variant="danger"
                              onClick={() => {
                                void handleDeleteCategory();
                              }}
                            >
                              삭제
                            </BrewButton>
                          ) : null}
                        </div>
                      </form>
                    </BrewCard>
                  </div>
                ) : null}

                <BrewCard title="재고 목록">
                  {stockCategories.length === 0 ? (
                    <p className="brew-empty">표시할 재고가 없습니다.</p>
                  ) : filteredStockCategories.length === 0 ? (
                    <p className="brew-empty">검색 결과가 없습니다.</p>
                  ) : (
                    <div className="brew-stack-lg">
                      {filteredStockCategories.map((cat) => (
                        <div key={cat.id} className="brew-stock-block-inline">
                          <h3 className="brew-subsection-title">{cat.categoryName}</h3>
                          {cat.stocks.length === 0 ? (
                            <p className="brew-empty">항목이 없습니다.</p>
                          ) : (
                            <div className="brew-stack">
                              {cat.stocks.map((stock) => (
                                <div
                                  key={stock.id}
                                  className={`brew-stock-row${stock.lowStock ? ' is-low' : ''}`}
                                >
                                  <div className="brew-stock-row__info">
                                    <p className="brew-store-row__name">{stock.stockName}</p>
                                    <p className="brew-store-row__sub">
                                      경고선 {stock.stockMinNum ?? 0}
                                    </p>
                                  </div>
                                  <div className="brew-stock-row__qty">
                                    {stock.lowStock ? (
                                      <BrewBadge variant="danger">부족</BrewBadge>
                                    ) : null}
                                    {canMutateStock ? (
                                      <>
                                        <BrewButton
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => {
                                            void handleUpdateStockQty(
                                              stock.id,
                                              cat.id,
                                              stock.stockName,
                                              Math.max(0, stock.stockNum - 1),
                                              stock.stockMinNum,
                                            );
                                          }}
                                        >
                                          −
                                        </BrewButton>
                                        <span className="brew-stock-num">{stock.stockNum}</span>
                                        <BrewButton
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => {
                                            void handleUpdateStockQty(
                                              stock.id,
                                              cat.id,
                                              stock.stockName,
                                              stock.stockNum + 1,
                                              stock.stockMinNum,
                                            );
                                          }}
                                        >
                                          +
                                        </BrewButton>
                                      </>
                                    ) : (
                                      <span className="brew-stock-num">{stock.stockNum}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </BrewCard>
              </div>
            ) : null}

            {tab === 'schedule' && (store.owned || store.subscribed) ? (
              <BrewSchedulePanel
                storeId={storeId}
                owned={store.owned}
                subscribed={store.subscribed}
                onError={setError}
              />
            ) : null}

            {tab === 'tools' && (store.owned || store.subscribed) ? (
              <BrewToolsPanel storeId={storeId} />
            ) : null}

            {tab === 'settings' && store.owned ? (
              <div className="brew-settings-stack">
                <BrewCard title="업장 정보">
                  <form className="brew-form-stack" onSubmit={handleSaveStore}>
                    <BrewInput
                      label="가게 이름"
                      id="store-name"
                      value={storeForm.name}
                      onChange={(e) =>
                        setStoreForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                    <label className="brew-check">
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
                    <div className="brew-btn-row">
                      <BrewButton type="submit">저장/수정</BrewButton>
                      <BrewButton
                        variant="danger"
                        onClick={() => setDeleteDialogOpen(true)}
                      >
                        가게 삭제
                      </BrewButton>
                    </div>
                  </form>
                </BrewCard>

                <BrewCard title="가입 승인">
                  {joinRequests.length === 0 ? (
                    <p className="brew-empty">대기 중인 신청이 없습니다.</p>
                  ) : (
                    <div className="brew-stack">
                      {joinRequests.map((req) => (
                        <div key={req.userId} className="brew-search-result">
                          <div>
                            <p className="brew-store-row__name">{req.nickname}</p>
                            <p className="brew-store-row__sub">{req.email}</p>
                          </div>
                          <div className="brew-search-result__actions">
                            <BrewButton
                              size="sm"
                              onClick={() => {
                                void (async () => {
                                  try {
                                    await brewApi.approveJoin(storeId, req.userId);
                                    setJoinRequests((prev) =>
                                      prev.filter((r) => r.userId !== req.userId),
                                    );
                                    const { data } = await brewApi.listSubscribers(storeId);
                                    setSubscribers(data);
                                  } catch (err: unknown) {
                                    setError(getErrorMessage(err, '승인에 실패했습니다.'));
                                  }
                                })();
                              }}
                            >
                              승인
                            </BrewButton>
                            <BrewButton
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                void (async () => {
                                  await brewApi.rejectJoin(storeId, req.userId);
                                  setJoinRequests((prev) =>
                                    prev.filter((r) => r.userId !== req.userId),
                                  );
                                })();
                              }}
                            >
                              거절
                            </BrewButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </BrewCard>

                <BrewCard title="직원 · 재고 권한">
                  <p className="brew-card-lead">
                    재고 수정 권한을 켠 구독자만 재고 탭이 보이며, 수량·등록을 변경할 수 있습니다.
                  </p>
                  {subscribers.length === 0 ? (
                    <p className="brew-empty">구독자가 없습니다.</p>
                  ) : (
                    <div className="brew-stack">
                      {subscribers.map((sub) => (
                        <div key={sub.userId} className="brew-search-result">
                          <div>
                            <p className="brew-store-row__name">{sub.nickname}</p>
                            <p className="brew-store-row__sub">{sub.email}</p>
                          </div>
                          <label className="brew-check">
                            <input
                              type="checkbox"
                              checked={sub.canEditStock}
                              onChange={(e) => {
                                const next = e.target.checked;
                                void (async () => {
                                  try {
                                    const { data } = await brewApi.updateStockPermission(
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
                        </div>
                      ))}
                    </div>
                  )}
                </BrewCard>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <BrewModal
        open={menuEditOpen}
        title="메뉴 수정"
        onClose={closeMenuEditModal}
        closeOnBackdrop={!savingMenu}
      >
        <form className="brew-form-stack" onSubmit={handleSaveMenuName}>
          <BrewInput
            label="이름"
            id="edit-menu-name"
            value={editingMenuName}
            onChange={(e) => setEditingMenuName(e.target.value)}
            placeholder="메뉴 이름"
            disabled={savingMenu}
          />
          <div className="brew-modal__actions">
            <BrewButton type="submit" disabled={savingMenu || !editingMenuName.trim()}>
              {savingMenu ? '저장 중…' : '저장'}
            </BrewButton>
            <BrewButton
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
            </BrewButton>
            <BrewButton
              type="button"
              variant="secondary"
              disabled={savingMenu}
              onClick={closeMenuEditModal}
            >
              취소
            </BrewButton>
          </div>
        </form>
      </BrewModal>

      <BrewModal
        open={recipeViewOpen}
        title={viewRecipeContent.title || '레시피'}
        onClose={() => setRecipeViewOpen(false)}
      >
        <div className="brew-recipe-view">
          {viewRecipeContent.notes ? (
            <BrewRecipeNotesView notes={viewRecipeContent.notes} />
          ) : (
            <p className="brew-empty">노트가 없습니다.</p>
          )}
        </div>
        <div className="brew-modal__actions">
          <BrewButton variant="secondary" onClick={() => setRecipeViewOpen(false)}>
            닫기
          </BrewButton>
        </div>
      </BrewModal>

      <BrewModal
        open={stockCreateOpen}
        title="재고 등록"
        onClose={() => {
          if (!creatingStock) {
            setStockCreateOpen(false);
          }
        }}
        closeOnBackdrop={!creatingStock}
      >
        <form className="brew-form-stack" onSubmit={handleCreateStock}>
          <div className="brew-field">
            <label className="brew-field__label" htmlFor="stock-category">
              카테고리
            </label>
            <select
              id="stock-category"
              className="brew-field__input"
              value={stockForm.categoryKey}
              onChange={(e) =>
                setStockForm((prev) => ({
                  ...prev,
                  categoryKey: e.target.value,
                  customCategoryName:
                    e.target.value === '__custom__' ? prev.customCategoryName : '',
                }))
              }
              disabled={creatingStock}
            >
              <option value="">카테고리 선택</option>
              {stockCategories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.categoryName}
                </option>
              ))}
              <option value="__custom__">직접 입력</option>
            </select>
          </div>
          {stockForm.categoryKey === '__custom__' ? (
            <BrewInput
              label="카테고리 이름"
              value={stockForm.customCategoryName}
              onChange={(e) =>
                setStockForm((prev) => ({
                  ...prev,
                  customCategoryName: e.target.value,
                }))
              }
              placeholder="새 카테고리 이름"
              disabled={creatingStock}
            />
          ) : null}
          <BrewInput
            label="재고 이름"
            value={stockForm.stockName}
            onChange={(e) =>
              setStockForm((prev) => ({ ...prev, stockName: e.target.value }))
            }
            placeholder="재고 이름"
            disabled={creatingStock}
          />
          <BrewInput
            label="수량"
            type="number"
            min={0}
            value={stockForm.stockNum}
            onChange={(e) =>
              setStockForm((prev) => ({
                ...prev,
                stockNum: Number(e.target.value),
              }))
            }
            disabled={creatingStock}
          />
          <BrewInput
            label="경고 수량"
            type="number"
            min={0}
            value={stockForm.stockMinNum}
            onChange={(e) =>
              setStockForm((prev) => ({
                ...prev,
                stockMinNum: Number(e.target.value),
              }))
            }
            disabled={creatingStock}
          />
          <p className="brew-card-lead">
            「직접 입력」은 같은 이름이 없으면 카테고리를 만든 뒤 재고를 추가합니다.
          </p>
          <div className="brew-modal__actions">
            <BrewButton
              variant="secondary"
              disabled={creatingStock}
              onClick={() => setStockCreateOpen(false)}
            >
              취소
            </BrewButton>
            <BrewButton type="submit" loading={creatingStock}>
              추가
            </BrewButton>
          </div>
        </form>
      </BrewModal>

      <BrewStoreDeleteDialog
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
