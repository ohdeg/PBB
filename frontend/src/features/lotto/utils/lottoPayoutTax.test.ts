import { describe, expect, it } from 'vitest'
import { calculateLottoPayoutTax, parseWonAmountInput } from './lottoPayoutTax'

describe('calculateLottoPayoutTax', () => {
  it('is tax-free at 2_000_000', () => {
    const result = calculateLottoPayoutTax(2_000_000)
    expect(result).not.toBeNull()
    expect(result!.bracket).toBe('tax_free')
    expect(result!.taxAmount).toBe(0)
    expect(result!.netAmount).toBe(2_000_000)
  })

  it('applies 22% in the standard bracket', () => {
    const result = calculateLottoPayoutTax(10_000_000)
    expect(result).not.toBeNull()
    expect(result!.bracket).toBe('standard')
    expect(result!.taxAmount).toBe(2_200_000)
    expect(result!.netAmount).toBe(7_800_000)
  })

  it('returns null for invalid amounts', () => {
    expect(calculateLottoPayoutTax(-1)).toBeNull()
    expect(calculateLottoPayoutTax(Number.NaN)).toBeNull()
  })
})

describe('parseWonAmountInput', () => {
  it('strips non-digits', () => {
    expect(parseWonAmountInput('1,234원')).toBe(1234)
  })
})
