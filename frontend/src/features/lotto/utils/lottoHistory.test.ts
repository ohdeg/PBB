import { describe, expect, it } from 'vitest'
import type { LottoDraw, LottoHistoryItem } from '../../../types/lotto'
import { migrateLottoHistory, settleLottoHistory, getHistoryForTab, getHistoryActionItems, removeHistoryItems, getWinNoticeMessage } from './lottoHistory'

const draw: LottoDraw = { round: 1200, mainNumbers: [1, 2, 3, 4, 5, 6], bonusNumber: 7, drawDate: '2026-10-24' }
const pick = (numbers: number[], extra: Partial<LottoHistoryItem> = {}): LottoHistoryItem => ({ id: 1, name: numbers.join(', '), category: 'random', reviews: '', icon: '🎰', color: '', numbers, targetRound: 1200, status: 'pending', ...extra })

describe('sixpick history', () => {
  it.each([
    [[1, 2, 3, 4, 5, 6], 1], [[1, 2, 3, 4, 5, 7], 2],
    [[1, 2, 3, 4, 5, 8], 3], [[1, 2, 3, 4, 8, 9], 4], [[1, 2, 3, 8, 9, 10], 5],
  ])('settles %j to rank %i', (numbers, rank) => {
    expect(settleLottoHistory([pick(numbers as number[])], [draw])[0]).toMatchObject({ status: 'won', prizeRank: rank, winAcknowledged: false })
  })
  it('deletes only losing pending items with complete matching results', () => {
    const items = [pick([8, 9, 10, 11, 12, 13]), pick([8, 9, 10, 11, 12, 13], { id: 2, targetRound: 1199 }), pick([1, 2, 3, 4, 5, 6], { id: 3, targetRound: null }), pick([1, 1, 2, 3, 4, 5], { id: 4 })]
    expect(settleLottoHistory(items, [draw]).map((item) => item.id)).toEqual([2, 3, 4])
  })
  it.each([{ ...draw, bonusNumber: null }, { ...draw, bonusNumber: 6 }, { ...draw, mainNumbers: [1, 1, 2, 3, 4, 5] }, { ...draw, mainNumbers: [1, 2, 3] }])('preserves items for incomplete/invalid draw %j', (result) => {
    const items = [pick([8, 9, 10, 11, 12, 13])]
    expect(settleLottoHistory(items, [result])).toBe(items)
  })
  it('never resettles or removes archived wins', () => {
    const item = pick([8, 9, 10, 11, 12, 13], { status: 'won', prizeRank: 5, winAcknowledged: true })
    expect(settleLottoHistory([item], [draw])[0]).toBe(item)
  })
  it('inherits legacy root only for absent pending round; explicit null/invalid and archived unknown stay unknown', () => {
    const legacy = pick([1, 2, 3, 4, 5, 6]); delete legacy.targetRound
    const archived = { ...legacy, status: 'won' as const, prizeRank: 1 as const }
    expect(migrateLottoHistory([legacy, { ...legacy, targetRound: null }, { ...legacy, targetRound: -1 }, archived], 1200).map((item) => item.targetRound)).toEqual([1200, null, null, null])
  })
  it('sorts archive newest round first and scopes selection/export/deletion', () => {
    const items = [pick([1, 2, 3, 4, 5, 6]), pick([], { id: 2, status: 'won', prizeRank: 1, targetRound: 1198 }), pick([], { id: 3, status: 'won', prizeRank: 3, targetRound: 1199 })]
    expect(getHistoryForTab(items, 'won').map((item) => item.id)).toEqual([3, 2])
    expect(getHistoryActionItems(items, 'pending', [2, 1]).map((item) => item.id)).toEqual([1])
    expect(removeHistoryItems(items, 'won', []).map((item) => item.id)).toEqual([1])
  })
  it('uses exact private current-week copy, generic for historical or unknown date', () => {
    const item = pick([], { status: 'won', prizeRank: 1 })
    const now = new Date('2026-10-25T01:00:00Z')
    expect(getWinNoticeMessage([item], [draw], now)).toBe('축하드립니다. 이번 주 당첨된 번호가 있습니다.')
    expect(getWinNoticeMessage([item], [{ ...draw, drawDate: '2026-10-17' }], now)).toBe('축하드립니다. 당첨된 번호가 있습니다.')
    expect(getWinNoticeMessage([item], [{ ...draw, drawDate: null }], now)).toBe('축하드립니다. 당첨된 번호가 있습니다.')
  })
  it('uses Korean Monday boundaries and rejects invalid or future draw dates', () => {
    const item = pick([], { status: 'won', prizeRank: 1 })
    const koreanMonday = new Date('2026-10-25T15:30:00Z')
    const current = '축하드립니다. 이번 주 당첨된 번호가 있습니다.'
    const historical = '축하드립니다. 당첨된 번호가 있습니다.'
    expect(getWinNoticeMessage([item], [{ ...draw, drawDate: '2026-10-26' }], koreanMonday)).toBe(current)
    for (const drawDate of ['2026-10-25', '2026-10-27', '2026-02-30', 'unavailable']) {
      expect(getWinNoticeMessage([item], [{ ...draw, drawDate }], koreanMonday)).toBe(historical)
    }
  })

})
