import { describe, expect, it } from 'vitest'
import { parseStockQtyInput, sanitizeStockQtyInput } from './vevenoStockQtyInput'

describe('sanitizeStockQtyInput', () => {
  it('drops leading zeros so 0 then 1 then 2 is 12', () => {
    expect(sanitizeStockQtyInput('0')).toBe('0')
    expect(sanitizeStockQtyInput('01')).toBe('1')
    expect(sanitizeStockQtyInput('012')).toBe('12')
  })

  it('strips non-digits and keeps empty', () => {
    expect(sanitizeStockQtyInput('')).toBe('')
    expect(sanitizeStockQtyInput('12a3')).toBe('123')
  })
})

describe('parseStockQtyInput', () => {
  it('treats empty as 0', () => {
    expect(parseStockQtyInput('')).toBe(0)
    expect(parseStockQtyInput('12')).toBe(12)
  })
})
