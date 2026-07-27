import { describe, expect, it } from 'vitest'
import {
  normalizeMainNumbers,
  validateDrawInput,
  getNextSuggestedRound,
} from './lottoDrawStats'
import type { LottoDraw } from '../../../types/lotto'

describe('normalizeMainNumbers', () => {
  it('sorts valid unique numbers', () => {
    expect(normalizeMainNumbers([6, 1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('rejects duplicates and out-of-range', () => {
    expect(normalizeMainNumbers([1, 1, 2, 3, 4, 5])).toBeNull()
    expect(normalizeMainNumbers([1, 2, 3, 4, 5, 46])).toBeNull()
  })
})

describe('validateDrawInput', () => {
  it('validates round and numbers', () => {
    expect(validateDrawInput(1, [1, 2, 3, 4, 5, 6])).toBeNull()
    expect(validateDrawInput(0, [1, 2, 3, 4, 5, 6])).toMatch(/회차/)
  })
})

describe('getNextSuggestedRound', () => {
  it('increments from latest', () => {
    const draws: LottoDraw[] = [
      { round: 5, mainNumbers: [1, 2, 3, 4, 5, 6] },
    ]
    expect(getNextSuggestedRound(draws)).toBe(6)
    expect(getNextSuggestedRound([])).toBe(1)
  })
})
