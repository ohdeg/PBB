import { useCallback, useEffect, useReducer, useRef } from 'react'
import { lottoApi } from '../../../api/lottoApi'
import { useAuthStore } from '../../../stores/authStore'
import type { LottoDraw, LottoHistoryItem } from '../../../types/lotto'
import { getErrorMessage } from '../../../utils/error'
import { migrateLottoHistory, settleLottoHistory } from '../utils/lottoHistory'

type Mutation = (items: LottoHistoryItem[]) => LottoHistoryItem[]
interface Session {
  operations: Map<string, number>
  waiters: { revision: number; resolve: (value: 'saved') => void; reject: (error: Error) => void }[]
  owner: string | null
  controller: AbortController
  items: LottoHistoryItem[]
  saved: LottoHistoryItem[]
  journal: Mutation[]
  ready: boolean
  loading: boolean
  saving: boolean
  revision: number
  savedRevision: number
  error: string
  errorKind: 'load' | 'save' | null
}

export function getLottoHistoryOwner(auth: { accessToken: string | null; userId: string | null; email: string | null }): string | null {
  if (!auth.accessToken) return null
  if (auth.userId) return `id:${auth.userId}`
  return auth.email ? `email:${auth.email}` : null
}

/** One owner, one GET barrier, and at most one PUT in flight. Server responses never replace edits. */
export function useLottoHistory(owner: string | null, draws: LottoDraw[]) {
  const [, render] = useReducer((n: number) => n + 1, 0)
  const [identityVersion, invalidateIdentity] = useReducer((n: number) => n + 1, 0)
  const sessionRef = useRef<Session | null>(null)
  const ownerRef = useRef(owner)
  const drawsRef = useRef(draws)
  ownerRef.current = owner
  drawsRef.current = draws

  const current = useCallback((session: Session) => (
    sessionRef.current === session &&
    ownerRef.current === session.owner &&
    !session.controller.signal.aborted &&
    getLottoHistoryOwner(useAuthStore.getState()) === session.owner
  ), [])

  const save = useCallback(async (session: Session) => {
    if (
      !current(session) || !session.owner || !session.ready ||
      session.saving || session.savedRevision === session.revision
    ) return
    session.saving = true
    session.error = ''
    session.errorKind = null
    render()
    try {
      while (current(session) && session.savedRevision !== session.revision) {
        const revision = session.revision
        const snapshot = session.items
        await lottoApi.savePicks(null, snapshot, session.controller.signal)
        if (!current(session)) return
        session.saved = snapshot
        session.savedRevision = revision
        session.waiters = session.waiters.filter(waiter => {
          if (waiter.revision > revision) return true
          waiter.resolve('saved')
          return false
        })
        render()
      }
    } catch (error) {
      if (!current(session)) return
      const reason = getErrorMessage(error, '추첨 내역을 저장하지 못했습니다.')
      const nextStep = reason.includes('너무 큽니다')
        ? '필요한 기록을 이미지로 저장한 뒤 불필요한 기록을 삭제하고 다시 시도해 주세요.'
        : '연결 상태를 확인하고 다시 시도해 주세요.'
      session.error = `${reason} 변경 내용은 아직 저장되지 않았으며 이 화면에 유지됩니다. ${nextStep}`
      session.errorKind = 'save'
      for (const waiter of session.waiters) waiter.reject(new Error(session.error))
      session.waiters = []
    } finally {
      session.saving = false
      if (current(session)) render()
    }
  }, [current])

  const load = useCallback(async (session: Session) => {
    if (!current(session) || !session.owner || session.loading) return
    session.loading = true
    session.error = ''
    session.errorKind = null
    render()
    try {
      const payload = await lottoApi.getPicks(session.controller.signal)
      if (!current(session)) return
      const migrated = migrateLottoHistory(payload.items, payload.targetRound)
      session.saved = migrated
      let next = migrated
      for (const mutation of session.journal) next = mutation(next)
      next = settleLottoHistory(next, drawsRef.current)
      session.items = next
      session.journal = []
      session.ready = true
      if (payload.targetRound !== null || JSON.stringify(next) !== JSON.stringify(payload.items)) session.revision++
      session.loading = false
      render()
      void save(session)
    } catch (error) {
      if (!current(session)) return
      session.error = getErrorMessage(error, '추첨 내역을 불러오지 못했습니다. 다시 시도해 주세요.')
      session.errorKind = 'load'
    } finally {
      session.loading = false
      if (current(session)) render()
    }
  }, [current, save])

  useEffect(() => {
    const session: Session = {
      owner,
      operations: new Map(),
      waiters: [],
      controller: new AbortController(),
      items: [],
      saved: [],
      journal: [],
      ready: owner === null,
      loading: false,
      saving: false,
      revision: 0,
      savedRevision: 0,
      error: '',
      errorKind: null,
    }
    sessionRef.current = session
    const rejectWaiters = () => {
      for (const waiter of session.waiters) waiter.reject(new Error('계정이 변경되었거나 등록이 종료되었습니다.'))
      session.waiters = []
    }
    session.controller.signal.addEventListener('abort', rejectWaiters, { once: true })
    // Zustand subscriptions run synchronously, before React effects or Axios 401 replays.
    const unsubscribe = useAuthStore.subscribe((auth) => {
      if (getLottoHistoryOwner(auth) !== session.owner) {
        session.controller.abort()
        invalidateIdentity()
      }
    })
    render()
    if (owner) void load(session)
    return () => {
      session.controller.abort()
      unsubscribe()
    }
  }, [owner, identityVersion, load])

  const mutate = useCallback((mutation: Mutation) => {
    const session = sessionRef.current
    if (!session || !current(session)) return
    if (!session.ready) {
      session.journal.push(mutation)
      session.items = mutation(session.items)
      render()
      return
    }
    const next = mutation(session.items)
    if (next === session.items) return
    session.items = next
    session.revision++
    render()
    void save(session)
  }, [current, save])

  useEffect(() => {
    // Hydration settles against drawsRef after replaying its identity-based journal.
    if (sessionRef.current?.ready) {
      mutate((items) => settleLottoHistory(items, draws))
    }
  }, [draws, mutate])

  const append = useCallback((items: LottoHistoryItem[]) => {
    mutate((existing) => {
      const ids = new Set(existing.map((item) => item.id))
      const added = items.filter((item) => !ids.has(item.id))
      return settleLottoHistory([...added, ...existing], drawsRef.current)
    })
  }, [mutate])

  const appendAndWait = useCallback(async (
    items: LottoHistoryItem[],
    options: { operationId: string; expectedOwner: string | null },
  ): Promise<'saved' | 'local'> => {
    const session = sessionRef.current
    if (!session || !current(session) || !session.ready || session.owner !== options.expectedOwner) {
      throw new Error('내역을 불러온 뒤 다시 등록해 주세요.')
    }
    let revision = session.operations.get(options.operationId)
    if (revision === undefined) {
      // Reserve before append; append/mutate starts the existing serial save loop.
      revision = session.revision + 1
      session.operations.set(options.operationId, revision)
      append(items)
      revision = session.revision
      session.operations.set(options.operationId, revision)
    }
    if (!session.owner) return 'local'
    if (session.savedRevision >= revision) return 'saved'
    const completed = new Promise<'saved'>((resolve, reject) => {
      session.waiters.push({ revision, resolve, reject })
    })
    void save(session)
    return completed
  }, [append, current, save])

  const remove = useCallback((ids: number[]) => {
    mutate((items) => items.filter((item) => !ids.includes(item.id)))
  }, [mutate])

  const acknowledge = useCallback((ids: number[]) => {
    mutate((items) => items.map((item) => (
      item.status === 'won' && ids.includes(item.id) && !item.winAcknowledged
        ? { ...item, winAcknowledged: true }
        : item
    )))
  }, [mutate])

  const retry = useCallback(async () => {
    const session = sessionRef.current
    if (!session || !current(session)) return
    if (session.errorKind === 'load') await load(session)
    else await save(session)
  }, [current, load, save])

  const session = sessionRef.current
  const visible = session?.owner === owner && current(session) ? session : null
  const history = visible?.items ?? []
  // Acknowledgement is complete only after its snapshot is saved; failed dismissals remain visible.
  const confirmedItems = owner ? visible?.saved ?? [] : history
  const noticeItems = confirmedItems.filter((item) => (
    item.status === 'won' && !item.winAcknowledged &&
    history.some((local) => local.id === item.id && local.status === 'won')
  ))
  const loading = owner !== null &&
    (!visible || visible.loading || !visible.ready) && !visible?.error
  return {
    history, append, appendAndWait, remove, acknowledge, retry, noticeItems,
    ready: Boolean(visible?.ready),
    error: visible?.error ?? '', loading, saving: visible?.saving ?? false,
  }
}
