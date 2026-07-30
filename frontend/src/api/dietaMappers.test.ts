import { describe, expect, it } from 'vitest';
import {
  mapBodyLog,
  mapMealQueueDay,
  mapProfile,
  mapRecipe,
  mapRecipeAnalyze,
  mapWeekProposal,
  toProfilePatchBody,
  type DietaProfileApi,
  type DietaRecipeAnalyzeApi,
  type DietaWeekProposalApi,
} from './dietaMappers';

const sampleProfile: DietaProfileApi = {
  userId: '11111111-1111-1111-1111-111111111111',
  heightCm: 170,
  goalType: 'LOSS',
  lastNonMaintainGoalType: 'LOSS',
  weeklyTargetKg: 0.5,
  targetWeightKg: 65,
  weeklyBodyFatLossKg: 0.45,
  weeklyMuscleGainKg: null,
  intensityPreference: null,
  bmrKcal: 1600,
  bmrSource: 'ESTIMATED',
  activityFactor: 1.4,
  tdeeKcal: 2240,
  dietStyle: 'BALANCED',
  macros: { carbPct: 0.4, proteinPct: 0.3, fatPct: 0.3 },
  macrosCustomized: false,
  dietBaselineMethod: 'SURVEY',
  lossInitialDeficitKcal: 400,
  gainInitialSurplusKcal: 250,
  lossCutKcal: 175,
  lossRecoverKcal: 150,
  lossActivityKcal: 150,
  gainSurplusKcal: 250,
  gainCutKcal: 175,
  gainCeilingDeltaKcal: 500,
  geminiMealConsent: true,
  onboardingComplete: true,
  dailyKcal: 1840,
  weekStartsOn: '2026-07-20',
  weekActivityExtraKcal: 0,
  createdAt: '2026-07-20T00:00:00',
  updatedAt: '2026-07-27T00:00:00',
};

describe('dietaMappers', () => {
  it('maps profile userId to userKey and ISO dates', () => {
    const profile = mapProfile(sampleProfile);
    expect(profile.userKey).toBe(sampleProfile.userId);
    expect(profile.weekStartsOn).toBe('2026-07-20');
    expect(profile.goalType).toBe('LOSS');
    expect(profile.macros.carbPct).toBe(0.4);
  });

  it('maps BigDecimal-like string numbers from JSON', () => {
    const profile = mapProfile({
      ...sampleProfile,
      heightCm: '172.5' as unknown as number,
      weeklyTargetKg: '0.6' as unknown as number,
      targetWeightKg: null,
    });
    expect(profile.heightCm).toBe(172.5);
    expect(profile.weeklyTargetKg).toBe(0.6);
    expect(profile.targetWeightKg).toBeNull();
  });

  it('builds patch body without non-API fields', () => {
    const body = toProfilePatchBody({
      targetWeightKg: 64,
      lossCutKcal: 200,
      geminiMealConsent: false,
      userKey: 'should-omit',
      createdAt: 'nope',
    });
    expect(body).toEqual({
      targetWeightKg: 64,
      lossCutKcal: 200,
      geminiMealConsent: false,
    });
    expect(body).not.toHaveProperty('userKey');
    expect(body).not.toHaveProperty('createdAt');
  });

  it('maps week proposal action and eval', () => {
    const api: DietaWeekProposalApi = {
      eval: 'PLATEAU',
      x: 0.2,
      source: 'WEIGHT',
      avgIntakeKcal: 1800,
      intakeDays: 5,
      weightDeltaKg: -0.1,
      fatDeltaKg: null,
      muscleDeltaKg: null,
      proposedTdee: 2200,
      proposedDailyKcal: 2025,
      proposedActivityExtraKcal: 0,
      action: 'CUT_KCAL',
      summary: '정체',
      baselineWeightKg: 70,
      checkInWeightKg: 69.9,
      weekStartsOn: '2026-07-20',
      due: true,
      targetWeightReached: false,
    };
    const proposal = mapWeekProposal(api);
    expect(proposal.eval).toBe('PLATEAU');
    expect(proposal.action).toBe('CUT_KCAL');
    expect(proposal.proposedDailyKcal).toBe(2025);
  });

  it('maps recipe analyze / add-to-day response', () => {
    const api: DietaRecipeAnalyzeApi = {
      recipeId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      carbG: 20,
      proteinG: 25,
      fatG: 10,
      kcal: 270,
      oneLineReview: '든든해요',
      servings: 4,
      intake: {
        id: '11111111-2222-3333-4444-555555555555',
        loggedOn: '2026-07-30',
        carbG: 20,
        proteinG: 25,
        fatG: 10,
        kcal: 270,
        review: '든든해요',
        sourceMealsJson: '{"recipeIds":["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"]}',
      },
    };
    const mapped = mapRecipeAnalyze(api);
    expect(mapped.recipeId).toBe(api.recipeId);
    expect(mapped.kcal).toBe(270);
    expect(mapped.servings).toBe(4);
    expect(mapped.intake.loggedOn).toBe('2026-07-30');
    expect(mapped.intake.kcal).toBe(270);
  });

  it('maps body log, meal queue day, and recipe list row', () => {
    expect(
      mapBodyLog({
        id: 'b1',
        loggedOn: '2026-07-30',
        weightKg: 79.5,
        bodyFatMassKg: null,
        skeletalMuscleMassKg: null,
        fasted: true,
        source: 'DAILY_FASTED',
      }),
    ).toMatchObject({
      id: 'b1',
      loggedOn: '2026-07-30',
      weightKg: 79.5,
      source: 'DAILY_FASTED',
    });

    expect(
      mapMealQueueDay({
        loggedOn: '2026-07-30',
        status: 'open',
        items: [
          {
            id: 'i1',
            mealType: 'LUNCH',
            text: '현미밥',
            addedAt: '2026-07-30T12:00:00',
          },
        ],
        updatedAt: '2026-07-30T12:00:00',
      }),
    ).toMatchObject({
      loggedOn: '2026-07-30',
      status: 'open',
      items: [{ id: 'i1', mealType: 'LUNCH', text: '현미밥' }],
    });

    expect(
      mapRecipe({
        id: 'r1',
        loggedOn: '2026-07-30',
        mealType: 'DINNER',
        title: '된장찌개',
        ingredients: ['된장 30g'],
        steps: null,
        carbG: 10,
        proteinG: 20,
        fatG: 8,
        kcal: 192,
        oneLineReview: null,
        servings: 2,
        createdAt: '2026-07-30T10:00:00',
      }),
    ).toMatchObject({
      id: 'r1',
      mealType: 'DINNER',
      title: '된장찌개',
      servings: 2,
      kcal: 192,
    });
  });
});
