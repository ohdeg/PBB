import { describe, expect, it } from 'vitest'
import {
  calculateACValue,
  getFirstLastSpan,
  isFirstLastSpanInSafeZone,
} from './lottoPatternScore'

describe('calculateACValue', () => {
  it('computes AC for a sample set', () => {
    // diffs among 1,2,3,4,5,6 → 15 unique diffs? pairs: 15 diffs of 1..5 unique = 5, AC = 5 - 5 = 0
    expect(calculateACValue([1, 2, 3, 4, 5, 6])).toBe(0)
  })
})

describe('first-last span safe zone', () => {
  it('measures span and safe zone', () => {
    expect(getFirstLastSpan([1, 5, 10, 20, 30, 33])).toBe(32)
    expect(isFirstLastSpanInSafeZone([1, 5, 10, 20, 30, 33])).toBe(true)
    expect(isFirstLastSpanInSafeZone([1, 2, 3, 4, 5, 6])).toBe(false)
  })
})
