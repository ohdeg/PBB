import { describe, expect, it } from 'vitest'
import {
  activityFromExtraKcal,
  applyGainDaily,
  applyLossDaily,
  averageDailyIntakeKcal,
  buildWeeklyCheckInProposal,
  computeTdee,
  computeWeeklyX,
  conservativeActivityFactor,
  daysBetweenIso,
  estimateBmrKcal,
  estimateTdeeFromIntake,
  evaluateWeeklyX,
  findCheckInBaseline,
  isWeeklyCheckInDue,
  kcalFromMacros,
  macrosFromDaily,
} from './dietaMath'

describe('estimateBmrKcal / computeTdee', () => {
  it('estimates Mifflin–St Jeor BMR and TDEE', () => {
    const bmr = estimateBmrKcal({
      weightKg: 80,
      heightCm: 175,
      ageYears: 30,
      sex: 'M',
    })
    expect(bmr).toBeGreaterThan(1600)
    expect(computeTdee(bmr, 1.4)).toBeGreaterThanOrEqual(bmr)
  })

  it('applies conservative activity factor for TDEE', () => {
    expect(conservativeActivityFactor(1.2)).toBe(1.2)
    expect(conservativeActivityFactor(1.4)).toBeCloseTo(1.3, 5)
    expect(conservativeActivityFactor(1.725)).toBeCloseTo(1.54375, 5)
    // raw 1.4 → effective 1.3, not full 1.4
    expect(computeTdee(2000, 1.4)).toBe(2600)
    expect(computeTdee(2000, 1.725)).toBe(3088)
  })
})

describe('macros / floors', () => {
  it('converts macros and floors LOSS daily at BMR', () => {
    expect(macrosFromDaily(2000, { carbPct: 0.4, proteinPct: 0.3, fatPct: 0.3 })).toEqual({
      carbG: 200,
      proteinG: 150,
      fatG: 67,
    })
    expect(kcalFromMacros(200, 150, 67)).toBe(200 * 4 + 150 * 4 + 67 * 9)
    expect(applyLossDaily(1200, 1500)).toBe(1500)
    expect(applyGainDaily(4000, 2500, 500)).toBe(3000)
  })
})

describe('weekly X / bands', () => {
  it('computes weight-based X and band eval', () => {
    expect(computeWeeklyX({ goalType: 'LOSS', fatDeltaKg: null, weightDeltaKg: -1.2 })).toEqual({
      x: 1,
      source: 'WEIGHT',
    })
    expect(computeWeeklyX({ goalType: 'MAINTAIN', fatDeltaKg: null, weightDeltaKg: -1 })).toEqual({
      x: null,
      source: null,
    })
    expect(evaluateWeeklyX(0.2, 0.5)).toBe('PLATEAU')
    expect(evaluateWeeklyX(0.5, 0.5)).toBe('ON_TRACK')
    expect(evaluateWeeklyX(0.8, 0.5)).toBe('TOO_FAST')
  })
})

describe('TDEE from intake', () => {
  it('estimates from weight balance', () => {
    const est = estimateTdeeFromIntake({
      avgIntakeKcal: 2000,
      fatDeltaKg: null,
      weightDeltaKg: -1.2,
      bmr: 1500,
    })
    expect(est.source).toBe('INTAKE_WEIGHT_BALANCE')
    expect(est.tdee).toBe(3100)
  })
})

describe('check-in helpers', () => {
  it('detects due week and baseline', () => {
    expect(daysBetweenIso('2026-07-20', '2026-07-27')).toBe(7)
    expect(isWeeklyCheckInDue('2026-07-20', '2026-07-27')).toBe(true)
    expect(isWeeklyCheckInDue('2026-07-20', '2026-07-26')).toBe(false)

    const baseline = findCheckInBaseline(
      [
        { loggedOn: '2026-07-10', weightKg: 80, source: 'ONBOARDING' },
        { loggedOn: '2026-07-20', weightKg: 79, source: 'CHECK_IN' },
        { loggedOn: '2026-07-25', weightKg: 78.5, source: 'DAILY_FASTED' },
      ],
      '2026-07-27',
    )
    expect(baseline?.loggedOn).toBe('2026-07-20')
    expect(baseline?.weightKg).toBe(79)
  })

  it('averages intake by day', () => {
    const avg = averageDailyIntakeKcal(
      [
        { loggedOn: '2026-07-21', kcal: 1800 },
        { loggedOn: '2026-07-21', kcal: 200 },
        { loggedOn: '2026-07-22', kcal: 2000 },
        { loggedOn: '2026-07-27', kcal: 9999 },
      ],
      '2026-07-20',
      '2026-07-27',
    )
    expect(avg.dayCount).toBe(2)
    expect(avg.avgKcal).toBe(2000)
  })
})

describe('activityFromExtraKcal', () => {
  it('falls back without weight', () => {
    expect(activityFromExtraKcal({ extraKcal: 150, weightKg: null, heightCm: 175 })).toEqual({
      steps: 3000,
      minutesBrisk: 25,
      minutesMod: 15,
    })
  })
})

describe('buildWeeklyCheckInProposal', () => {
  const base = {
    weeklyTargetKg: 0.5,
    currentDailyKcal: 2000,
    currentTdee: 2400,
    bmr: 1600,
    lossCutKcal: 175,
    lossRecoverKcal: 150,
    lossActivityKcal: 150,
    gainSurplusKcal: 250,
    gainCutKcal: 175,
    gainCeilingDeltaKcal: 500,
    avgIntakeKcal: 1900,
    intakeDays: 5,
    fatDeltaKg: null,
    muscleDeltaKg: null,
    plateauChoice: 'CUT_KCAL' as const,
  }

  it('LOSS plateau prefers cut when above BMR', () => {
    const p = buildWeeklyCheckInProposal({
      ...base,
      goalType: 'LOSS',
      weightDeltaKg: -0.1,
    })
    expect(p.eval).toBe('PLATEAU')
    expect(p.action).toBe('CUT_KCAL')
    expect(p.proposedDailyKcal).toBe(1825)
    expect(p.proposedActivityExtraKcal).toBe(0)
  })

  it('LOSS too-fast recovers', () => {
    const p = buildWeeklyCheckInProposal({
      ...base,
      goalType: 'LOSS',
      weightDeltaKg: -1.2,
    })
    expect(p.eval).toBe('TOO_FAST')
    expect(p.action).toBe('RECOVER')
    expect(p.proposedDailyKcal).toBe(2150)
  })

  it('MAINTAIN holds at estimated TDEE', () => {
    const p = buildWeeklyCheckInProposal({
      ...base,
      goalType: 'MAINTAIN',
      weightDeltaKg: 0,
    })
    expect(p.eval).toBe('MAINTAIN')
    expect(p.action).toBe('HOLD')
    expect(p.proposedActivityExtraKcal).toBe(0)
  })
})
