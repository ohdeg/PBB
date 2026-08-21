import { useMemo, useRef, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import axios from 'axios';
import { vevenoApi } from '../../api/vevenoApi';
import type { VevenoStock, VevenoStockCategory } from '../../types/veveno';
import { getErrorMessage } from '../../utils/error';
import { VevenoActionMenu } from './VevenoActionMenu';
import { VevenoBadge } from './VevenoBadge';
import { VevenoButton } from './VevenoButton';
import { VevenoCard } from './VevenoCard';
import { VevenoInput } from './VevenoInput';
import { VevenoModal } from './VevenoModal';

type StockListView = 'all' | 'low';

function stockNeedsRestock(stock: VevenoStock): boolean {
  return stock.lowStock || stock.soonLow;
}

function formatDaysOfStock(days: number): string {
  return days <= 0 ? '약 1일 미만' : `약 ${days}일분`;
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
  });
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
      onError(getErrorMessage(err, '카테고리 추가에 실패했습니다.'));
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
      onError(getErrorMessage(err, '카테고리 수정에 실패했습니다.'));
    }
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategoryId || !canMutateStock) {
      return;
    }
    if (!window.confirm('카테고리와 하위 재고를 삭제할까요?')) {
      return;
    }
    onError('');
    try {
      await vevenoApi.deleteStockCategory(selectedCategoryId);
      setStockCategories((prev) => prev.filter((c) => c.id !== selectedCategoryId));
      setSelectedCategoryId(null);
      setCategoryName('');
    } catch (err: unknown) {
      onError(getErrorMessage(err, '카테고리 삭제에 실패했습니다.'));
    }
  };

  const handleCreateStock = async (event: FormEvent) => {
    event.preventDefault();
    if (!canMutateStock || !stockForm.stockName.trim()) {
      return;
    }

    const isCustom = stockForm.categoryKey === '__custom__';
    if (!stockForm.categoryKey) {
      onError('카테고리를 선택해 주세요.');
      return;
    }
    if (isCustom && !stockForm.customCategoryName.trim()) {
      onError('카테고리 이름을 입력해 주세요.');
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
          onError('카테고리를 선택해 주세요.');
          return;
        }
      }

      const { data } = await vevenoApi.createStock(categoryId, {
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
      onError(getErrorMessage(err, '재고 추가에 실패했습니다.'));
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
          getErrorMessage(
            err,
            '다른 사용자가 재고를 수정했습니다. 다시 불러온 뒤 수정하세요.',
          ),
        );
        return false;
      }
      onError(getErrorMessage(err, '재고 수정에 실패했습니다.'));
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
    });
    setEditTarget({ categoryId, stock });
  };

  const handleSaveStock = async (event: FormEvent) => {
    event.preventDefault();
    if (!editTarget || !editForm.stockName.trim() || savingEdit) {
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
    if (!window.confirm(`「${stock.stockName}」을(를) 삭제할까요?`)) {
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
      onError(getErrorMessage(err, '재고 삭제에 실패했습니다.'));
    } finally {
      setDeletingStock(false);
    }
  };

  return (
    <>
      {active ? (
      <div className="veveno-stack-lg">
        {!canMutateStock ? (
          <p className="veveno-duty-banner">
            근무 시간이 아니라 재고를 수정할 수 없습니다. 조회만 가능합니다.
          </p>
        ) : null}

        <div
          className="veveno-tools-seg veveno-stock-view-seg"
          role="tablist"
          aria-label="재고 보기"
        >
          <button
            type="button"
            role="tab"
            className={stockListView === 'all' ? 'is-active' : ''}
            aria-selected={stockListView === 'all'}
            onClick={() => switchStockListView('all')}
          >
            전체
          </button>
          <button
            type="button"
            role="tab"
            className={stockListView === 'low' ? 'is-active' : ''}
            aria-selected={stockListView === 'low'}
            onClick={() => switchStockListView('low')}
          >
            부족
            {lowStockCount > 0 ? (
              <span className="veveno-stock-view-seg__count">{lowStockCount}</span>
            ) : null}
          </button>
        </div>

        <div className="veveno-toolbar veveno-toolbar--stock">
          <VevenoInput
            id="stock-tab-search"
            label="검색"
            value={stockSearch}
            onChange={(e) => setStockSearch(e.target.value)}
            placeholder="카테고리·재고 이름 검색"
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
                  {categoryEditMode ? '카테고리 편집 종료' : '카테고리 편집'}
                </VevenoButton>
              ) : null}
              <VevenoButton
                size="sm"
                onClick={() => {
                  onError('');
                  setStockCreateOpen(true);
                }}
              >
                + 재고 추가
              </VevenoButton>
            </div>
          ) : null}
        </div>

        {canMutateStock && categoryEditMode && stockListView === 'all' ? (
          <div className="veveno-stock-edit-grid">
            <VevenoCard title="카테고리">
              {stockCategories.length === 0 ? (
                <p className="veveno-empty">등록된 카테고리가 없습니다.</p>
              ) : filteredStockCategories.length === 0 ? (
                <p className="veveno-empty">검색 결과가 없습니다.</p>
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
                            재고 {cat.stocks.length}개
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </VevenoCard>
            <VevenoCard
              title="카테고리 편집"
              action={
                <VevenoButton
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSelectedCategoryId(null);
                    setCategoryName('');
                  }}
                >
                  새로 작성
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
                  label="이름"
                  id="category-name"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="카테고리 이름 (예: 원두)"
                />
                <div className="veveno-btn-row">
                  <VevenoButton type="submit">
                    {selectedCategoryId ? '저장/수정' : '카테고리 추가'}
                  </VevenoButton>
                  {selectedCategoryId ? (
                    <VevenoButton
                      variant="danger"
                      onClick={() => {
                        void handleDeleteCategory();
                      }}
                    >
                      삭제
                    </VevenoButton>
                  ) : null}
                </div>
              </form>
            </VevenoCard>
          </div>
        ) : null}

        <VevenoCard
          title={stockListView === 'low' ? '부족 목록' : '재고 목록'}
          action={
            canMutateStock ? (
              <VevenoButton
                size="sm"
                variant={stockListEditMode ? 'secondary' : 'ghost'}
                onClick={() => setStockListEditMode((prev) => !prev)}
              >
                {stockListEditMode ? '편집 종료' : '편집'}
              </VevenoButton>
            ) : undefined
          }
        >
          {stockCategories.length === 0 ? (
            <p className="veveno-empty">표시할 재고가 없습니다.</p>
          ) : stockListView === 'low' && lowStockCount === 0 ? (
            <p className="veveno-empty">부족한 재고가 없습니다.</p>
          ) : filteredStockCategories.length === 0 ? (
            <p className="veveno-empty">검색 결과가 없습니다.</p>
          ) : (
            <div className="veveno-stack-lg">
              {filteredStockCategories.map((cat) => (
                <div key={cat.id} className="veveno-stock-block-inline">
                  <h3 className="veveno-subsection-title">{cat.categoryName}</h3>
                  {cat.stocks.length === 0 ? (
                    <p className="veveno-empty">항목이 없습니다.</p>
                  ) : (
                    <div className="veveno-stack">
                      {cat.stocks.map((stock) => (
                        <div
                          key={stock.id}
                          className={`veveno-stock-row${stock.lowStock ? ' is-low' : stock.soonLow ? ' is-soon' : ''}`}
                        >
                          <div className="veveno-stock-row__info">
                            <p className="veveno-store-row__name">{stock.stockName}</p>
                            <p className="veveno-store-row__sub">
                              경고선 {stock.stockMinNum ?? 0}
                              {stock.daysOfStock != null
                                ? ` · ${formatDaysOfStock(stock.daysOfStock)}`
                                : ''}
                            </p>
                          </div>
                          <div className="veveno-stock-row__qty">
                            {stock.lowStock ? (
                              <VevenoBadge variant="danger">부족</VevenoBadge>
                            ) : stock.soonLow ? (
                              <VevenoBadge variant="warning">곧 부족 · 재고 확인</VevenoBadge>
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
                                  aria-label={`${stock.stockName} 입고, 현재 ${stock.stockNum}개`}
                                  onClick={() => openInbound(cat.id, stock)}
                                >
                                  {stock.stockNum}
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
                              <span className="veveno-stock-num">{stock.stockNum}</span>
                            )}
                            {canMutateStock && stockListEditMode ? (
                              <VevenoActionMenu
                                actions={[
                                  {
                                    label: '편집',
                                    onSelect: () => openEdit(cat.id, stock),
                                  },
                                  {
                                    label: '삭제',
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
      ) : null}

      <VevenoModal
        open={stockCreateOpen}
        title="재고 등록"
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
              카테고리
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
            <VevenoInput
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
          <VevenoInput
            label="재고 이름"
            value={stockForm.stockName}
            onChange={(e) =>
              setStockForm((prev) => ({ ...prev, stockName: e.target.value }))
            }
            placeholder="재고 이름"
            disabled={creatingStock}
          />
          <VevenoInput
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
          <VevenoInput
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
          <p className="veveno-card-lead">
            「직접 입력」은 같은 이름이 없으면 카테고리를 만든 뒤 재고를 추가합니다.
          </p>
          <div className="veveno-modal__actions">
            <VevenoButton
              variant="secondary"
              disabled={creatingStock}
              onClick={() => setStockCreateOpen(false)}
            >
              취소
            </VevenoButton>
            <VevenoButton type="submit" loading={creatingStock}>
              추가
            </VevenoButton>
          </div>
        </form>
      </VevenoModal>

      <VevenoModal
        open={inboundTarget != null}
        title="입고"
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
              {inboundTarget.stock.stockName} · 현재 {inboundTarget.stock.stockNum}개에 더합니다.
            </p>
            <VevenoInput
              label="입고 수량"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={inboundQty}
              onChange={(e) => setInboundQty(e.target.value)}
              placeholder="예: 12"
              disabled={updatingStockId === inboundTarget.stock.id}
            />
            <div className="veveno-modal__actions">
              <VevenoButton
                variant="secondary"
                disabled={updatingStockId === inboundTarget.stock.id}
                onClick={() => setInboundTarget(null)}
              >
                취소
              </VevenoButton>
              <VevenoButton
                type="submit"
                loading={updatingStockId === inboundTarget.stock.id}
                disabled={Math.floor(Number(inboundQty)) < 1}
              >
                입고
              </VevenoButton>
            </div>
          </form>
        ) : null}
      </VevenoModal>

      <VevenoModal
        open={editTarget != null}
        title="재고 편집"
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
                카테고리
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
              label="재고 이름"
              value={editForm.stockName}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, stockName: e.target.value }))
              }
              disabled={savingEdit}
            />
            <VevenoInput
              label="수량"
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
            <VevenoInput
              label="경고 수량"
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
            <div className="veveno-modal__actions">
              <VevenoButton
                variant="secondary"
                disabled={savingEdit}
                onClick={() => setEditTarget(null)}
              >
                취소
              </VevenoButton>
              <VevenoButton type="submit" loading={savingEdit}>
                저장
              </VevenoButton>
            </div>
          </form>
        ) : null}
      </VevenoModal>
    </>
  );
}
