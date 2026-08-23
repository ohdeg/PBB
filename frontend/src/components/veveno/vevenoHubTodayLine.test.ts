import { describe, expect, it } from 'vitest'
import type { VevenoChecklistToday } from '../../types/veveno'
import { hubTodayLine } from './vevenoHubTodayLine'

function list(
  partial: Pick<VevenoChecklistToday, 'triggerType' | 'due' | 'checkedCount' | 'totalCount'>,
): VevenoChecklistToday {
  return {
    templateId: 't',
    title: 'x',
    personal: false,
    interrupt: false,
    items: [],
    ...partial,
  }
}

describe('hubTodayLine', () => {
  it('formats due open and close', () => {
    expect(
      hubTodayLine([
        list({ triggerType: 'SHIFT_START', due: true, checkedCount: 3, totalCount: 8 }),
        list({ triggerType: 'SHIFT_END', due: true, checkedCount: 0, totalCount: 6 }),
      ]),
    ).toBe('오픈 3/8 · 마감 아직')
  })

  it('uses 완료 when all checked', () => {
    expect(
      hubTodayLine([
        list({ triggerType: 'SHIFT_START', due: true, checkedCount: 8, totalCount: 8 }),
      ]),
    ).toBe('오픈 완료')
  })

  it('ignores not-due and non-shift lists', () => {
    expect(
      hubTodayLine([
        list({ triggerType: 'SHIFT_START', due: false, checkedCount: 0, totalCount: 8 }),
        list({ triggerType: 'CLOCK', due: true, checkedCount: 1, totalCount: 2 }),
        list({ triggerType: 'MANUAL', due: true, checkedCount: 0, totalCount: 1 }),
      ]),
    ).toBeUndefined()
  })

  it('picks first due open only', () => {
    expect(
      hubTodayLine([
        list({ triggerType: 'SHIFT_START', due: true, checkedCount: 1, totalCount: 4 }),
        list({ triggerType: 'SHIFT_START', due: true, checkedCount: 2, totalCount: 4 }),
      ]),
    ).toBe('오픈 1/4')
  })
})
