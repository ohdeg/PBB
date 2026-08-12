import { describe, expect, it } from 'vitest'
import type { LottoPatternProfileDto } from '../../../types/lotto'
import {
  blendPatternScores,
  learnedProfileFromDto,
  pickProfileForWindow,
  scoreContinuousPreference,
  scoreDiscretePreference,
} from './lottoPatternLearn'
import { scoreLottoPattern } from './lottoPatternScore'

describe('learnedProfileFromDto', () => {
  it('maps API dto into scoring profile', () => {
    const dto: LottoPatternProfileDto = {
      window: '4',
      sampleSize: 4,
      learnStrength: 0.3,
      oddCount: { counts: { '3': 2, '5': 1, '1': 1 }, mode: 3, sampleSize: 4 },
      lowCount: { counts: { '3': 4 }, mode: 3, sampleSize: 4 },
      primeCount: { counts: { '2': 4 }, mode: 2, sampleSize: 4 },
      multipleOf3Count: { counts: { '2': 4 }, mode: 2, sampleSize: 4 },
      decadeEmpty: { counts: { '1': 4 }, mode: 1, sampleSize: 4 },
      carryOver: { counts: { '0': 4 }, mode: 0, sampleSize: 4 },
      hasSameEnding: { counts: { '1': 2, '0': 2 }, mode: 0, sampleSize: 4 },
      hasConsecutive: { counts: { '0': 3, '1': 1 }, mode: 0, sampleSize: 4 },
      sum: { p10: 100, p25: 110, p50: 120, p75: 130, p90: 140, sampleSize: 4 },
      span: { p10: 20, p25: 25, p50: 30, p75: 35, p90: 40, sampleSize: 4 },
      ac: { p10: 5, p25: 6, p50: 7, p75: 8, p90: 9, sampleSize: 4 },
    }
    const profile = learnedProfileFromDto(dto)
    expect(profile).not.toBeNull()
    expect(profile!.window).toBe(4)
    expect(profile!.learnStrength).toBe(0.3)
    expect(profile!.oddCount.mode).toBe(3)
    expect(profile!.oddCount.counts.get(3)).toBe(2)
  })
})

describe('pickProfileForWindow', () => {
  it('selects by window key', () => {
    const profiles = {
      '4': {
        window: '4',
        sampleSize: 1,
        learnStrength: 0.3,
        oddCount: { counts: { '3': 1 }, mode: 3, sampleSize: 1 },
        lowCount: { counts: { '3': 1 }, mode: 3, sampleSize: 1 },
        primeCount: { counts: { '1': 1 }, mode: 1, sampleSize: 1 },
        multipleOf3Count: { counts: { '1': 1 }, mode: 1, sampleSize: 1 },
        decadeEmpty: { counts: { '1': 1 }, mode: 1, sampleSize: 1 },
        carryOver: { counts: { '0': 1 }, mode: 0, sampleSize: 1 },
        hasSameEnding: { counts: { '0': 1 }, mode: 0, sampleSize: 1 },
        hasConsecutive: { counts: { '0': 1 }, mode: 0, sampleSize: 1 },
        sum: { p10: 1, p25: 1, p50: 1, p75: 1, p90: 1, sampleSize: 1 },
        span: { p10: 1, p25: 1, p50: 1, p75: 1, p90: 1, sampleSize: 1 },
        ac: { p10: 1, p25: 1, p50: 1, p75: 1, p90: 1, sampleSize: 1 },
      } satisfies LottoPatternProfileDto,
    }
    expect(pickProfileForWindow(profiles, 4)?.learnStrength).toBe(0.3)
    expect(pickProfileForWindow(profiles, 52)).toBeNull()
  })
})

describe('score preferences', () => {
  it('scores discrete mode highest', () => {
    const pref = {
      counts: new Map([
        [3, 8],
        [2, 2],
      ]),
      mode: 3,
      sampleSize: 10,
    }
    expect(scoreDiscretePreference(3, pref)).toBe(15)
    expect(scoreDiscretePreference(2, pref)).toBe(10)
    expect(scoreDiscretePreference(0, pref)).toBe(-12)
  })

  it('scores continuous inside IQR highest', () => {
    const pref = {
      p10: 90,
      p25: 110,
      p50: 130,
      p75: 150,
      p90: 170,
      sampleSize: 20,
    }
    expect(scoreContinuousPreference(130, pref)).toBe(15)
    expect(scoreContinuousPreference(100, pref)).toBe(7)
    expect(scoreContinuousPreference(50, pref)).toBe(-10)
  })
})

describe('blendPatternScores', () => {
  it('interpolates fixed and learned', () => {
    expect(blendPatternScores(10, 0, 0)).toBe(10)
    expect(blendPatternScores(10, 0, 1)).toBe(0)
    expect(blendPatternScores(10, 0, 0.5)).toBe(5)
  })
})

describe('scoreLottoPattern with learned profile', () => {
  it('applies blended scoring when profile present', () => {
    const profile = learnedProfileFromDto({
      window: '52',
      sampleSize: 40,
      learnStrength: 0.6,
      oddCount: { counts: { '6': 40 }, mode: 6, sampleSize: 40 },
      lowCount: { counts: { '3': 40 }, mode: 3, sampleSize: 40 },
      primeCount: { counts: { '2': 40 }, mode: 2, sampleSize: 40 },
      multipleOf3Count: { counts: { '2': 40 }, mode: 2, sampleSize: 40 },
      decadeEmpty: { counts: { '1': 40 }, mode: 1, sampleSize: 40 },
      carryOver: { counts: { '0': 40 }, mode: 0, sampleSize: 40 },
      hasSameEnding: { counts: { '1': 40 }, mode: 1, sampleSize: 40 },
      hasConsecutive: { counts: { '1': 40 }, mode: 1, sampleSize: 40 },
      sum: {
        p10: 30,
        p25: 35,
        p50: 40,
        p75: 45,
        p90: 50,
        sampleSize: 40,
      },
      span: {
        p10: 10,
        p25: 10,
        p50: 10,
        p75: 10,
        p90: 10,
        sampleSize: 40,
      },
      ac: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, sampleSize: 40 },
    })
    expect(profile).not.toBeNull()
    const oddHeavy = [1, 3, 5, 7, 9, 11]
    const balanced = [1, 2, 3, 4, 5, 6]
    const learnedOdd = scoreLottoPattern(oddHeavy, {
      learnedProfile: profile,
    }).total
    const learnedBalanced = scoreLottoPattern(balanced, {
      learnedProfile: profile,
    }).total
    expect(learnedOdd).toBeGreaterThan(learnedBalanced)
  })
})
