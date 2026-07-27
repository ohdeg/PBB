import { useMemo, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { brewApi } from '../../api/brewApi';
import type { BrewStockCategory } from '../../types/brew';
import { getErrorMessage } from '../../utils/error';
import { VevenoBadge } from './VevenoBadge';
import { VevenoButton } from './VevenoButton';
import { VevenoCard } from './VevenoCard';
import { VevenoInput } from './VevenoInput';
import { VevenoModal } from './VevenoModal';

interface VevenoStoreStocksPanelProps {
  active: boolean;
  storeId: string;
  owned: boolean;
  onDuty: boolean;
  stockCategories: BrewStockCategory[];
  setStockCategories: Dispatch<SetStateAction<BrewStockCategory[]>>;
  onError: (message: string) => void;
}

export function VevenoStoreStocksPanel({
  active,
  storeId,
  owned,
  onDuty,
  stockCategories,
  setStockCategories,
  onError,
}: VevenoStoreStocksPanelProps) {
  const [stockCreateOpen, setStockCreateOpen] = useState(false);
  const [categoryEditMode, setCategoryEditMode] = useState(false);
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

  const canMutateStock = owned || onDuty;
  const normalizedStockSearch = stockSearch.trim().toLowerCase();
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

  const handleCreateCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryName.trim() || !canMutateStock) return;
    try {
      const { data } = await brewApi.createStockCategory(storeId, categoryName.trim());
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
      const { data } = await brewApi.updateStockCategory(
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
      await brewApi.deleteStockCategory(selectedCategoryId);
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
          onError('카테고리를 선택해 주세요.');
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
      onError(getErrorMessage(err, '재고 수량 변경에 실패했습니다.'));
    }
  };

  return (
    <>
      {active ? (
      <div className="brew-stack-lg">
        {!canMutateStock ? (
          <p className="brew-duty-banner">
            근무 시간이 아니라 재고를 수정할 수 없습니다. 조회만 가능합니다.
          </p>
        ) : null}
        <div className="brew-toolbar brew-toolbar--stock">
          <VevenoInput
            id="stock-tab-search"
            label="검색"
            value={stockSearch}
            onChange={(e) => setStockSearch(e.target.value)}
            placeholder="카테고리·재고 이름 검색"
          />
          {canMutateStock ? (
            <div className="brew-toolbar__actions">
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

        {canMutateStock && categoryEditMode ? (
          <div className="brew-stock-edit-grid">
            <VevenoCard title="카테고리">
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
                className="brew-form-stack"
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
                <div className="brew-btn-row">
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

        <VevenoCard title="재고 목록">
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
                              <VevenoBadge variant="danger">부족</VevenoBadge>
                            ) : null}
                            {canMutateStock ? (
                              <>
                                <VevenoButton
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
                                </VevenoButton>
                                <span className="brew-stock-num">{stock.stockNum}</span>
                                <VevenoButton
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
                                </VevenoButton>
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
          <p className="brew-card-lead">
            「직접 입력」은 같은 이름이 없으면 카테고리를 만든 뒤 재고를 추가합니다.
          </p>
          <div className="brew-modal__actions">
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
    </>
  );
}
