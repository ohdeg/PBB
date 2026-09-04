import { useState } from 'react';
import { vevenoApi } from '../../api/vevenoApi';
import type { VevenoStockCheck, VevenoStockCheckItem } from '../../types/veveno';
import { getVevenoErrorMessage } from '../../features/veveno/i18n/error';
import { useTranslation } from '../../features/veveno/i18n/LanguageContext';
import { VevenoButton } from './VevenoButton';
import { VevenoModal } from './VevenoModal';

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
                {canEditQty ? (
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
                    <span className="veveno-stock-num">
                      {item.qty}
                      {item.unit}
                    </span>
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
