import { useSyncExternalStore } from 'react';

const WATCH_KEY = 'veveno:stock-check:watch';

let requestedIds: readonly number[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => {
    listener();
  });
}

export function setStockCheckRequestedIds(ids: readonly number[]): void {
  requestedIds = ids;
  emit();
}

export function useStockCheckRequestedIds(): readonly number[] {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    () => requestedIds,
    () => requestedIds,
  );
}

export function setStockCheckWatchStore(storeId: string | null): void {
  try {
    if (storeId) {
      localStorage.setItem(WATCH_KEY, storeId);
    } else {
      localStorage.removeItem(WATCH_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function getStockCheckWatchStore(): string | null {
  try {
    return localStorage.getItem(WATCH_KEY);
  } catch {
    return null;
  }
}
