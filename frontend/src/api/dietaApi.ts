import axios from 'axios';
import type {
  DietaActivityLog,
  DietaBodyLog,
  DietaCheckInLog,
  DietaDietStyle,
  DietaIntakeLog,
  DietaKetoEvent,
  DietaMacroPercents,
  DietaMealQueueDay,
  DietaMealType,
  DietaProfile,
  DietaRecipe,
  DietaRecipeAddToDayInput,
  DietaRecipeAnalyzeInput,
  DietaRecipeAnalyzeResult,
} from '../features/dieta/types';
import { DIETA_STYLE_PRESETS } from '../features/dieta/types';
import {
  macrosFromDaily,
  type DietaPlateauChoice,
  type DietaWeekProposal,
} from '../features/dieta/utils/dietaMath';
import { getErrorMessage } from '../utils/error';
import { apiClient } from './axios';
import {
  mapActivityLog,
  mapBodyLog,
  mapCheckInLog,
  mapIntakeLog,
  mapMealQueueDay,
  mapProfile,
  mapKetoEvent,
  mapRecipe,
  mapRecipeAnalyze,
  mapWeekProposal,
  toProfilePatchBody,
  type DietaActivityLogApi,
  type DietaBodyLogApi,
  type DietaCheckInApplyApi,
  type DietaCheckInLogApi,
  type DietaIntakeLogApi,
  type DietaKetoEventApi,
  type DietaMealFinalizeApi,
  type DietaMealQueueDayApi,
  type DietaProfileApi,
  type DietaRecipeApi,
  type DietaRecipeAnalyzeApi,
  type DietaWeekProposalApi,
} from './dietaMappers';

const BASE = '/api/v1/dieta';

export interface DietaOnboardingInput {
  heightCm: number;
  weightKg: number;
  bodyFatMassKg: number | null;
  skeletalMuscleMassKg: number | null;
  ageYears: number;
  sex: 'M' | 'F';
  goalType: DietaProfile['goalType'];
  weeklyTargetKg: number;
  targetWeightKg: number | null;
  weeklyBodyFatLossKg: number | null;
  weeklyMuscleGainKg: number | null;
  intensityPreference: 'BOOST' | 'HOLD' | null;
  bmrKcal: number | null;
  activityFactor: number;
  dietStyle: DietaDietStyle;
  macros: DietaMacroPercents;
  macrosCustomized: boolean;
  lossInitialDeficitKcal: number;
  gainInitialSurplusKcal: number;
  lossCutKcal: number;
  lossRecoverKcal: number;
  lossActivityKcal: number;
  gainSurplusKcal: number;
  gainCutKcal: number;
  gainCeilingDeltaKcal: number;
  geminiMealConsent: boolean;
}

export interface DietaCheckInApplyInput {
  loggedOn: string;
  weightKg: number;
  keepTargets: boolean;
  plateauChoice?: DietaPlateauChoice | null;
  avgIntakeKcal?: number;
  intakeDays?: number;
}

export interface DietaCheckInProposalInput {
  loggedOn: string;
  weightKg: number;
  plateauChoice?: DietaPlateauChoice | null;
  avgIntakeKcal?: number;
  intakeDays?: number;
}

function rethrowDieta(error: unknown, fallback: string): never {
  throw new Error(getErrorMessage(error, fallback));
}

/**
 * Dieta HTTP client — authenticated via `apiClient` Bearer token (brew/lotto pattern).
 * Guest landing does not call these methods; logged-in routes require a session.
 * `userKey` args are ignored (kept optional for call-site compatibility).
 */
