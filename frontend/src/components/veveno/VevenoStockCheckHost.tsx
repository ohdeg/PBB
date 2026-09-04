import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { vevenoApi } from '../../api/vevenoApi';
import { getDemoPosSession } from '../../features/veveno/pos/demoSession';
import {
  getVevenoPosStoreId,
  getVevenoPosToken,
} from '../../features/veveno/pos/session';
import {
  isVevenoDemoRequest,
  VEVENO_DEMO_STORE_ID,
} from '../../features/veveno/vevenoDemo';
import {
  playStockCheckDing,
  unlockStockCheckDing,
} from '../../features/veveno/stockCheck/ding';
import {
  getStockCheckWatchStore,
  setStockCheckRequestedIds,
  setStockCheckWatchStore,
} from '../../features/veveno/stockCheck/watch';
import { useTranslation } from '../../features/veveno/i18n/LanguageContext';
import { startVevenoWs, stopVevenoWs } from '../../features/veveno/ws/connect';
import {
  closeStockCheckModal,
  requestStockCheckModal,
  syncRequestedIds,
  useVevenoWsLive,
  type StockCheckRow,
} from '../../features/veveno/ws/live';
import { useAuthStore } from '../../stores/authStore';
import type { VevenoStockCheck, VevenoWsEvent } from '../../types/veveno';
import { VevenoModal } from './VevenoModal';
import { VevenoStockCheckModal } from './VevenoStockCheckModal';
import { VevenoStoreRow } from './VevenoStoreRow';

const POLL_MS = 3000;
const TOAST_MS = 4000;

function addedIds(prev: readonly number[] | null, next: readonly number[]): boolean {
  if (prev == null) {
    return false;
  }
  const seen = new Set(prev);
  return next.some((id) => !seen.has(id));
}

export function sameStockCheck(
  prev: VevenoStockCheck | null,
  next: VevenoStockCheck | null,
): boolean {
  if (prev === next) {
    return true;
  }
  if (!prev || !next) {
    return false;
  }
  if (
    prev.requestId !== next.requestId
    || prev.updatedAt !== next.updatedAt
    || prev.items.length !== next.items.length
  ) {
    return false;
  }
  return prev.items.every((item, index) => {
    const other = next.items[index];
    return other != null
      && item.id === other.id
      && item.qty === other.qty
      && item.version === other.version;
  });
}

function resolveStoreId(pathname: string): string | null {
  const posStore = getVevenoPosStoreId();
  if (posStore) {
    return posStore;
  }
  if (getDemoPosSession()) {
    return VEVENO_DEMO_STORE_ID;
  }
  const match = pathname.match(/\/hobbies\/veveno\/(?:pos\/store|stores)\/([^/]+)/);
  if (match?.[1]) {
    return match[1];
  }
  return getStockCheckWatchStore();
}

export function activeStockCheckRows(
  checks: ReadonlyMap<string, StockCheckRow>,
  pos: boolean,
  boundStoreId?: string | null,
): StockCheckRow[] {
  const rows: StockCheckRow[] = [];
  for (const row of checks.values()) {
    if (pos && boundStoreId && row.storeId !== boundStoreId) {
      continue;
    }
    if (row.open || (!pos && row.done)) {
      rows.push(row);
    }
  }
  return rows;
}

function isPosSession(): boolean {
  return Boolean(getVevenoPosToken() || getDemoPosSession());
}

function notifyOs(title: string, body: string): void {
  if (document.visibilityState !== 'hidden' || typeof Notification === 'undefined') {
    return;
  }
  if (Notification.permission !== 'granted') {
    return;
  }
  try {
    new Notification(title, { body });
  } catch {
    /* ignore */
  }
}

