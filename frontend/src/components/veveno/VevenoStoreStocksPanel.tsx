import { useMemo, useRef, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import axios from 'axios';
import { vevenoApi } from '../../api/vevenoApi';
import type { VevenoStock, VevenoStockCategory, VevenoStockLog } from '../../types/veveno';
import { VEVENO_STOCK_UNITS } from '../../types/veveno';
import { getVevenoErrorMessage } from '../../features/veveno/i18n/error';
import { useTranslation, useVevenoI18n } from '../../features/veveno/i18n/LanguageContext';
import type { TranslateFn } from '../../features/veveno/i18n/translate';
import { VevenoActionMenu } from './VevenoActionMenu';
import { VevenoBadge } from './VevenoBadge';
import { VevenoButton } from './VevenoButton';
import { VevenoCard } from './VevenoCard';
import { VevenoEmptyState } from './VevenoEmptyState';
import { VevenoInput } from './VevenoInput';
import { VevenoModal } from './VevenoModal';

type StockListView = 'all' | 'low';

function stockNeedsRestock(stock: VevenoStock): boolean {
  return stock.lowStock || stock.soonLow;
}

function unitLabel(unit: string, t: TranslateFn): string {
  switch (unit) {
    case '개':
      return t('units.piece');
    case '팩':
      return t('units.pack');
    case '박스':
      return t('units.box');
    case 'g':
      return t('units.g');
    case 'kg':
      return t('units.kg');
    case 'ml':
      return t('units.ml');
    case 'L':
      return t('units.L');
    default:
      return unit;
  }
}

function stockQtyLabel(stockNum: number, unit: string, t: TranslateFn): string {
  return `${stockNum}${unitLabel(unit || '개', t)}`;
}

function isHttpUrl(url: string | null): url is string {
  if (!url) {
    return false;
  }
  const lower = url.trim().toLowerCase();
  return lower.startsWith('http://') || lower.startsWith('https://');
}

const UNIT_CUSTOM = '__custom__';

function isPresetUnit(unit: string): boolean {
  return VEVENO_STOCK_UNITS.some((preset) => preset === unit);
}

function resolveFormUnit(unitKey: string, customUnit: string): string | null {
  if (unitKey === UNIT_CUSTOM) {
    const custom = customUnit.trim();
    return custom || null;
  }
  return unitKey || '개';
}

function formatStockLogAt(iso: string, dateLocale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString(dateLocale, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDaysOfStock(days: number, t: TranslateFn): string {
  return days <= 0 ? t('stocks.lessThanDay') : t('stocks.daysLeft', { days });
}

interface StockRowTarget {
  categoryId: number;
  stock: VevenoStock;
}

export function placeStock(
  categories: VevenoStockCategory[],
  data: VevenoStock,
): VevenoStockCategory[] {
  return categories.map((cat) => {
    const index = cat.stocks.findIndex((s) => s.id === data.id);
    if (cat.id === data.categoryId) {
      if (index >= 0) {
        const stocks = [...cat.stocks];
        stocks[index] = data;
        return { ...cat, stocks };
      }
      return { ...cat, stocks: [...cat.stocks, data] };
    }
    if (index >= 0) {
      return { ...cat, stocks: cat.stocks.filter((s) => s.id !== data.id) };
    }
    return cat;
  });
}

interface VevenoStoreStocksPanelProps {
  active: boolean;
  storeId: string;
  owned: boolean;
  onDuty: boolean;
  stockEditOffDuty: boolean;
  stockCategories: VevenoStockCategory[];
  setStockCategories: Dispatch<SetStateAction<VevenoStockCategory[]>>;
  onError: (message: string) => void;
}

export function VevenoStoreStocksPanel({
  active,
  storeId,
  owned,
  onDuty,
  stockEditOffDuty,
  stockCategories,
  setStockCategories,
  onError,
}: VevenoStoreStocksPanelProps) {
  const t = useTranslation();
  const { dateLocale } = useVevenoI18n();
  const [stockListView, setStockListView] = useState<StockListView>('all');
  const [stockCreateOpen, setStockCreateOpen] = useState(false);
  const [categoryEditMode, setCategoryEditMode] = useState(false);
  const [stockListEditMode, setStockListEditMode] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [stockSearch, setStockSearch] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [stockForm, setStockForm] = useState({
    categoryKey: '',
    customCategoryName: '',
    stockName: '',
    stockNum: 0,
    stockMinNum: 0,
    unitKey: '개',
    customUnit: '',
    orderUrl: '',
  });
  const [creatingStock, setCreatingStock] = useState(false);
  const [updatingStockId, setUpdatingStockId] = useState<number | null>(null);
  const updatingStockIdRef = useRef<number | null>(null);
  const [inboundTarget, setInboundTarget] = useState<StockRowTarget | null>(null);
  const [inboundQty, setInboundQty] = useState('');
  const [editTarget, setEditTarget] = useState<StockRowTarget | null>(null);
  const [editForm, setEditForm] = useState({
    categoryId: 0,
    stockName: '',
    stockNum: 0,
    stockMinNum: 0,
    unitKey: '개',
    customUnit: '',
    orderUrl: '',
  });
  const [stockLogs, setStockLogs] = useState<VevenoStockLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingStock, setDeletingStock] = useState(false);

  const canMutateStock = owned || onDuty || stockEditOffDuty;
  const normalizedStockSearch = stockSearch.trim().toLowerCase();
  const lowStockCount = useMemo(
    () =>
      stockCategories.reduce(
        (sum, cat) => sum + cat.stocks.filter(stockNeedsRestock).length,
        0,
      ),
    [stockCategories],
  );
  const filteredStockCategories = useMemo(() => {
    const searched = (() => {
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
        .filter((cat): cat is VevenoStockCategory => cat != null);
    })();

    if (stockListView !== 'low') {
      return searched;
    }

    return searched
      .map((cat) => {
        const lowStocks = cat.stocks.filter(stockNeedsRestock);
        if (lowStocks.length === 0) {
          return null;
        }
        return { ...cat, stocks: lowStocks };
      })
      .filter((cat): cat is VevenoStockCategory => cat != null);
  }, [stockCategories, normalizedStockSearch, stockListView]);

  const switchStockListView = (next: StockListView) => {
    setStockListView(next);
    if (next === 'low') {
      setCategoryEditMode(false);
      setSelectedCategoryId(null);
      setCategoryName('');
    }
  };

  const handleCreateCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryName.trim() || !canMutateStock) return;
    try {
      const { data } = await vevenoApi.createStockCategory(storeId, categoryName.trim());
      setStockCategories((prev) => [...prev, data]);
      setCategoryName('');
      setSelectedCategoryId(data.id);
    } catch (err: unknown) {
      onError(getVevenoErrorMessage(err, t('errors.failAddCategory'), t));
    }
  };

  const handleSaveCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCategoryId || !categoryName.trim() || !canMutateStock) {
      return;
    }
    onError('');
    try {
      const { data } = await vevenoApi.updateStockCategory(
        selectedCategoryId,
        categoryName.trim(),
      );
      setStockCategories((prev) =>
        prev.map((cat) => (cat.id === data.id ? { ...cat, ...data } : cat)),
      );
    } catch (err: unknown) {
      onError(getVevenoErrorMessage(err, t('errors.failUpdateCategory'), t));
    }
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategoryId || !canMutateStock) {
      return;
    }
    if (!window.confirm(t('stocks.confirmDeleteCategory'))) {
      return;
    }
    onError('');
    try {
      await vevenoApi.deleteStockCategory(selectedCategoryId);
      setStockCategories((prev) => prev.filter((c) => c.id !== selectedCategoryId));
      setSelectedCategoryId(null);
      setCategoryName('');
    } catch (err: unknown) {
      onError(getVevenoErrorMessage(err, t('errors.failDeleteCategory'), t));
    }
  };

  const handleCreateStock = async (event: FormEvent) => {
    event.preventDefault();
    if (!canMutateStock || !stockForm.stockName.trim()) {
      return;
    }

    const isCustom = stockForm.categoryKey === '__custom__';
    if (!stockForm.categoryKey) {
      onError(t('stocks.pickCategoryRequired'));
      return;
    }
    if (isCustom && !stockForm.customCategoryName.trim()) {
      onError(t('stocks.categoryNameRequired'));
      return;
    }
    const unit = resolveFormUnit(stockForm.unitKey, stockForm.customUnit);
    if (!unit) {
      onError(t('stocks.unitRequired'));
      return;
    }

    setCreatingStock(true);
    onError('');
    try {
      let categoryId: number;
      let createdCategory: VevenoStockCategory | null = null;

      if (isCustom) {
        const name = stockForm.customCategoryName.trim();
        const existing = stockCategories.find(
          (cat) => cat.categoryName.toLowerCase() === name.toLowerCase(),
        );
        if (existing) {
          categoryId = existing.id;
        } else {
          const { data } = await vevenoApi.createStockCategory(storeId, name);
          createdCategory = data;
          categoryId = data.id;
        }
      } else {
        categoryId = Number(stockForm.categoryKey);
        if (!Number.isFinite(categoryId) || categoryId <= 0) {
          onError(t('stocks.pickCategoryRequired'));
          return;
        }
      }

      const { data } = await vevenoApi.createStock(categoryId, {
        stockName: stockForm.stockName.trim(),
        stockNum: stockForm.stockNum,
        stockMinNum: stockForm.stockMinNum,
        unit,
        orderUrl: owned ? stockForm.orderUrl.trim() || null : null,
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
        unitKey: stockForm.unitKey,
        customUnit: '',
        orderUrl: '',
      });
      setStockCreateOpen(false);
    } catch (err: unknown) {
      onError(getVevenoErrorMessage(err, t('errors.failAddStock'), t));
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
    version: number,
    extra?: { unit?: string; orderUrl?: string | null },
  ): Promise<boolean> => {
    if (updatingStockIdRef.current === stockId) {
      return false;
    }
    updatingStockIdRef.current = stockId;
    setUpdatingStockId(stockId);
    try {
      const { data } = await vevenoApi.updateStock(stockId, {
        stockName,
        stockNum,
        stockMinNum,
        version,
        categoryId,
        ...(extra?.unit != null ? { unit: extra.unit } : {}),
        ...(extra && 'orderUrl' in extra ? { orderUrl: extra.orderUrl } : {}),
      });
      setStockCategories((prev) => placeStock(prev, data));
      return true;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        try {
          const { data } = await vevenoApi.listStocks(storeId);
          setStockCategories(data);
        } catch {
          /* refetch 실패해도 충돌 메시지는 표시 */
        }
        onError(
          getVevenoErrorMessage(
            err,
            t('errors.STOCK_STALE'),
            t,
          ),
        );
        return false;
      }
      onError(getVevenoErrorMessage(err, t('errors.failUpdateStock'), t));
      return false;
    } finally {
      updatingStockIdRef.current = null;
      setUpdatingStockId(null);
    }
  };

  const openInbound = (categoryId: number, stock: VevenoStock) => {
    setInboundQty('');
    setInboundTarget({ categoryId, stock });
  };

  const handleInbound = async (event: FormEvent) => {
    event.preventDefault();
    if (!inboundTarget) {
      return;
    }
    const add = Math.floor(Number(inboundQty));
    if (!Number.isFinite(add) || add < 1) {
      return;
    }
    const live = stockCategories
      .find((cat) => cat.id === inboundTarget.categoryId)
      ?.stocks.find((s) => s.id === inboundTarget.stock.id);
    if (!live) {
      setInboundTarget(null);
      return;
    }
    const ok = await handleUpdateStockQty(
      live.id,
      inboundTarget.categoryId,
      live.stockName,
      live.stockNum + add,
      live.stockMinNum,
      live.version,
    );
    if (ok) {
      setInboundTarget(null);
    }
  };

  const openEdit = (categoryId: number, stock: VevenoStock) => {
    setEditForm({
      categoryId,
      stockName: stock.stockName,
      stockNum: stock.stockNum,
      stockMinNum: stock.stockMinNum ?? 0,
      unitKey: isPresetUnit(stock.unit) ? stock.unit : UNIT_CUSTOM,
      customUnit: isPresetUnit(stock.unit) ? '' : stock.unit || '',
      orderUrl: stock.orderUrl ?? '',
    });
    setStockLogs([]);
    setEditTarget({ categoryId, stock });
    setLoadingLogs(true);
    void vevenoApi
      .listStockLogs(storeId, stock.id)
      .then(({ data }) => {
        setStockLogs(data);
      })
      .catch((err: unknown) => {
        onError(getVevenoErrorMessage(err, t('errors.failLoadLogs'), t));
      })
      .finally(() => {
        setLoadingLogs(false);
      });
  };

  const handleSaveStock = async (event: FormEvent) => {
    event.preventDefault();
    if (!editTarget || !editForm.stockName.trim() || savingEdit) {
      return;
    }
    const unit = resolveFormUnit(editForm.unitKey, editForm.customUnit);
    if (!unit) {
      onError(t('stocks.unitRequired'));
      return;
    }
    const qty = Math.max(0, Math.floor(Number(editForm.stockNum)));
    if (!Number.isFinite(qty)) {
      return;
    }
    const live = stockCategories
      .find((cat) => cat.id === editTarget.categoryId)
      ?.stocks.find((s) => s.id === editTarget.stock.id);
    if (!live) {
      setEditTarget(null);
      return;
    }
    setSavingEdit(true);
    try {
      const ok = await handleUpdateStockQty(
        live.id,
        editForm.categoryId,
        editForm.stockName.trim(),
        qty,
        editForm.stockMinNum,
        live.version,
        {
          unit,
          ...(owned ? { orderUrl: editForm.orderUrl.trim() || null } : {}),
        },
      );
      if (ok) {
        setEditTarget(null);
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteStock = async (categoryId: number, stock: VevenoStock) => {
    if (deletingStock) {
      return;
    }
    if (!window.confirm(t('stocks.confirmDeleteStock', { name: stock.stockName }))) {
      return;
    }
    setDeletingStock(true);
    try {
      await vevenoApi.deleteStock(stock.id);
      setStockCategories((prev) =>
        prev.map((cat) =>
          cat.id === categoryId
            ? { ...cat, stocks: cat.stocks.filter((s) => s.id !== stock.id) }
            : cat,
        ),
      );
      if (editTarget?.stock.id === stock.id) {
        setEditTarget(null);
      }
    } catch (err: unknown) {
      onError(getVevenoErrorMessage(err, t('errors.failDeleteStock'), t));
    } finally {
      setDeletingStock(false);
    }
  };

  return (
    <>
      {active ? (
      stockCategories.length === 0 ? (
        <>
          {!canMutateStock ? (
            <p className="veveno-duty-banner">
              {t('stocks.offDutyNotice')}
            </p>
          ) : null}
          <VevenoEmptyState
            title={t('stocks.emptyTitle')}
            body={
              canMutateStock
                ? t('stocks.emptyBodyOwner')
                : t('stocks.emptyBodyStaff')
            }
            action={
              canMutateStock ? (
                <VevenoButton
                  onClick={() => {
                    onError('');
                    setStockForm((prev) => ({
                      ...prev,
                      categoryKey: '__custom__',
                    }));
                    setStockCreateOpen(true);
                  }}
                >
                  {t('stocks.add')}
                </VevenoButton>
              ) : undefined
            }
          />
        </>
      ) : (
      <div className="veveno-stack-lg">
        {!canMutateStock ? (
          <p className="veveno-duty-banner">
            {t('stocks.offDutyNotice')}
          </p>
        ) : null}

        <div
          className="veveno-tools-seg veveno-stock-view-seg"
          role="tablist"
          aria-label={t('stocks.viewAria')}
        >
          <button
            type="button"
            role="tab"
            className={stockListView === 'all' ? 'is-active' : ''}
            aria-selected={stockListView === 'all'}
            onClick={() => switchStockListView('all')}
          >
            {t('stocks.all')}
          </button>
          <button
            type="button"
            role="tab"
            className={stockListView === 'low' ? 'is-active' : ''}
            aria-selected={stockListView === 'low'}
            onClick={() => switchStockListView('low')}
          >
            {t('stocks.low')}
            {lowStockCount > 0 ? (
              <span className="veveno-stock-view-seg__count">{lowStockCount}</span>
            ) : null}
          </button>
        </div>

        <div className="veveno-toolbar veveno-toolbar--stock">
          <VevenoInput
            id="stock-tab-search"
            label={t('common.search')}
            value={stockSearch}
            onChange={(e) => setStockSearch(e.target.value)}
            placeholder={t('stocks.searchPh')}
          />
          {canMutateStock ? (
            <div className="veveno-toolbar__actions">
              {stockListView === 'all' ? (
                <VevenoButton
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
                  {categoryEditMode ? t('stocks.editCategoryDone') : t('stocks.editCategory')}
                </VevenoButton>
              ) : null}
              <VevenoButton
                size="sm"
                onClick={() => {
                  onError('');
                  setStockCreateOpen(true);
                }}
              >
                {t('stocks.addPlus')}
              </VevenoButton>
            </div>
          ) : null}
        </div>

        {canMutateStock && categoryEditMode && stockListView === 'all' ? (
          <div className="veveno-stock-edit-grid">
            <VevenoCard title={t('stocks.categories')}>
              {stockCategories.length === 0 ? (
                <p className="veveno-empty">{t('stocks.noCategories')}</p>
              ) : filteredStockCategories.length === 0 ? (
                <p className="veveno-empty">{t('stocks.searchNone')}</p>
              ) : (
                <div className="veveno-stack">
                  {filteredStockCategories.map((cat) => {
                    const selected = cat.id === selectedCategoryId;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        className={
                          selected
                            ? 'veveno-store-row is-clickable is-selected'
                            : 'veveno-store-row is-clickable'
                        }
                        onClick={() => {
                          setSelectedCategoryId(cat.id);
                          setCategoryName(cat.categoryName);
                        }}
                      >
                        <div className="veveno-store-row__main">
                          <p className="veveno-store-row__name">{cat.categoryName}</p>
                          <p className="veveno-store-row__sub">
                            {t('stocks.stockCount', { count: cat.stocks.length })}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </VevenoCard>
            <VevenoCard
              title={t('stocks.editCategory')}
              action={
                <VevenoButton
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSelectedCategoryId(null);
                    setCategoryName('');
                  }}
                >
                  {t('stocks.createNew')}
                </VevenoButton>
              }
            >
              <form
                className="veveno-form-stack"
                onSubmit={
                  selectedCategoryId ? handleSaveCategory : handleCreateCategory
                }
              >
                <VevenoInput
                  label={t('stocks.categoryName')}
                  id="category-name"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder={t('stocks.categoryNamePh')}
                />
                <div className="veveno-btn-row">
                  <VevenoButton type="submit">
                    {selectedCategoryId ? t('common.saveEdit') : t('stocks.addCategory')}
                  </VevenoButton>
                  {selectedCategoryId ? (
                    <VevenoButton
                      variant="danger"
                      onClick={() => {
                        void handleDeleteCategory();
                      }}
                    >
                      {t('common.delete')}
                    </VevenoButton>
                  ) : null}
                </div>
              </form>
            </VevenoCard>
          </div>
        ) : null}

        <VevenoCard
          title={stockListView === 'low' ? t('stocks.lowList') : t('stocks.stockList')}
          action={
            canMutateStock ? (
              <VevenoButton
                size="sm"
                variant={stockListEditMode ? 'secondary' : 'ghost'}
                onClick={() => setStockListEditMode((prev) => !prev)}
              >
                {stockListEditMode ? t('common.editDone') : t('stocks.editMode')}
              </VevenoButton>
            ) : undefined
          }
        >
          {stockCategories.length === 0 ? (
            <p className="veveno-empty">{t('stocks.noneToShow')}</p>
          ) : stockListView === 'low' && lowStockCount === 0 ? (
            <p className="veveno-empty">{t('stocks.noneLow')}</p>
          ) : filteredStockCategories.length === 0 ? (
            <p className="veveno-empty">{t('stocks.searchNone')}</p>
          ) : (
            <div className="veveno-stack-lg">
              {filteredStockCategories.map((cat) => (
                <div key={cat.id} className="veveno-stock-block-inline">
                  <h3 className="veveno-subsection-title">{cat.categoryName}</h3>
                  {cat.stocks.length === 0 ? (
                    <p className="veveno-empty">{t('stocks.noItems')}</p>
                  ) : (
                    <div className="veveno-stack">
                      {cat.stocks.map((stock) => (
                        <div
                          key={stock.id}
                          className={`veveno-stock-row${stock.lowStock ? ' is-low' : stock.soonLow ? ' is-soon' : ''}`}
                        >
                          <div className="veveno-stock-row__info">
                            <div className="veveno-stock-row__title">
                              <p className="veveno-store-row__name">{stock.stockName}</p>
                              {owned && isHttpUrl(stock.orderUrl) ? (
                                <a
                                  className="veveno-stock-order"
                                  href={stock.orderUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {t('stocks.order')}
                                </a>
                              ) : null}
                            </div>
                            <p className="veveno-store-row__sub">
                              {t('stocks.warnLine', { count: stock.stockMinNum ?? 0 })}
                              {stock.daysOfStock != null
                                ? ` · ${formatDaysOfStock(stock.daysOfStock, t)}`
                                : ''}
                            </p>
                          </div>
                          <div className="veveno-stock-row__qty">
                            {stock.lowStock ? (
                              <VevenoBadge variant="danger">{t('stocks.low')}</VevenoBadge>
                            ) : stock.soonLow ? (
                              <VevenoBadge variant="warning">{t('stocks.soonLow')}</VevenoBadge>
                            ) : null}
                            {canMutateStock ? (
                              <>
                                <VevenoButton
                                  size="sm"
                                  variant="secondary"
                                  disabled={updatingStockId === stock.id}
                                  onClick={() => {
                                    void handleUpdateStockQty(
                                      stock.id,
                                      cat.id,
                                      stock.stockName,
                                      Math.max(0, stock.stockNum - 1),
                                      stock.stockMinNum,
                                      stock.version,
                                    );
                                  }}
                                >
                                  −
                                </VevenoButton>
                                <button
                                  type="button"
                                  className="veveno-stock-num veveno-stock-num--action"
                                  disabled={updatingStockId === stock.id}
                                  aria-label={t('stocks.inboundAria', {
                                    name: stock.stockName,
                                    qty: stockQtyLabel(stock.stockNum, stock.unit, t),
                                  })}
                                  onClick={() => openInbound(cat.id, stock)}
                                >
                                  {stockQtyLabel(stock.stockNum, stock.unit, t)}
                                </button>
                                <VevenoButton
                                  size="sm"
                                  variant="secondary"
                                  disabled={updatingStockId === stock.id}
                                  onClick={() => {
                                    void handleUpdateStockQty(
                                      stock.id,
                                      cat.id,
                                      stock.stockName,
                                      stock.stockNum + 1,
                                      stock.stockMinNum,
                                      stock.version,
                                    );
                                  }}
                                >
                                  +
                                </VevenoButton>
                              </>
                            ) : (
                              <span className="veveno-stock-num">
                                {stockQtyLabel(stock.stockNum, stock.unit, t)}
                              </span>
                            )}
                            {canMutateStock && stockListEditMode ? (
                              <VevenoActionMenu
                                actions={[
                                  {
                                    label: t('stocks.editMode'),
                                    onSelect: () => openEdit(cat.id, stock),
                                  },
                                  {
                                    label: t('common.delete'),
                                    danger: true,
                                    disabled: deletingStock,
                                    onSelect: () => {
                                      void handleDeleteStock(cat.id, stock);
                                    },
                                  },
                                ]}
                              />
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </VevenoCard>
      </div>
      )
      ) : null}

      <VevenoModal
        open={stockCreateOpen}
        title={t('stocks.register')}
        onClose={() => {
          if (!creatingStock) {
            setStockCreateOpen(false);
          }
        }}
        closeOnBackdrop={!creatingStock}
      >
        <form className="veveno-form-stack" onSubmit={handleCreateStock}>
          <div className="veveno-field">
            <label className="veveno-field__label" htmlFor="stock-category">
              {t('menus.category')}
            </label>
            <select
              id="stock-category"
              className="veveno-field__input"
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
              <option value="">{t('stocks.pickCategory')}</option>
              {stockCategories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.categoryName}
                </option>
              ))}
              <option value="__custom__">{t('units.custom')}</option>
            </select>
          </div>
          {stockForm.categoryKey === '__custom__' ? (
            <VevenoInput
              label={t('stocks.categoryNameField')}
              value={stockForm.customCategoryName}
              onChange={(e) =>
                setStockForm((prev) => ({
                  ...prev,
                  customCategoryName: e.target.value,
                }))
              }
              placeholder={t('menus.newCategoryPh')}
              disabled={creatingStock}
            />
          ) : null}
          <VevenoInput
            label={t('stocks.stockName')}
            value={stockForm.stockName}
            onChange={(e) =>
              setStockForm((prev) => ({ ...prev, stockName: e.target.value }))
            }
            placeholder={t('stocks.stockName')}
            disabled={creatingStock}
          />
          <VevenoInput
            label={t('stocks.qty')}
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
          <div className="veveno-field">
            <label className="veveno-field__label" htmlFor="stock-unit">
              {t('stocks.unit')}
            </label>
            <select
              id="stock-unit"
              className="veveno-field__input"
              value={stockForm.unitKey}
              onChange={(e) =>
                setStockForm((prev) => ({
                  ...prev,
                  unitKey: e.target.value,
                  customUnit: e.target.value === UNIT_CUSTOM ? prev.customUnit : '',
                }))
              }
              disabled={creatingStock}
            >
              {VEVENO_STOCK_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unitLabel(unit, t)}
                </option>
              ))}
              <option value={UNIT_CUSTOM}>{t('units.custom')}</option>
            </select>
          </div>
          {stockForm.unitKey === UNIT_CUSTOM ? (
            <VevenoInput
              label={t('stocks.unitName')}
              value={stockForm.customUnit}
              onChange={(e) =>
                setStockForm((prev) => ({ ...prev, customUnit: e.target.value }))
              }
              placeholder={t('stocks.unitNamePh')}
              maxLength={16}
              disabled={creatingStock}
            />
          ) : null}
          {owned ? (
            <VevenoInput
              label={t('stocks.orderUrl')}
              type="url"
              value={stockForm.orderUrl}
              onChange={(e) =>
                setStockForm((prev) => ({ ...prev, orderUrl: e.target.value }))
              }
              placeholder="https://"
              disabled={creatingStock}
            />
          ) : null}
          <VevenoInput
            label={t('stocks.warnQty')}
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
          <p className="veveno-card-lead">
            {t('stocks.customCategoryHint')}
          </p>
          <div className="veveno-modal__actions">
            <VevenoButton
              variant="secondary"
              disabled={creatingStock}
              onClick={() => setStockCreateOpen(false)}
            >
              {t('common.cancel')}
            </VevenoButton>
            <VevenoButton type="submit" loading={creatingStock}>
              {t('common.add')}
            </VevenoButton>
          </div>
        </form>
      </VevenoModal>

      <VevenoModal
        open={inboundTarget != null}
        title={t('stocks.inbound')}
        onClose={() => {
          if (updatingStockId == null) {
            setInboundTarget(null);
          }
        }}
        closeOnBackdrop={updatingStockId == null}
      >
        {inboundTarget ? (
          <form className="veveno-form-stack" onSubmit={(e) => void handleInbound(e)}>
            <p className="veveno-card-lead">
              {t('stocks.inboundLead', {
                name: inboundTarget.stock.stockName,
                qty: stockQtyLabel(inboundTarget.stock.stockNum, inboundTarget.stock.unit, t),
              })}
            </p>
            <VevenoInput
              label={t('stocks.inboundQty')}
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={inboundQty}
              onChange={(e) => setInboundQty(e.target.value)}
              placeholder={t('stocks.inboundQtyPh')}
              disabled={updatingStockId === inboundTarget.stock.id}
            />
            <div className="veveno-modal__actions">
              <VevenoButton
                variant="secondary"
                disabled={updatingStockId === inboundTarget.stock.id}
                onClick={() => setInboundTarget(null)}
              >
                {t('common.cancel')}
              </VevenoButton>
              <VevenoButton
                type="submit"
                loading={updatingStockId === inboundTarget.stock.id}
                disabled={Math.floor(Number(inboundQty)) < 1}
              >
                {t('stocks.inbound')}
              </VevenoButton>
            </div>
          </form>
        ) : null}
      </VevenoModal>

      <VevenoModal
        open={editTarget != null}
        title={t('stocks.edit')}
        onClose={() => {
          if (!savingEdit) {
            setEditTarget(null);
          }
        }}
        closeOnBackdrop={!savingEdit}
      >
        {editTarget ? (
          <form className="veveno-form-stack" onSubmit={(e) => void handleSaveStock(e)}>
            <div className="veveno-field">
              <label className="veveno-field__label" htmlFor="edit-stock-category">
                {t('menus.category')}
              </label>
              <select
                id="edit-stock-category"
                className="veveno-field__input"
                value={String(editForm.categoryId)}
                disabled={savingEdit}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    categoryId: Number(e.target.value),
                  }))
                }
              >
                {stockCategories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>
                    {cat.categoryName}
                  </option>
                ))}
              </select>
            </div>
            <VevenoInput
              label={t('stocks.stockName')}
              value={editForm.stockName}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, stockName: e.target.value }))
              }
              disabled={savingEdit}
            />
            <VevenoInput
              label={t('stocks.qty')}
              type="number"
              min={0}
              value={editForm.stockNum}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  stockNum: Number(e.target.value),
                }))
              }
              disabled={savingEdit}
            />
            <div className="veveno-field">
              <label className="veveno-field__label" htmlFor="edit-stock-unit">
                {t('stocks.unit')}
              </label>
              <select
                id="edit-stock-unit"
                className="veveno-field__input"
                value={editForm.unitKey}
                disabled={savingEdit}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    unitKey: e.target.value,
                    customUnit: e.target.value === UNIT_CUSTOM ? prev.customUnit : '',
                  }))
                }
              >
                {VEVENO_STOCK_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unitLabel(unit, t)}
                  </option>
                ))}
                <option value={UNIT_CUSTOM}>{t('units.custom')}</option>
              </select>
            </div>
            {editForm.unitKey === UNIT_CUSTOM ? (
              <VevenoInput
                label={t('stocks.unitName')}
                value={editForm.customUnit}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, customUnit: e.target.value }))
                }
                placeholder={t('stocks.unitNamePh')}
                maxLength={16}
                disabled={savingEdit}
              />
            ) : null}
            {owned ? (
              <VevenoInput
                label={t('stocks.orderUrl')}
                type="url"
                value={editForm.orderUrl}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, orderUrl: e.target.value }))
                }
                placeholder="https://"
                disabled={savingEdit}
              />
            ) : null}
            <VevenoInput
              label={t('stocks.warnQty')}
              type="number"
              min={0}
              value={editForm.stockMinNum}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  stockMinNum: Number(e.target.value),
                }))
              }
              disabled={savingEdit}
            />
            <div className="veveno-stock-logs">
              <p className="veveno-field__label">{t('stocks.history')}</p>
              {loadingLogs ? (
                <p className="veveno-empty">{t('common.loading')}</p>
              ) : stockLogs.length === 0 ? (
                <p className="veveno-empty">{t('stocks.noHistory')}</p>
              ) : (
                <ul className="veveno-stock-logs__list">
                  {stockLogs.map((log) => (
                    <li key={log.id}>
                      {t('stocks.historyLine', {
                        nickname: log.nickname || t('common.unknown'),
                        from: log.fromNum,
                        to: log.toNum,
                      })}
                      {log.createdAt ? ` · ${formatStockLogAt(log.createdAt, dateLocale)}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="veveno-modal__actions">
              <VevenoButton
                variant="secondary"
                disabled={savingEdit}
                onClick={() => setEditTarget(null)}
              >
                {t('common.cancel')}
              </VevenoButton>
              <VevenoButton type="submit" loading={savingEdit}>
                {t('common.save')}
              </VevenoButton>
            </div>
          </form>
        ) : null}
      </VevenoModal>
    </>
  );
}
