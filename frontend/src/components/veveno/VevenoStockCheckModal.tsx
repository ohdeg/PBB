import { useState } from 'react';
import type { FormEvent } from 'react';
import { vevenoApi } from '../../api/vevenoApi';
import type { VevenoStockCheck, VevenoStockCheckItem } from '../../types/veveno';
import { getVevenoErrorMessage } from '../../features/veveno/i18n/error';
import { useTranslation } from '../../features/veveno/i18n/LanguageContext';
import { VevenoButton } from './VevenoButton';
import { VevenoInput } from './VevenoInput';
import { VevenoModal } from './VevenoModal';
import { parseStockQtyInput, sanitizeStockQtyInput } from './vevenoStockQtyInput';

type Mode = 'pos' | 'owner' | 'done';

interface VevenoStockCheckModalProps {
  open: boolean;
  mode: Mode;
  storeId: string;
  check: VevenoStockCheck;
  onClose: () => void;
  onChanged: () => void;
}

export function VevenoStockCheckModal({
  open,
  mode,
  storeId,
  check,
  onClose,
  onChanged,
}: VevenoStockCheckModalProps) {
  const t = useTranslation();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [qtyDraft, setQtyDraft] = useState<{ id: number; value: string } | null>(null);

  const canEditQty = mode === 'pos' || mode === 'owner' || mode === 'done';
  const title =
    mode === 'done' ? t('stockCheck.doneTitle') : t('stockCheck.openTitle');

  const patchQty = async (item: VevenoStockCheckItem, qty: number) => {
    if (qty < 0) {
      return;
    }
    setBusyId(item.id);
    setError('');
    try {
      await vevenoApi.updateStock(item.id, {
        stockName: item.name,
        stockNum: qty,
        stockMinNum: item.stockMinNum,
        version: item.version,
        categoryId: item.categoryId,
      });
      onChanged();
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('errors.failUpdateStock'), t));
    } finally {
      setBusyId(null);
    }
  };

  const removeItem = async (stockId: number) => {
    setBusyId(stockId);
    setError('');
    try {
      await vevenoApi.removeStockCheckItems(storeId, [stockId]);
      onChanged();
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('errors.failStockCheck'), t));
    } finally {
      setBusyId(null);
    }
  };

  const cancelAll = async () => {
    setBusyId(-1);
    setError('');
    try {
      await vevenoApi.cancelStockCheck(storeId);
      onChanged();
      onClose();
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('errors.failStockCheck'), t));
    } finally {
      setBusyId(null);
    }
  };

  const complete = async () => {
    setBusyId(-2);
    setError('');
    try {
      await vevenoApi.completeStockCheck(storeId);
      onChanged();
      onClose();
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('errors.failStockCheck'), t));
    } finally {
      setBusyId(null);
    }
  };

  const ackDone = async () => {
    setBusyId(-3);
    setError('');
    try {
      await vevenoApi.ackStockCheckDone(storeId);
      onChanged();
      onClose();
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('errors.failStockCheck'), t));
    } finally {
      setBusyId(null);
    }
  };

  const openQtyDraft = (item: VevenoStockCheckItem) => {
    setQtyDraft({
      id: item.id,
      value: item.qty === 0 ? '' : String(item.qty),
    });
  };

  const submitQtyDraft = (item: VevenoStockCheckItem, event: FormEvent) => {
    event.preventDefault();
    if (qtyDraft?.id !== item.id) {
      return;
    }
    const qty = parseStockQtyInput(qtyDraft.value);
    setQtyDraft(null);
    if (qty === item.qty) {
      return;
    }
    void patchQty(item, qty);
  };

  return (
    <VevenoModal open={open} title={title} onClose={onClose}>
      {check.items.length === 0 ? (
        <p className="veveno-empty">{t('stockCheck.empty')}</p>
      ) : (
        <ul className="veveno-stock-check-list">
          {check.items.map((item) => (
            <li key={item.id} className="veveno-stock-check-row">
              <span className="veveno-stock-check-row__name">{item.name}</span>
              <div className="veveno-stock-check-row__qty">
                {canEditQty && qtyDraft?.id === item.id ? (
                  <form
                    className="veveno-stock-check-row__setqty"
                    onSubmit={(event) => {
                      submitQtyDraft(item, event);
                    }}
                  >
                    <VevenoInput
                      label={t('stockCheck.setQty')}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      autoFocus
                      pattern="[0-9]*"
                      value={qtyDraft.value}
                      placeholder={t('stockCheck.setQtyPh')}
                      disabled={busyId === item.id}
                      onChange={(e) => {
                        setQtyDraft({
                          id: item.id,
                          value: sanitizeStockQtyInput(e.target.value),
                        });
                      }}
                    />
                    <VevenoButton
                      size="sm"
                      type="submit"
                      disabled={busyId === item.id}
                    >
                      {t('common.save')}
                    </VevenoButton>
                    <VevenoButton
                      size="sm"
                      variant="secondary"
                      disabled={busyId === item.id}
                      onClick={() => {
                        setQtyDraft(null);
                      }}
                    >
                      {t('common.cancel')}
                    </VevenoButton>
                  </form>
                ) : canEditQty ? (
                  <>
                    <VevenoButton
                      size="sm"
                      variant="secondary"
                      disabled={busyId === item.id}
                      onClick={() => {
                        void patchQty(item, Math.max(0, item.qty - 1));
                      }}
                    >
                      −
                    </VevenoButton>
                    <button
                      type="button"
                      className="veveno-stock-num veveno-stock-num--action"
                      disabled={busyId === item.id}
                      aria-label={t('stockCheck.setQtyAria', {
                        name: item.name,
                        qty: `${item.qty}${item.unit}`,
                      })}
                      onClick={() => {
                        openQtyDraft(item);
                      }}
                    >
                      {item.qty}
                      {item.unit}
                    </button>
                    <VevenoButton
                      size="sm"
                      variant="secondary"
                      disabled={busyId === item.id}
                      onClick={() => {
                        void patchQty(item, item.qty + 1);
                      }}
                    >
                      +
                    </VevenoButton>
                  </>
                ) : (
                  <span className="veveno-stock-num">
                    {item.qty}
                    {item.unit}
                  </span>
                )}
                {mode === 'owner' ? (
                  <VevenoButton
                    size="sm"
                    variant="ghost"
                    disabled={busyId === item.id}
                    onClick={() => {
                      void removeItem(item.id);
                    }}
                  >
                    {t('stockCheck.remove')}
                  </VevenoButton>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="veveno-error">{error}</p> : null}
      <div className="veveno-btn-row veveno-stock-check-actions">
        {mode === 'pos' ? (
          <VevenoButton
            disabled={busyId != null || check.items.length === 0}
            onClick={() => {
              void complete();
            }}
          >
            {t('stockCheck.complete')}
          </VevenoButton>
        ) : null}
        {mode === 'owner' ? (
          <VevenoButton
            variant="danger"
            disabled={busyId != null}
            onClick={() => {
              void cancelAll();
            }}
          >
            {t('stockCheck.cancel')}
          </VevenoButton>
        ) : null}
        {mode === 'done' ? (
          <VevenoButton
            disabled={busyId != null}
            onClick={() => {
              void ackDone();
            }}
          >
            {t('stockCheck.ack')}
          </VevenoButton>
        ) : null}
      </div>
    </VevenoModal>
  );
}
