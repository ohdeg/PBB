import { describe, expect, it } from 'vitest'
import { activeStockCheckRows, sameStockCheck } from './VevenoStockCheckHost'
import type { StockCheckRow } from '../../features/veveno/ws/live'
import type { VevenoStockCheck } from '../../types/veveno'

function check(qty = 2): VevenoStockCheck {
  return {
    requestId: 'r1',
    updatedAt: '2026-09-04T00:00:00.000Z',
    items: [
      {
        id: 10,
        categoryId: 1,
        name: '에티오피아',
        qty,
        stockMinNum: 1,
        unit: '개',
        version: 0,
      },
    ],
  }
}

function row(
  storeId: string,
  open: VevenoStockCheck | null,
  done: VevenoStockCheck | null,
): StockCheckRow {
  return { storeId, storeName: storeId, open, done }
}

describe('sameStockCheck', () => {
  it('treats equal poll payloads as the same', () => {
    expect(sameStockCheck(check(), check())).toBe(true)
    expect(sameStockCheck(null, null)).toBe(true)
  })

  it('detects qty and identity changes', () => {
    expect(sameStockCheck(check(2), check(3))).toBe(false)
    expect(sameStockCheck(check(), null)).toBe(false)
  })
})

describe('activeStockCheckRows', () => {
  const idle = row('a', null, null)
  const open = row('b', check(), null)
  const done = row('c', null, check())

  it('hides idle stores', () => {
    expect(activeStockCheckRows(new Map([['a', idle]]), false)).toEqual([])
  })

  it('shows owner open and done', () => {
    const map = new Map([
      ['a', idle],
      ['b', open],
      ['c', done],
    ])
    expect(activeStockCheckRows(map, false).map((item) => item.storeId)).toEqual(['b', 'c'])
  })

  it('shows POS open only for the bound store', () => {
    const map = new Map([
      ['b', open],
      ['c', done],
    ])
    expect(activeStockCheckRows(map, true, 'b').map((item) => item.storeId)).toEqual(['b'])
    expect(activeStockCheckRows(map, true, 'c')).toEqual([])
  })
})
