import { describe, expect, it } from 'vitest'
import {
  applyHour12Change,
  formatHHmm,
  hour12FromH24,
  isPm,
  parseHHmm,
  stepHour,
  withPeriod,
} from './vevenoTime'

describe('vevenoTime', () => {
  it('steps 오전 11시 to 오후 12시, not 0시', () => {
    expect(applyHour12Change(11, 12)).toBe(12)
    expect(isPm(12)).toBe(true)
    expect(hour12FromH24(12)).toBe(12)
    expect(formatHHmm(12, 0)).toBe('12:00')
  })

  it('steps 오후 11시 to 오전 12시', () => {
    expect(applyHour12Change(23, 12)).toBe(0)
    expect(isPm(0)).toBe(false)
  })

  it('steps 정오 to 오후 1시', () => {
    expect(applyHour12Change(12, 1)).toBe(13)
  })

  it('toggles 오전/오후 by 12 hours', () => {
    expect(withPeriod(11, true)).toBe(23)
    expect(withPeriod(12, false)).toBe(0)
    expect(stepHour(11, 1)).toBe(12)
  })

  it('parses HH:mm:ss', () => {
    expect(parseHHmm('09:30:00')).toEqual({ h24: 9, minute: 30 })
  })
})
