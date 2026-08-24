import { describe, expect, it } from 'vitest'
import { computeStockUsageForecast } from './vevenoStockForecast'

describe('computeStockUsageForecast', () => {
  it('returns none when fewer than three days', () => {
    expect(computeStockUsageForecast(10, 2, [{ qty: 2 }, { qty: 2 }])).toEqual({
      soonLow: false,
      daysOfStock: null,
    })
  })

  it('ignores zero-qty days', () => {
    expect(
      computeStockUsageForecast(10, 1, [
        { qty: 2 },
        { qty: 2 },
        { qty: 2 },
        { qty: 0 },
      ]),
    ).toEqual({ soonLow: false, daysOfStock: 5 })
  })

  it('marks soon-low when remaining is within three days', () => {
    expect(
      computeStockUsageForecast(8, 2, [{ qty: 2 }, { qty: 2 }, { qty: 2 }]),
    ).toEqual({ soonLow: true, daysOfStock: 4 })
  })

  it('skips soon-low when already at min', () => {
    expect(
      computeStockUsageForecast(2, 2, [{ qty: 2 }, { qty: 2 }, { qty: 2 }]),
    ).toEqual({ soonLow: false, daysOfStock: 1 })
  })
})
