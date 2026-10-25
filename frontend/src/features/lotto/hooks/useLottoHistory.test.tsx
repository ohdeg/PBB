// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lottoApi } from '../../../api/lottoApi'
import { useAuthStore } from '../../../stores/authStore'
import type { LottoHistoryItem } from '../../../types/lotto'
import { useLottoHistory } from './useLottoHistory'
vi.mock('../../../api/lottoApi', () => ({ lottoApi: { getPicks: vi.fn(), savePicks: vi.fn() } }))
const item: LottoHistoryItem = { id: 1, name: '1, 2, 3, 4, 5, 6', numbers: [1, 2, 3, 4, 5, 6], category: '', reviews: '', icon: '', color: '', targetRound: 1200, status: 'pending' }
const draw = { round: 1200, mainNumbers: [1, 2, 3, 4, 5, 6], bonusNumber: 7 }
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const login = (id: string | null, token = 'token') => useAuthStore.setState({ accessToken: id ? token : null, userId: id, email: id ? `${id}@example.com` : null })
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve() }) }

describe('account-scoped lotto history persistence', () => {
  beforeEach(() => { vi.clearAllMocks(); login('A'); vi.mocked(lottoApi.savePicks).mockImplementation(async (targetRound, items) => ({ targetRound, items })) })
  it('does not save or clear at startup; replays commands over authoritative hydration', async () => {
    const load = deferred<{ targetRound: number | null; items: LottoHistoryItem[] }>(); vi.mocked(lottoApi.getPicks).mockReturnValue(load.promise)
    const { result } = renderHook(() => useLottoHistory('id:A', []))
    act(() => result.current.append([{ ...item, id: 2 }]))
    expect(lottoApi.savePicks).not.toHaveBeenCalled()
    await act(async () => load.resolve({ targetRound: 1200, items: [item] }))
    expect(result.current.history.map((value) => value.id)).toEqual([2, 1])
  })
  it('keeps hydration failure visible and retries without writing an empty history', async () => {
    vi.mocked(lottoApi.getPicks).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ targetRound: null, items: [item] })
    const { result } = renderHook(() => useLottoHistory('id:A', [])); await flush()
    expect(result.current.error).toContain('불러오지 못했습니다')
    expect(lottoApi.savePicks).not.toHaveBeenCalled()
    await act(async () => result.current.retry())
    expect(result.current.history).toHaveLength(1)
  })
  it('preserves same-account token rotation but hides switched account and aborts old GET/retry signal synchronously', async () => {
    const load = deferred<{ targetRound: number | null; items: LottoHistoryItem[] }>(); vi.mocked(lottoApi.getPicks).mockReturnValue(load.promise)
    const { result, rerender } = renderHook(({ owner }) => useLottoHistory(owner, []), { initialProps: { owner: 'id:A' } })
    const signal = vi.mocked(lottoApi.getPicks).mock.calls[0][0]!
    act(() => login('A', 'rotated')); rerender({ owner: 'id:A' }); expect(signal.aborted).toBe(false); expect(lottoApi.getPicks).toHaveBeenCalledTimes(1)
    act(() => login('B')); expect(signal.aborted).toBe(true)
    rerender({ owner: 'id:B' }); expect(result.current.history).toEqual([])
    await act(async () => load.resolve({ targetRound: null, items: [item] }))
    expect(lottoApi.savePicks).not.toHaveBeenCalled()
  })
  it('serializes writes and never overwrites newer edits with a stale save response', async () => {
    vi.mocked(lottoApi.getPicks).mockResolvedValue({ targetRound: null, items: [] })
    const save = deferred<{ targetRound: number | null; items: LottoHistoryItem[] }>(); vi.mocked(lottoApi.savePicks).mockReturnValueOnce(save.promise)
    const { result } = renderHook(() => useLottoHistory('id:A', [])); await flush()
    act(() => result.current.append([item])); act(() => result.current.append([{ ...item, id: 2 }]))
    expect(lottoApi.savePicks).toHaveBeenCalledTimes(1)
    await act(async () => save.resolve({ targetRound: null, items: [item] }))
    expect(lottoApi.savePicks).toHaveBeenCalledTimes(2)
    expect(result.current.history.map((value) => value.id)).toEqual([2, 1])
  })
  it('shows a win only after save; acknowledgement remains pending until saved and retries failures', async () => {
    vi.mocked(lottoApi.getPicks).mockResolvedValue({ targetRound: null, items: [item] })
    const save = deferred<{ targetRound: number | null; items: LottoHistoryItem[] }>(); vi.mocked(lottoApi.savePicks).mockReturnValueOnce(save.promise)
    const { result } = renderHook(() => useLottoHistory('id:A', [draw])); await flush()
    expect(result.current.noticeItems).toEqual([])
    await act(async () => save.resolve({ targetRound: null, items: [] }))
    expect(result.current.noticeItems).toHaveLength(1)
    vi.mocked(lottoApi.savePicks).mockRejectedValueOnce(new Error('offline'))
    act(() => result.current.acknowledge([1])); await flush()
    expect(result.current.error).toContain('저장하지 못했습니다'); expect(result.current.noticeItems).toHaveLength(1)
    await act(async () => result.current.retry())
    expect(result.current.noticeItems).toEqual([])
  })
  it('cancels the owner PUT signal before a deferred 401 replay can use the next account', async () => {
    vi.mocked(lottoApi.getPicks).mockResolvedValue({ targetRound: null, items: [] })
    const retry = deferred<{ targetRound: number | null; items: LottoHistoryItem[] }>(); vi.mocked(lottoApi.savePicks).mockReturnValue(retry.promise)
    const { result } = renderHook(() => useLottoHistory('id:A', [])); await flush(); act(() => result.current.append([item]))
    const signal = vi.mocked(lottoApi.savePicks).mock.calls[0][2]!
    act(() => login('B')); expect(signal.aborted).toBe(true)
    // Axios retains this aborted signal on its original config when replaying a 401.
    await act(async () => retry.reject(new Error('canceled replay')))
    expect(lottoApi.savePicks).toHaveBeenCalledTimes(1)
  })
  it('restarts hydration after batched A→B→A even though the final owner prop is unchanged', async () => {
    vi.mocked(lottoApi.getPicks).mockResolvedValue({ targetRound: null, items: [] })
    const { result } = renderHook(() => useLottoHistory('id:A', []))
    await flush()
    const firstSignal = vi.mocked(lottoApi.getPicks).mock.calls[0][0]!
    act(() => { login('B'); login('A') })
    await flush()
    expect(firstSignal.aborted).toBe(true)
    expect(lottoApi.getPicks).toHaveBeenCalledTimes(2)
    act(() => result.current.append([item]))
    await flush()
    expect(result.current.history).toHaveLength(1)
  })
  it('keeps a saved acknowledgement quiet on focus/result updates, reload, and login hydration', async () => {
    const acknowledged = { ...item, status: 'won' as const, prizeRank: 1 as const, winAcknowledged: true }
    vi.mocked(lottoApi.getPicks).mockResolvedValue({ targetRound: null, items: [acknowledged] })
    const first = renderHook(({ draws }) => useLottoHistory('id:A', draws), { initialProps: { draws: [draw] } })
    await flush()
    first.rerender({ draws: [{ ...draw }] })
    expect(first.result.current.noticeItems).toEqual([])
    first.unmount()
    const second = renderHook(() => useLottoHistory('id:A', [draw])); await flush()
    expect(second.result.current.noticeItems).toEqual([])
  })
  it('saves an explicit user deletion to [] through PUT and preserves local deletion on failure', async () => {
    vi.mocked(lottoApi.getPicks).mockResolvedValue({ targetRound: null, items: [item] })
    const { result } = renderHook(() => useLottoHistory('id:A', [])); await flush()
    vi.mocked(lottoApi.savePicks).mockRejectedValueOnce(new Error('offline'))
    act(() => result.current.remove([1])); await flush()
    expect(lottoApi.savePicks).toHaveBeenCalledWith(null, [], expect.any(AbortSignal))
    expect(result.current.history).toEqual([])
    expect(result.current.error).toBeTruthy()
  })
  it('replays deletion commands during hydration without replacing unrelated server winners', async () => {
    const load = deferred<{ targetRound: number | null; items: LottoHistoryItem[] }>()
    vi.mocked(lottoApi.getPicks).mockReturnValue(load.promise)
    const { result } = renderHook(() => useLottoHistory('id:A', []))
    act(() => result.current.append([{ ...item, id: 2 }]))
    act(() => result.current.remove([2]))
    const archived = { ...item, id: 3, status: 'won' as const, prizeRank: 5 as const, winAcknowledged: true }
    await act(async () => load.resolve({ targetRound: null, items: [item, archived] }))
    expect(result.current.history.map((entry) => entry.id)).toEqual([1, 3])
  })
  it('serializes a deletion after an in-flight append and never restores the deleted item', async () => {
    vi.mocked(lottoApi.getPicks).mockResolvedValue({ targetRound: null, items: [] })
    const firstSave = deferred<{ targetRound: number | null; items: LottoHistoryItem[] }>()
    vi.mocked(lottoApi.savePicks).mockReturnValueOnce(firstSave.promise)
    const { result } = renderHook(() => useLottoHistory('id:A', [])); await flush()
    act(() => result.current.append([item]))
    act(() => result.current.remove([1]))
    await act(async () => firstSave.resolve({ targetRound: null, items: [item] }))
    expect(result.current.history).toEqual([])
    expect(vi.mocked(lottoApi.savePicks).mock.calls[1][1]).toEqual([])
  })
  it('keeps a capped archive intact and gives an actionable export/delete retry message', async () => {
    vi.mocked(lottoApi.getPicks).mockResolvedValue({ targetRound: null, items: [] })
    vi.mocked(lottoApi.savePicks).mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: '히스토리가 너무 큽니다.' } } })
    const { result } = renderHook(() => useLottoHistory('id:A', [])); await flush()
    act(() => result.current.append([item])); await flush()
    expect(result.current.history).toHaveLength(1)
    expect(result.current.error).toContain('이미지로 저장한 뒤')
    expect(result.current.error).toContain('삭제하고 다시 시도')
  })
  it('does not import guest entries when logging into an account; aborts on unmount', async () => {
    login(null); vi.mocked(lottoApi.getPicks).mockResolvedValue({ targetRound: null, items: [] })
    const { result, rerender, unmount } = renderHook(({ owner }) => useLottoHistory(owner, []), { initialProps: { owner: null as string | null } })
    act(() => result.current.append([item])); expect(result.current.history).toHaveLength(1)
    act(() => login('A')); rerender({ owner: 'id:A' }); await flush(); expect(result.current.history).toEqual([])
    const signal = vi.mocked(lottoApi.getPicks).mock.calls[0][0]!; unmount(); expect(signal.aborted).toBe(true)
  })
})