export function VevenoStockCheckHost() {
  const t = useTranslation();
  const location = useLocation();
  const accessToken = useAuthStore((state) => state.accessToken);
  const pathStoreId = resolveStoreId(location.pathname);
  const pos = isPosSession();
  const demo = isVevenoDemoRequest();
  const onVeveno = location.pathname.startsWith('/hobbies/veveno');
  const live = useVevenoWsLive();
  const [current, setCurrent] = useState<VevenoStockCheck | null>(null);
  const [done, setDone] = useState<VevenoStockCheck | null>(null);
  const [demoModal, setDemoModal] = useState<'none' | 'current' | 'done'>('none');
  const [pickOpen, setPickOpen] = useState(false);
  const [toast, setToast] = useState<{
    kind: 'open' | 'done' | 'notice';
    message: string;
    storeId: string;
  } | null>(null);
  const prevIds = useRef<number[] | null>(null);
  const prevDoneId = useRef<string | null>(null);
  const toastTimer = useRef<number>(0);
  const forbidden = useRef(false);

  const showToast = useCallback((
    kind: 'open' | 'done' | 'notice',
    message: string,
    storeId: string,
  ) => {
    setToast({ kind, message, storeId });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
    }, TOAST_MS);
  }, []);

  const refreshDemo = useCallback(async () => {
    if (!pathStoreId) {
      setCurrent(null);
      setDone(null);
      setStockCheckRequestedIds([]);
      return;
    }
    if (forbidden.current) {
      return;
    }
    try {
      const cur = await vevenoApi.getStockCheckCurrent(pathStoreId);
      const next = cur.data;
      const nextIds = next?.items.map((item) => item.id) ?? [];
      if (addedIds(prevIds.current, nextIds) && pos) {
        playStockCheckDing();
        showToast('open', t('stockCheck.toastOpen'), pathStoreId);
        notifyOs(t('stockCheck.toastOpen'), nextIds.length.toString());
      }
      prevIds.current = nextIds;
      setCurrent((prev) => (sameStockCheck(prev, next) ? prev : next));
      setStockCheckRequestedIds(nextIds);
      if (next) {
        setStockCheckWatchStore(pathStoreId);
      }
      if (!pos) {
        const finished = await vevenoApi.getStockCheckDone(pathStoreId);
        const doneBody = finished.data;
        if (
          prevDoneId.current != null
          && doneBody
          && doneBody.requestId !== prevDoneId.current
        ) {
          playStockCheckDing();
          showToast('done', t('stockCheck.toastDone'), pathStoreId);
          notifyOs(t('stockCheck.toastDone'), '');
        }
        prevDoneId.current = doneBody?.requestId ?? '';
        setDone((prev) => (sameStockCheck(prev, doneBody) ? prev : doneBody));
        if (!next && !doneBody) {
          setStockCheckWatchStore(null);
        }
      } else {
        setDone(null);
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 403 || status === 401) {
        forbidden.current = true;
      }
    }
  }, [pathStoreId, pos, showToast, t]);

  useEffect(() => {
    const unlock = () => {
      unlockStockCheckDing();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
    };
  }, []);

  useEffect(() => {
    forbidden.current = false;
    if (!demo) {
      return;
    }
    if (!pathStoreId) {
      return;
    }
    void refreshDemo();
    const tick = window.setInterval(() => {
      void refreshDemo();
    }, POLL_MS);
    const onSync = () => {
      void refreshDemo();
    };
    window.addEventListener('storage', onSync);
    window.addEventListener('veveno-demo-sync', onSync as EventListener);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener('storage', onSync);
      window.removeEventListener('veveno-demo-sync', onSync as EventListener);
    };
  }, [demo, refreshDemo, pathStoreId]);

  const onWsAlert = useCallback((
    kind: 'posOpen' | 'ownerDone' | 'noticeCreated',
    event: VevenoWsEvent,
  ) => {
    const storeId = event.storeId ?? '';
    if (kind === 'posOpen' && pos) {
      playStockCheckDing();
      showToast('open', t('stockCheck.toastOpen'), storeId);
      notifyOs(t('stockCheck.toastOpen'), event.open?.items.length?.toString() ?? '');
    }
    if (kind === 'ownerDone' && !pos) {
      playStockCheckDing();
      showToast('done', t('stockCheck.toastDone'), storeId);
      notifyOs(t('stockCheck.toastDone'), '');
    }
    if (kind === 'noticeCreated' && event.notice) {
      showToast(
        'notice',
        t('notices.toastCreated', { title: event.notice.title }),
        storeId,
      );
    }
  }, [pos, showToast, t]);

  useEffect(() => {
    if (demo || !onVeveno) {
      stopVevenoWs();
      return;
    }
    const token = getVevenoPosToken() ?? accessToken;
    if (!token) {
      stopVevenoWs();
      return;
    }
    startVevenoWs(() => getVevenoPosToken() ?? useAuthStore.getState().accessToken, onWsAlert);
    return () => {
      stopVevenoWs();
    };
  }, [accessToken, demo, onVeveno, onWsAlert]);

  useEffect(() => {
    if (demo) {
      return;
    }
    syncRequestedIds(pathStoreId);
  }, [demo, live.version, pathStoreId]);

  useEffect(() => () => {
    window.clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    setPickOpen(false);
  }, [location.pathname]);

  const liveStoreId = live.modal?.storeId ?? pathStoreId;
  const liveRow = liveStoreId ? live.checks.get(liveStoreId) : undefined;
  const liveOpen = demo ? current : liveRow?.open ?? null;
  const liveDone = demo ? done : liveRow?.done ?? null;
  const modalMode = demo
    ? demoModal
    : live.modal?.mode ?? 'none';
  const modalCheck = modalMode === 'done' ? liveDone : liveOpen;
  const activeRows = demo
    ? (current || done) && pathStoreId
      ? [{
          storeId: pathStoreId,
          storeName: '',
          open: current,
          done: pos ? null : done,
        } satisfies StockCheckRow]
      : []
    : activeStockCheckRows(live.checks, pos, pos ? pathStoreId : null);
  const only = activeRows.length === 1 ? activeRows[0] : undefined;
  const bannerLabel = only?.open
    ? t('stockCheck.bannerOpen', { count: only.open.items.length })
    : only?.done
      ? t('stockCheck.bannerDone')
      : t('hub.stockCheck');
  const showBanner = activeRows.length > 0;

  const openRow = (row: StockCheckRow) => {
    setPickOpen(false);
    const mode = row.open ? 'current' : 'done';
    if (demo) {
      setDemoModal(mode);
      return;
    }
    requestStockCheckModal(row.storeId, mode);
  };

  if (!demo && !onVeveno) {
    return null;
  }

  return (
    <>
      {showBanner ? (
        <div className="veveno-stock-check-banner">
          <button
            type="button"
            className="veveno-stock-check-banner__btn"
            onClick={() => {
              if (only) {
                openRow(only);
                return;
              }
              setPickOpen(true);
            }}
          >
            {bannerLabel}
          </button>
        </div>
      ) : null}
      {toast ? (
        <button
          type="button"
          className={`veveno-stock-check-toast${showBanner ? ' is-above-banner' : ''}`}
          onClick={() => {
            const next = toast;
            setToast(null);
            if (next.kind === 'notice') {
              return;
            }
            if (demo) {
              setDemoModal(next.kind === 'done' ? 'done' : 'current');
            } else {
              requestStockCheckModal(next.storeId, next.kind === 'done' ? 'done' : 'current');
            }
          }}
        >
          {toast.message}
        </button>
      ) : null}
      {pickOpen && activeRows.length > 0 ? (
        <VevenoModal
          open
          title={t('stockCheck.pickStore')}
          onClose={() => {
            setPickOpen(false);
          }}
        >
          <div className="veveno-stack">
            {activeRows.map((row) => {
              const openCount = row.open?.items.length ?? 0;
              return (
                <VevenoStoreRow
                  key={row.storeId}
                  name={row.storeName || t('hub.stockCheck')}
                  subtitle={
                    openCount > 0
                      ? t('stockCheck.pickOpen', { count: openCount })
                      : t('stockCheck.pickDone')
                  }
                  onClick={() => {
                    openRow(row);
                  }}
                />
              );
            })}
          </div>
        </VevenoModal>
      ) : null}
      {modalMode !== 'none' && modalCheck && liveStoreId ? (
        <VevenoStockCheckModal
          open
          mode={pos ? 'pos' : modalMode === 'done' ? 'done' : 'owner'}
          storeId={liveStoreId}
          check={modalCheck}
          onClose={() => {
            if (demo) {
              setDemoModal('none');
            } else {
              closeStockCheckModal();
            }
          }}
          onChanged={() => {
            if (demo) {
              void refreshDemo();
            }
          }}
        />
      ) : null}
    </>
  );
}
