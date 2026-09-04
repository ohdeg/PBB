import { useSyncExternalStore } from 'react'
import type { VevenoNotice, VevenoStockCheck, VevenoWsEvent, VevenoWsStoreSnapshot } from '../../../types/veveno'
import { setStockCheckRequestedIds } from '../stockCheck/watch'

export type StockCheckRow = {
  storeId: string
  storeName: string
  open: VevenoStockCheck | null
  done: VevenoStockCheck | null
}

export type StockCheckModalMode = 'current' | 'done'

type ModalRequest = {
  storeId: string
  mode: StockCheckModalMode
}

type Snapshot = {
  version: number
  checks: ReadonlyMap<string, StockCheckRow>
  notices: ReadonlyMap<string, readonly VevenoNotice[]>
  modal: ModalRequest | null
}

const listeners = new Set<() => void>()

let snapshot: Snapshot = {
  version: 0,
  checks: new Map(),
  notices: new Map(),
  modal: null,
}

function emit(next: Omit<Snapshot, 'version'>): void {
  snapshot = { ...next, version: snapshot.version + 1 }
  listeners.forEach((listener) => {
    listener()
  })
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

function getSnapshot(): Snapshot {
  return snapshot
}

export function useVevenoWsLive(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function resetVevenoWsLive(): void {
  snapshot = {
    version: 0,
    checks: new Map(),
    notices: new Map(),
    modal: null,
  }
}

export function requestStockCheckModal(storeId: string, mode: StockCheckModalMode): void {
  emit({
    checks: snapshot.checks,
    notices: snapshot.notices,
    modal: { storeId, mode },
  })
}

export function closeStockCheckModal(): void {
  emit({
    checks: snapshot.checks,
    notices: snapshot.notices,
    modal: null,
  })
}

export function applyWsEvent(event: VevenoWsEvent): 'posOpen' | 'ownerDone' | 'noticeCreated' | null {
  if (event.topic === 'hello' && event.stores) {
    applyHello(event.stores)
    return null
  }
  if (event.topic === 'stockCheck' && event.storeId) {
    return applyStockCheck(event)
  }
  if (event.topic === 'notice' && event.storeId) {
    return applyNotice(event)
  }
  return null
}

function applyHello(stores: VevenoWsStoreSnapshot[]): void {
  const checks = new Map<string, StockCheckRow>()
  const notices = new Map<string, readonly VevenoNotice[]>()
  for (const store of stores) {
    checks.set(store.storeId, {
      storeId: store.storeId,
      storeName: store.storeName,
      open: store.open,
      done: store.done,
    })
    notices.set(store.storeId, store.notices ?? [])
  }
  emit({ checks, notices, modal: snapshot.modal })
}

function applyStockCheck(event: VevenoWsEvent): 'posOpen' | 'ownerDone' | null {
  if (!event.storeId) {
    return null
  }
  const prev = snapshot.checks.get(event.storeId)
  const next: StockCheckRow = {
    storeId: event.storeId,
    storeName: event.storeName ?? prev?.storeName ?? '',
    open: event.kind === 'cleared' ? null : event.open ?? null,
    done: event.kind === 'cleared'
      ? null
      : event.kind === 'done'
        ? event.done ?? null
        : event.done === undefined
          ? prev?.done ?? null
          : event.done,
  }
  if (event.kind === 'open') {
    next.open = event.open ?? null
  }
  if (event.kind === 'done') {
    next.open = null
    next.done = event.done ?? null
  }
  const checks = new Map(snapshot.checks)
  checks.set(event.storeId, next)
  emit({ checks, notices: snapshot.notices, modal: snapshot.modal })
  const prevIds = prev?.open?.items.map((item) => item.id) ?? []
  const nextIds = next.open?.items.map((item) => item.id) ?? []
  if (prev != null && nextIds.some((id) => !prevIds.includes(id))) {
    return 'posOpen'
  }
  if (
    prev != null
    && next.done
    && next.done.requestId !== (prev.done?.requestId ?? '')
  ) {
    return 'ownerDone'
  }
  return null
}

function applyNotice(event: VevenoWsEvent): 'noticeCreated' | null {
  if (!event.storeId) {
    return null
  }
  const current = [...(snapshot.notices.get(event.storeId) ?? [])]
  if (event.kind === 'deleted' && event.noticeId) {
    const notices = new Map(snapshot.notices)
    notices.set(event.storeId, current.filter((row) => row.id !== event.noticeId))
    emit({ checks: snapshot.checks, notices, modal: snapshot.modal })
    return null
  }
  if (!event.notice) {
    return null
  }
  const index = current.findIndex((row) => row.id === event.notice?.id)
  if (index >= 0) {
    current[index] = event.notice
  } else {
    current.unshift(event.notice)
  }
  const notices = new Map(snapshot.notices)
  notices.set(event.storeId, current)
  emit({ checks: snapshot.checks, notices, modal: snapshot.modal })
  return event.kind === 'created' ? 'noticeCreated' : null
}

export function syncRequestedIds(storeId: string | null): void {
  if (!storeId) {
    setStockCheckRequestedIds([])
    return
  }
  const open = snapshot.checks.get(storeId)?.open
  setStockCheckRequestedIds(open?.items.map((item) => item.id) ?? [])
}
