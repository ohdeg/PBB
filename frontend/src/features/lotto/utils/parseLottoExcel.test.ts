import { describe, expect, it } from 'vitest'
import { parseRoundCell, getMaxRoundFromDraws } from './parseLottoExcel'
import type { LottoDraw } from '../../../types/lotto'

describe('parseRoundCell', () => {
  it('parses numeric and labeled rounds', () => {
    expect(parseRoundCell(1222)).toBe(1222)
    expect(parseRoundCell('제1222회')).toBe(1222)
    expect(parseRoundCell('1222회')).toBe(1222)
  })

  it('returns NaN for invalid values', () => {
    expect(Number.isNaN(parseRoundCell(''))).toBe(true)
    expect(Number.isNaN(parseRoundCell(null))).toBe(true)
  })
})

describe('getMaxRoundFromDraws', () => {
  it('returns the highest round', () => {
    const draws: LottoDraw[] = [
      {
        round: 10,
        mainNumbers: [1, 2, 3, 4, 5, 6],
        bonusNumber: 7,
        drawDate: '2026-01-01',
        firstPrizeAmount: null,
        firstPrizeWinnerCount: null,
      },
      {
        round: 12,
        mainNumbers: [1, 2, 3, 4, 5, 8],
        bonusNumber: 9,
        drawDate: '2026-01-08',
        firstPrizeAmount: null,
        firstPrizeWinnerCount: null,
      },
    ]
    expect(getMaxRoundFromDraws(draws)).toBe(12)
  })
})
