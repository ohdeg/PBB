// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { toPng } from 'html-to-image'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lottoApi } from '../api/lottoApi'
import { useAuthStore } from '../stores/authStore'
import { LottoPage } from './LottoPage'
import type { LottoDraw, LottoHistoryItem } from '../types/lotto'

vi.mock('../api/lottoApi', () => ({ lottoApi: {
  listDraws: vi.fn(), patternProfiles: vi.fn(), getPicks: vi.fn(), savePicks: vi.fn(),
} }))
vi.mock('html-to-image', () => ({ toPng: vi.fn() }))
vi.mock('../features/lotto/components/SixPickSplashScreen', () => ({ SixPickSplashScreen: () => null }))
const draw: LottoDraw = { round: 1200, mainNumbers: [1, 2, 3, 4, 5, 6], bonusNumber: 7 }
const pick: LottoHistoryItem = {
  id: 1, name: 'A private numbers', category: '', reviews: 'A private history', icon: '', color: '',
  numbers: [8, 9, 10, 11, 12, 13], status: 'pending', targetRound: 1201,
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = async () => { await act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }) }
const view = () => render(<MemoryRouter><LottoPage /></MemoryRouter>)
const login = (id: string) => useAuthStore.setState({ accessToken: `token-${id}`, userId: id, email: `${id}@example.com` })
const generationButton = () => screen.getByRole('button', { name: /1게임 추첨/ })

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.getState().clearAuth()
  vi.mocked(lottoApi.patternProfiles).mockResolvedValue({ data: { profiles: {} } } as Awaited<ReturnType<typeof lottoApi.patternProfiles>>)
  vi.mocked(lottoApi.getPicks).mockResolvedValue({ targetRound: null, items: [] })
  vi.mocked(lottoApi.savePicks).mockImplementation(async (targetRound, items) => ({ targetRound, items }))
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('LottoPage history boundaries', () => {
  it('blocks generation until authoritative draws load and assigns the actual next round', async () => {
    const load = deferred<Awaited<ReturnType<typeof lottoApi.listDraws>>>()
    vi.mocked(lottoApi.listDraws).mockReturnValue(load.promise)
    view()
    expect(generationButton()).toBeDisabled()
    fireEvent.click(generationButton())
    expect(screen.queryByRole('button', { name: '건너뛰기' })).not.toBeInTheDocument()
    await act(async () => load.resolve({ data: [draw] } as Awaited<ReturnType<typeof lottoApi.listDraws>>))
    expect(generationButton()).toBeEnabled()
    vi.useFakeTimers()
    fireEvent.click(generationButton())
    fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }))
    await act(async () => vi.advanceTimersByTimeAsync(500))
    expect(screen.getByText('1201회 · 추첨 대기')).toBeInTheDocument()
    expect(screen.queryByText('1회 · 결과 확인 대기')).not.toBeInTheDocument()
  })
  it('keeps generation disabled on initial load failure and provides a retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(lottoApi.listDraws).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: [draw] } as Awaited<ReturnType<typeof lottoApi.listDraws>>)
    view(); await flush()
    expect(generationButton()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '회차 다시 불러오기' }))
    await flush()
    expect(generationButton()).toBeEnabled()
  })
  it('invalidates generation and resets its UI after a batched A→B→A transition', async () => {
    vi.mocked(lottoApi.listDraws).mockResolvedValue({ data: [draw] } as Awaited<ReturnType<typeof lottoApi.listDraws>>)
    login('A'); view(); await flush()
    vi.useFakeTimers()
    fireEvent.click(generationButton())
    expect(screen.getByRole('button', { name: '건너뛰기' })).toBeInTheDocument()
    act(() => { login('B'); login('A') })
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(screen.queryByRole('button', { name: '건너뛰기' })).not.toBeInTheDocument()
    expect(lottoApi.savePicks).not.toHaveBeenCalled()
  })
  it('clears hidden export history and cancels a completed capture after an account switch', async () => {
    vi.mocked(lottoApi.listDraws).mockResolvedValue({ data: [draw] } as Awaited<ReturnType<typeof lottoApi.listDraws>>)
    vi.mocked(lottoApi.getPicks).mockImplementation(async () => ({ targetRound: null, items: useAuthStore.getState().userId === 'A' ? [pick] : [] }))
    const capture = deferred<string>(); vi.mocked(toPng).mockReturnValue(capture.promise)
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    login('A'); view(); await flush()
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'A private numbers 이 번호만 저장' }))
    await act(async () => vi.advanceTimersByTimeAsync(150))
    expect(toPng).toHaveBeenCalledTimes(1)
    act(() => login('B')); await flush()
    expect(document.getElementById('lotto-hidden-export-container')?.textContent).not.toContain('A private history')
    await act(async () => capture.resolve('data:image/png;base64,test'))
    expect(download).not.toHaveBeenCalled()
  })
  it('keeps exactly one ticket dialog when the parent rerenders with the same owner', async () => {
    vi.mocked(lottoApi.listDraws).mockResolvedValue({data:[draw]} as Awaited<ReturnType<typeof lottoApi.listDraws>>)
    login('A'); view(); await flush()
    fireEvent.click(screen.getByRole('button',{name:'용지 등록',exact:true}))
    fireEvent.click(screen.getByRole('button',{name:'직접 입력',exact:true}))
    fireEvent.change(screen.getByLabelText('회차'),{target:{value:'1201'}})
    act(()=>useAuthStore.setState({accessToken:'rotated-same-owner'}))
    await flush()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByLabelText('회차')).toHaveValue('1201')
  })

  it('discards ticket drafts after batched account changes', async () => {
    vi.mocked(lottoApi.listDraws).mockResolvedValue({data:[draw]} as Awaited<ReturnType<typeof lottoApi.listDraws>>)
    login('A'); view(); await flush()
    fireEvent.click(screen.getByRole('button',{name:'용지 등록',exact:true}))
    fireEvent.click(screen.getByRole('button',{name:'직접 입력',exact:true}))
    fireEvent.change(screen.getByLabelText('회차'),{target:{value:'1201'}})
    act(()=>{login('B');login('A')});await flush()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(lottoApi.savePicks).not.toHaveBeenCalled()
  })

})
