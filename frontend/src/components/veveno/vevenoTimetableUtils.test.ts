import { describe, expect, it } from 'vitest'
import type { VevenoCalendarOccurrence } from '../../types/veveno'
import {
  layoutVevenoDayTimetableBlocks,
  type VevenoTimetableRange,
} from './vevenoTimetableUtils'

function occ(
  userId: string,
  startTime: string,
  endTime: string,
): VevenoCalendarOccurrence {
  return {
    date: '2026-08-26',
    userId,
    nickname: userId,
    startTime,
    endTime,
    overnight: false,
    type: 'REGULAR',
    coverId: null,
    relatedUserId: null,
    relatedNickname: null,
  }
}

const range: VevenoTimetableRange = {
  startHour: 8,
  endHour: 22,
  startMinutes: 8 * 60,
  totalHeight: 14 * 48,
  hourLabels: [],
}

describe('layoutVevenoDayTimetableBlocks', () => {
  it('uses full width when alone and splits only the overlap', () => {
    const segments = layoutVevenoDayTimetableBlocks(
      [occ('민수', '08:00', '16:00'), occ('지혜', '10:00', '18:00'), occ('태호', '12:00', '20:00')],
      range,
    )
    const minsu = segments.filter((row) => row.occurrence.userId === '민수')
    expect(minsu[0]?.widthPercent).toBe(100)
    expect(minsu.some((row) => row.widthPercent === 50)).toBe(true)
    expect(minsu.some((row) => row.widthPercent === 100 / 3)).toBe(true)
  })

  it('gives full width to back-to-back shifts that do not overlap', () => {
    const segments = layoutVevenoDayTimetableBlocks(
      [occ('민수', '09:00', '15:00'), occ('지혜', '15:00', '21:00')],
      range,
    )
    expect(segments).toHaveLength(2)
    expect(segments.every((row) => row.widthPercent === 100 && row.leftPercent === 0)).toBe(
      true,
    )
  })
})