export const dietaApi = {
  async getProfile(_key?: string | null): Promise<DietaProfile | null> {
    try {
      const { data } = await apiClient.get<DietaProfileApi>(`${BASE}/profile`);
      return mapProfile(data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      rethrowDieta(error, '프로필을 불러오지 못했어요.');
    }
  },

  async completeOnboarding(
    input: DietaOnboardingInput,
    _key?: string | null,
  ): Promise<DietaProfile> {
    try {
      const { data } = await apiClient.post<DietaProfileApi>(
        `${BASE}/onboarding`,
        {
          heightCm: input.heightCm,
          weightKg: input.weightKg,
          bodyFatMassKg: input.bodyFatMassKg,
          skeletalMuscleMassKg: input.skeletalMuscleMassKg,
          ageYears: input.ageYears,
          sex: input.sex,
          goalType: input.goalType,
          weeklyTargetKg: input.weeklyTargetKg,
          targetWeightKg: input.targetWeightKg,
          weeklyBodyFatLossKg: input.weeklyBodyFatLossKg,
          weeklyMuscleGainKg: input.weeklyMuscleGainKg,
          intensityPreference: input.intensityPreference,
          bmrKcal: input.bmrKcal,
          activityFactor: input.activityFactor,
          dietStyle: input.dietStyle,
          macros: input.macros,
          macrosCustomized: input.macrosCustomized,
          lossInitialDeficitKcal: input.lossInitialDeficitKcal,
          gainInitialSurplusKcal: input.gainInitialSurplusKcal,
          lossCutKcal: input.lossCutKcal,
          lossRecoverKcal: input.lossRecoverKcal,
          lossActivityKcal: input.lossActivityKcal,
          gainSurplusKcal: input.gainSurplusKcal,
          gainCutKcal: input.gainCutKcal,
          gainCeilingDeltaKcal: input.gainCeilingDeltaKcal,
          geminiMealConsent: input.geminiMealConsent,
        },
      );
      return mapProfile(data);
    } catch (error) {
      rethrowDieta(error, '온보딩을 저장하지 못했어요.');
    }
  },

  /** Wipes all Dieta data so onboarding can run again. */
  async resetAll(_key?: string | null): Promise<void> {
    try {
      await apiClient.post(`${BASE}/reset`);
    } catch (error) {
      rethrowDieta(error, '온보딩 초기화에 실패했어요.');
    }
  },

  async updateProfile(
    patch: Partial<DietaProfile>,
    _key?: string | null,
  ): Promise<DietaProfile> {
    try {
      const { data } = await apiClient.patch<DietaProfileApi>(
        `${BASE}/profile`,
        toProfilePatchBody(patch),
      );
      return mapProfile(data);
    } catch (error) {
      rethrowDieta(error, '프로필을 저장하지 못했어요.');
    }
  },

  async setMaintainMode(
    enabled: boolean,
    _key?: string | null,
  ): Promise<DietaProfile> {
    try {
      const { data } = await apiClient.post<DietaProfileApi>(
        `${BASE}/maintain-mode`,
        { enabled },
      );
      return mapProfile(data);
    } catch (error) {
      rethrowDieta(error, '유지 모드를 바꾸지 못했어요.');
    }
  },

  async proposeCheckIn(
    input: DietaCheckInProposalInput,
    _key?: string | null,
  ): Promise<DietaWeekProposal & { targetWeightReached: boolean; due: boolean }> {
    try {
      const { data } = await apiClient.post<DietaWeekProposalApi>(
        `${BASE}/check-ins/proposal`,
        {
          loggedOn: input.loggedOn,
          weightKg: input.weightKg,
          plateauChoice: input.plateauChoice ?? null,
          avgIntakeKcal: input.avgIntakeKcal ?? null,
          intakeDays: input.intakeDays ?? null,
        },
      );
      return {
        ...mapWeekProposal(data),
        targetWeightReached: data.targetWeightReached,
        due: data.due,
      };
    } catch (error) {
      rethrowDieta(error, '주간 제안을 만들지 못했어요.');
    }
  },

  /**
   * Apply next-week targets after check-in confirm.
   * Server recomputes proposal; `keepTargets` keeps daily/W/activity extras.
   */
  async applyWeekCheckIn(
    input: DietaCheckInApplyInput,
    _key?: string | null,
  ): Promise<{
    profile: DietaProfile;
    checkIn: DietaCheckInLog;
    proposal: DietaWeekProposal;
  }> {
    try {
      const { data } = await apiClient.post<DietaCheckInApplyApi>(
        `${BASE}/check-ins/apply`,
        {
          loggedOn: input.loggedOn,
          weightKg: input.weightKg,
          keepTargets: input.keepTargets,
          plateauChoice: input.plateauChoice ?? null,
          avgIntakeKcal: input.avgIntakeKcal ?? null,
          intakeDays: input.intakeDays ?? null,
        },
      );
      return {
        profile: mapProfile(data.profile),
        checkIn: mapCheckInLog(data.checkIn),
        proposal: mapWeekProposal(data.proposal),
      };
    } catch (error) {
      rethrowDieta(error, '주간 체크인을 적용하지 못했어요.');
    }
  },

  async listCheckIns(_key?: string | null): Promise<DietaCheckInLog[]> {
    try {
      const { data } = await apiClient.get<DietaCheckInLogApi[]>(
        `${BASE}/check-ins`,
      );
      return data.map(mapCheckInLog);
    } catch (error) {
      rethrowDieta(error, '체크인 기록을 불러오지 못했어요.');
    }
  },

  async listBodyLogs(_key?: string | null): Promise<DietaBodyLog[]> {
    try {
      const { data } = await apiClient.get<DietaBodyLogApi[]>(
        `${BASE}/body-logs`,
      );
      return data.map(mapBodyLog);
    } catch (error) {
      rethrowDieta(error, '체중 기록을 불러오지 못했어요.');
    }
  },

  async upsertBodyLog(
    input: Omit<DietaBodyLog, 'id'> & { id?: string },
    _key?: string | null,
  ): Promise<DietaBodyLog> {
    try {
      const { data } = await apiClient.put<DietaBodyLogApi>(
        `${BASE}/body-logs`,
        {
          id: input.id ?? null,
          loggedOn: input.loggedOn,
          weightKg: input.weightKg,
          bodyFatMassKg: input.bodyFatMassKg,
          skeletalMuscleMassKg: input.skeletalMuscleMassKg,
          fasted: input.fasted,
          source: input.source,
        },
      );
      return mapBodyLog(data);
    } catch (error) {
      rethrowDieta(error, '체중을 저장하지 못했어요.');
    }
  },

  async listIntakes(
    loggedOn?: string,
    _key?: string | null,
  ): Promise<DietaIntakeLog[]> {
    try {
      const { data } = await apiClient.get<DietaIntakeLogApi[]>(
        `${BASE}/intakes`,
        { params: loggedOn ? { loggedOn } : undefined },
      );
      return data.map(mapIntakeLog);
    } catch (error) {
      rethrowDieta(error, '섭취 기록을 불러오지 못했어요.');
    }
  },

  async getMealQueue(
    loggedOn: string,
    _key?: string | null,
  ): Promise<DietaMealQueueDay> {
    try {
      const { data } = await apiClient.get<DietaMealQueueDayApi>(
        `${BASE}/meal-queue`,
        { params: { loggedOn } },
      );
      return mapMealQueueDay(data);
    } catch (error) {
      rethrowDieta(error, '식사 큐를 불러오지 못했어요.');
    }
  },

  async addMealQueueItem(
    input: { loggedOn: string; mealType: DietaMealType; text: string },
    _key?: string | null,
  ): Promise<DietaMealQueueDay> {
    try {
      const { data } = await apiClient.post<DietaMealQueueDayApi>(
        `${BASE}/meal-queue/items`,
        {
          loggedOn: input.loggedOn,
          mealType: input.mealType,
          text: input.text,
        },
      );
      return mapMealQueueDay(data);
    } catch (error) {
      rethrowDieta(error, '식사 큐에 추가하지 못했어요.');
    }
  },

  async removeMealQueueItem(
    input: { loggedOn: string; itemId: string },
    _key?: string | null,
  ): Promise<DietaMealQueueDay> {
    try {
      const { data } = await apiClient.delete<DietaMealQueueDayApi>(
        `${BASE}/meal-queue/items/${encodeURIComponent(input.itemId)}`,
        { params: { loggedOn: input.loggedOn } },
      );
      return mapMealQueueDay(data);
    } catch (error) {
      rethrowDieta(error, '식사 큐에서 삭제하지 못했어요.');
    }
  },

  async finalizeMealDay(
    loggedOn: string,
    _key?: string | null,
  ): Promise<{ intake: DietaIntakeLog; queue: DietaMealQueueDay }> {
    try {
      const { data } = await apiClient.post<DietaMealFinalizeApi>(
        `${BASE}/meal-queue/finalize`,
        { loggedOn },
      );
      return {
        intake: mapIntakeLog(data.intake),
        queue: mapMealQueueDay(data.queue),
      };
    } catch (error) {
      rethrowDieta(error, '하루 식단을 마감하지 못했어요.');
    }
  },

  async autoFinalizeYesterday(
    _key?: string | null,
  ): Promise<{ intake: DietaIntakeLog; queue: DietaMealQueueDay } | null> {
    try {
      const res = await apiClient.post<DietaMealFinalizeApi | ''>(
        `${BASE}/meal-queue/auto-finalize-yesterday`,
      );
      if (res.status === 204 || res.data == null || res.data === '') {
        return null;
      }
      return {
        intake: mapIntakeLog(res.data.intake),
        queue: mapMealQueueDay(res.data.queue),
      };
    } catch (error) {
      rethrowDieta(error, '어제 식단 자동 마감에 실패했어요.');
    }
  },

  async listRecipes(
    loggedOn?: string | null,
    _key?: string | null,
  ): Promise<DietaRecipe[]> {
    try {
      const { data } = await apiClient.get<DietaRecipeApi[]>(`${BASE}/recipes`, {
        params: loggedOn ? { loggedOn } : undefined,
      });
      return data.map(mapRecipe);
    } catch (error) {
      rethrowDieta(error, '레시피 목록을 불러오지 못했어요.');
    }
  },

  async analyzeRecipe(
    input: DietaRecipeAnalyzeInput,
    _key?: string | null,
  ): Promise<DietaRecipeAnalyzeResult> {
    try {
      const { data } = await apiClient.post<DietaRecipeAnalyzeApi>(
        `${BASE}/recipes/analyze`,
        {
          loggedOn: input.loggedOn,
          title: input.title,
          ingredients: input.ingredients,
          steps: input.steps ?? null,
          servings: input.servings,
        },
      );
      return mapRecipeAnalyze(data);
    } catch (error) {
      rethrowDieta(error, '레시피 분석에 실패했어요.');
    }
  },

  async addRecipeToDay(
    input: DietaRecipeAddToDayInput,
    _key?: string | null,
  ): Promise<DietaRecipeAnalyzeResult> {
    try {
      const body: { loggedOn: string; mealType?: string } = {
        loggedOn: input.loggedOn,
      };
      if (input.mealType) {
        body.mealType = input.mealType;
      }
      const { data } = await apiClient.post<DietaRecipeAnalyzeApi>(
        `${BASE}/recipes/${input.recipeId}/add-to-day`,
        body,
      );
      return mapRecipeAnalyze(data);
    } catch (error) {
      rethrowDieta(error, '레시피를 오늘 섭취에 더하지 못했어요.');
    }
  },

  async listActivities(_key?: string | null): Promise<DietaActivityLog[]> {
    try {
      const { data } = await apiClient.get<DietaActivityLogApi[]>(
        `${BASE}/activities`,
      );
      return data.map(mapActivityLog);
    } catch (error) {
      rethrowDieta(error, '활동 기록을 불러오지 못했어요.');
    }
  },

  async upsertActivity(
    input: {
      loggedOn: string;
      steps: number | null;
      durationMin: number | null;
      activityKcal: number | null;
      note?: string | null;
    },
    _key?: string | null,
  ): Promise<DietaActivityLog> {
    try {
      const { data } = await apiClient.put<DietaActivityLogApi>(
        `${BASE}/activities`,
        {
          loggedOn: input.loggedOn,
          steps: input.steps,
          durationMin: input.durationMin,
          activityKcal: input.activityKcal,
          note: input.note ?? null,
        },
      );
      return mapActivityLog(data);
    } catch (error) {
      rethrowDieta(error, '활동을 저장하지 못했어요.');
    }
  },

  async listKetoEvents(_key?: string | null): Promise<DietaKetoEvent[]> {
    try {
      const { data } = await apiClient.get<DietaKetoEventApi[]>(
        `${BASE}/keto-events`,
      );
      return data.map(mapKetoEvent);
    } catch (error) {
      rethrowDieta(error, '키토 기록을 불러오지 못했어요.');
    }
  },

  async recordKeto(
    easeRequested: boolean,
    _key?: string | null,
  ): Promise<DietaKetoEvent> {
    try {
      const { data } = await apiClient.post<DietaKetoEventApi>(
        `${BASE}/keto-events`,
        { easeRequested },
      );
      return mapKetoEvent(data);
    } catch (error) {
      rethrowDieta(error, '키토 기록을 저장하지 못했어요.');
    }
  },

  macrosPreview(daily: number, macros: DietaMacroPercents) {
    return macrosFromDaily(daily, macros);
  },

  defaultMacros(style: DietaDietStyle): DietaMacroPercents {
    return { ...DIETA_STYLE_PRESETS[style] };
  },
};
