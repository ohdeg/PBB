import type {
  DietaActivityLog,
  DietaBodyLog,
  DietaCheckInLog,
  DietaDietStyle,
  DietaGoalType,
  DietaIntakeLog,
  DietaKetoEvent,
  DietaMacroPercents,
  DietaMealQueueDay,
  DietaMealQueueItem,
  DietaMealQueueStatus,
  DietaMealType,
  DietaProfile,
  DietaRecipe,
  DietaRecipeAnalyzeResult,
  DietaWeightEval,
} from '../features/dieta/types';
import type { DietaWeekProposal } from '../features/dieta/utils/dietaMath';

/** Wire shapes from Spring `/api/v1/dieta/**` (Jackson camelCase). */

export interface DietaMacroPercentsApi {
  carbPct: number;
  proteinPct: number;
  fatPct: number;
}

export interface DietaProfileApi {
  userId: string;
  heightCm: number;
  goalType: string;
  lastNonMaintainGoalType: string | null;
  weeklyTargetKg: number;
  targetWeightKg: number | null;
  weeklyBodyFatLossKg: number | null;
  weeklyMuscleGainKg: number | null;
  intensityPreference: string | null;
  bmrKcal: number;
  bmrSource: string;
  activityFactor: number;
  tdeeKcal: number;
  dietStyle: string;
  macros: DietaMacroPercentsApi;
  macrosCustomized: boolean;
  dietBaselineMethod: string | null;
  lossInitialDeficitKcal: number;
  gainInitialSurplusKcal: number;
  lossCutKcal: number;
  lossRecoverKcal: number;
  lossActivityKcal: number;
  gainSurplusKcal: number;
  gainCutKcal: number;
  gainCeilingDeltaKcal: number;
  geminiMealConsent: boolean;
  onboardingComplete: boolean;
  dailyKcal: number;
  weekStartsOn: string;
  weekActivityExtraKcal: number;
  createdAt: string;
  updatedAt: string;
}

export interface DietaBodyLogApi {
  id: string;
  loggedOn: string;
  weightKg: number | null;
  bodyFatMassKg: number | null;
  skeletalMuscleMassKg: number | null;
  fasted: boolean;
  source: string;
}

export interface DietaActivityLogApi {
  id: string;
  loggedOn: string;
  steps: number | null;
  durationMin: number | null;
  activityKcal: number | null;
  note: string | null;
}

export interface DietaKetoEventApi {
  id: string;
  recordedAt: string;
  easeRequested: boolean;
}

export interface DietaCheckInLogApi {
  id: string;
  loggedOn: string;
  weightKg: number | null;
  baselineWeightKg: number | null;
  weightDeltaKg: number | null;
  keepTargets: boolean;
  appliedDailyKcal: number;
  appliedActivityExtraKcal: number;
  appliedWeeklyTargetKg: number;
  createdAt: string;
}

export interface DietaIntakeLogApi {
  id: string;
  loggedOn: string;
  carbG: number;
  proteinG: number;
  fatG: number;
  kcal: number;
  review: string | null;
  sourceMealsJson: string | null;
}

export interface DietaMealQueueItemApi {
  id: string;
  mealType: string;
  text: string;
  addedAt: string;
}

export interface DietaMealQueueDayApi {
  loggedOn: string;
  status: string;
  items: DietaMealQueueItemApi[];
  updatedAt: string;
}

export interface DietaWeekProposalApi {
  eval: string;
  x: number | null;
  source: string | null;
  avgIntakeKcal: number;
  intakeDays: number;
  weightDeltaKg: number | null;
  fatDeltaKg: number | null;
  muscleDeltaKg: number | null;
  proposedTdee: number;
  proposedDailyKcal: number;
  proposedActivityExtraKcal: number;
  action: string;
  summary: string;
  baselineWeightKg: number | null;
  checkInWeightKg: number | null;
  weekStartsOn: string;
  due: boolean;
  targetWeightReached: boolean;
}

export interface DietaCheckInApplyApi {
  profile: DietaProfileApi;
  checkIn: DietaCheckInLogApi;
  proposal: DietaWeekProposalApi;
}

export interface DietaMealFinalizeApi {
  intake: DietaIntakeLogApi;
  queue: DietaMealQueueDayApi;
}

export interface DietaRecipeAnalyzeApi {
  recipeId: string;
  carbG: number;
  proteinG: number;
  fatG: number;
  kcal: number;
  oneLineReview: string | null;
  servings: number;
  intake: DietaIntakeLogApi;
}

export interface DietaRecipeApi {
  id: string;
  loggedOn: string;
  mealType: string | null;
  title: string;
  ingredients: string[];
  steps: string | null;
  carbG: number;
  proteinG: number;
  fatG: number;
  kcal: number;
  oneLineReview: string | null;
  servings: number;
  createdAt: string | null;
}

export interface DietaProfilePatchApi {
  heightCm?: number;
  goalType?: string;
  lastNonMaintainGoalType?: string;
  weeklyTargetKg?: number;
  targetWeightKg?: number | null;
  weeklyBodyFatLossKg?: number | null;
  weeklyMuscleGainKg?: number | null;
  intensityPreference?: string | null;
  bmrKcal?: number;
  bmrSource?: string;
  activityFactor?: number;
  tdeeKcal?: number;
  dailyKcal?: number;
  dietStyle?: string;
  macros?: DietaMacroPercents;
  macrosCustomized?: boolean;
  dietBaselineMethod?: string | null;
  lossInitialDeficitKcal?: number;
  gainInitialSurplusKcal?: number;
  lossCutKcal?: number;
  lossRecoverKcal?: number;
  lossActivityKcal?: number;
  gainSurplusKcal?: number;
  gainCutKcal?: number;
  gainCeilingDeltaKcal?: number;
  geminiMealConsent?: boolean;
  weekStartsOn?: string;
  weekActivityExtraKcal?: number;
  onboardingComplete?: boolean;
}

function asNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.length > 0) {
    return Number(value);
  }
  return 0;
}

function asNullableNumber(
  value: number | string | null | undefined,
): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asIsoDate(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value;
}

function asIsoDateTime(value: string): string {
  return value;
}

export function mapMacros(api: DietaMacroPercentsApi): DietaMacroPercents {
  return {
    carbPct: asNumber(api.carbPct),
    proteinPct: asNumber(api.proteinPct),
    fatPct: asNumber(api.fatPct),
  };
}

export function mapProfile(api: DietaProfileApi): DietaProfile {
  const lastRaw = api.lastNonMaintainGoalType;
  const lastNonMaintainGoalType: 'LOSS' | 'GAIN' =
    lastRaw === 'GAIN' || api.goalType === 'GAIN' ? 'GAIN' : 'LOSS';

  return {
    userKey: String(api.userId),
    heightCm: asNumber(api.heightCm),
    goalType: api.goalType as DietaGoalType,
    lastNonMaintainGoalType,
    weeklyTargetKg: asNumber(api.weeklyTargetKg),
    targetWeightKg: asNullableNumber(api.targetWeightKg),
    weeklyBodyFatLossKg: asNullableNumber(api.weeklyBodyFatLossKg),
    weeklyMuscleGainKg: asNullableNumber(api.weeklyMuscleGainKg),
    intensityPreference:
      api.intensityPreference === 'BOOST' || api.intensityPreference === 'HOLD'
        ? api.intensityPreference
        : null,
    bmrKcal: api.bmrKcal,
    bmrSource: api.bmrSource === 'USER_ENTERED' ? 'USER_ENTERED' : 'ESTIMATED',
    activityFactor: asNumber(api.activityFactor),
    tdeeKcal: api.tdeeKcal,
    dietStyle: api.dietStyle as DietaDietStyle,
    macros: mapMacros(api.macros),
    macrosCustomized: api.macrosCustomized,
    dietBaselineMethod:
      api.dietBaselineMethod === 'SURVEY' || api.dietBaselineMethod === 'DIARY_5D'
        ? api.dietBaselineMethod
        : null,
    lossInitialDeficitKcal: api.lossInitialDeficitKcal,
    gainInitialSurplusKcal: api.gainInitialSurplusKcal,
    lossCutKcal: api.lossCutKcal,
    lossRecoverKcal: api.lossRecoverKcal,
    lossActivityKcal: api.lossActivityKcal,
    gainSurplusKcal: api.gainSurplusKcal,
    gainCutKcal: api.gainCutKcal,
    gainCeilingDeltaKcal: api.gainCeilingDeltaKcal,
    geminiMealConsent: api.geminiMealConsent,
    onboardingComplete: api.onboardingComplete,
    dailyKcal: api.dailyKcal,
    weekStartsOn: asIsoDate(api.weekStartsOn),
    weekActivityExtraKcal: api.weekActivityExtraKcal,
    createdAt: asIsoDateTime(api.createdAt),
    updatedAt: asIsoDateTime(api.updatedAt),
  };
}

export function mapBodyLog(api: DietaBodyLogApi): DietaBodyLog {
  return {
    id: String(api.id),
    loggedOn: asIsoDate(api.loggedOn),
    weightKg: asNullableNumber(api.weightKg),
    bodyFatMassKg: asNullableNumber(api.bodyFatMassKg),
    skeletalMuscleMassKg: asNullableNumber(api.skeletalMuscleMassKg),
    fasted: api.fasted,
    source: api.source as DietaBodyLog['source'],
  };
}

export function mapActivityLog(api: DietaActivityLogApi): DietaActivityLog {
  return {
    id: String(api.id),
    loggedOn: asIsoDate(api.loggedOn),
    steps: api.steps,
    durationMin: api.durationMin,
    activityKcal: api.activityKcal,
    note: api.note ?? null,
  };
}

export function mapKetoEvent(api: DietaKetoEventApi): DietaKetoEvent {
  return {
    id: String(api.id),
    recordedAt: asIsoDateTime(api.recordedAt),
    easeRequested: api.easeRequested,
  };
}

export function mapCheckInLog(api: DietaCheckInLogApi): DietaCheckInLog {
  return {
    id: String(api.id),
    loggedOn: asIsoDate(api.loggedOn),
    weightKg: asNullableNumber(api.weightKg),
    baselineWeightKg: asNullableNumber(api.baselineWeightKg),
    weightDeltaKg: asNullableNumber(api.weightDeltaKg),
    keepTargets: api.keepTargets,
    appliedDailyKcal: api.appliedDailyKcal,
    appliedActivityExtraKcal: api.appliedActivityExtraKcal,
    appliedWeeklyTargetKg: asNumber(api.appliedWeeklyTargetKg),
    createdAt: asIsoDateTime(api.createdAt),
  };
}

export function mapIntakeLog(api: DietaIntakeLogApi): DietaIntakeLog {
  return {
    id: String(api.id),
    loggedOn: asIsoDate(api.loggedOn),
    carbG: asNumber(api.carbG),
    proteinG: asNumber(api.proteinG),
    fatG: asNumber(api.fatG),
    kcal: api.kcal,
    review: api.review ?? null,
    sourceMealsJson: api.sourceMealsJson ?? null,
  };
}

export function mapRecipeAnalyze(api: DietaRecipeAnalyzeApi): DietaRecipeAnalyzeResult {
  return {
    recipeId: api.recipeId,
    carbG: asNumber(api.carbG),
    proteinG: asNumber(api.proteinG),
    fatG: asNumber(api.fatG),
    kcal: api.kcal,
    oneLineReview: api.oneLineReview ?? null,
    servings: asNumber(api.servings ?? 1),
    intake: mapIntakeLog(api.intake),
  };
}

export function mapRecipe(api: DietaRecipeApi): DietaRecipe {
  return {
    id: String(api.id),
    loggedOn: asIsoDate(api.loggedOn),
    mealType: api.mealType ? (api.mealType as DietaMealType) : null,
    title: api.title,
    ingredients: Array.isArray(api.ingredients) ? api.ingredients.map(String) : [],
    steps: api.steps ?? null,
    carbG: asNumber(api.carbG),
    proteinG: asNumber(api.proteinG),
    fatG: asNumber(api.fatG),
    kcal: api.kcal,
    oneLineReview: api.oneLineReview ?? null,
    servings: asNumber(api.servings ?? 1),
    createdAt: api.createdAt ? asIsoDateTime(api.createdAt) : null,
  };
}

export function mapMealQueueItem(api: DietaMealQueueItemApi): DietaMealQueueItem {
  return {
    id: api.id,
    mealType: api.mealType as DietaMealType,
    text: api.text,
    addedAt: asIsoDateTime(api.addedAt),
  };
}

export function mapMealQueueDay(api: DietaMealQueueDayApi): DietaMealQueueDay {
  return {
    loggedOn: asIsoDate(api.loggedOn),
    status: api.status as DietaMealQueueStatus,
    items: (api.items ?? []).map(mapMealQueueItem),
    updatedAt: asIsoDateTime(api.updatedAt),
  };
}

const WEEK_EVALS = new Set([
  'ON_TRACK',
  'PLATEAU',
  'TOO_FAST',
  'MAINTAIN',
]);

const WEEK_SOURCES = new Set(['FAT', 'WEIGHT', 'MUSCLE']);

const WEEK_ACTIONS = new Set([
  'HOLD',
  'CUT_KCAL',
  'ADD_ACTIVITY',
  'RECOVER',
  'SURPLUS',
  'CUT_GAIN',
]);

export function mapWeekProposal(api: DietaWeekProposalApi): DietaWeekProposal {
  const evalValue = WEEK_EVALS.has(api.eval)
    ? (api.eval as DietaWeightEval | 'MAINTAIN')
    : 'ON_TRACK';
  const source =
    api.source != null && WEEK_SOURCES.has(api.source)
      ? (api.source as 'FAT' | 'WEIGHT' | 'MUSCLE')
      : null;
  const action = WEEK_ACTIONS.has(api.action)
    ? (api.action as DietaWeekProposal['action'])
    : 'HOLD';

  return {
    eval: evalValue,
    x: api.x,
    source,
    avgIntakeKcal: api.avgIntakeKcal,
    intakeDays: api.intakeDays,
    weightDeltaKg: asNullableNumber(api.weightDeltaKg),
    fatDeltaKg: asNullableNumber(api.fatDeltaKg),
    muscleDeltaKg: asNullableNumber(api.muscleDeltaKg),
    proposedTdee: api.proposedTdee,
    proposedDailyKcal: api.proposedDailyKcal,
    proposedActivityExtraKcal: api.proposedActivityExtraKcal,
    action,
    summary: api.summary,
  };
}

/** Build PATCH body from FE Partial<DietaProfile> (omit non-patchable keys). */
export function toProfilePatchBody(
  patch: Partial<DietaProfile>,
): DietaProfilePatchApi {
  const body: DietaProfilePatchApi = {};
  if (patch.heightCm !== undefined) body.heightCm = patch.heightCm;
  if (patch.goalType !== undefined) body.goalType = patch.goalType;
  if (patch.lastNonMaintainGoalType !== undefined) {
    body.lastNonMaintainGoalType = patch.lastNonMaintainGoalType;
  }
  if (patch.weeklyTargetKg !== undefined) {
    body.weeklyTargetKg = patch.weeklyTargetKg;
  }
  if (patch.targetWeightKg !== undefined) {
    body.targetWeightKg = patch.targetWeightKg;
  }
  if (patch.weeklyBodyFatLossKg !== undefined) {
    body.weeklyBodyFatLossKg = patch.weeklyBodyFatLossKg;
  }
  if (patch.weeklyMuscleGainKg !== undefined) {
    body.weeklyMuscleGainKg = patch.weeklyMuscleGainKg;
  }
  if (patch.intensityPreference !== undefined) {
    body.intensityPreference = patch.intensityPreference;
  }
  if (patch.bmrKcal !== undefined) body.bmrKcal = patch.bmrKcal;
  if (patch.bmrSource !== undefined) body.bmrSource = patch.bmrSource;
  if (patch.activityFactor !== undefined) {
    body.activityFactor = patch.activityFactor;
  }
  if (patch.tdeeKcal !== undefined) body.tdeeKcal = patch.tdeeKcal;
  if (patch.dailyKcal !== undefined) body.dailyKcal = patch.dailyKcal;
  if (patch.dietStyle !== undefined) body.dietStyle = patch.dietStyle;
  if (patch.macros !== undefined) body.macros = patch.macros;
  if (patch.macrosCustomized !== undefined) {
    body.macrosCustomized = patch.macrosCustomized;
  }
  if (patch.dietBaselineMethod !== undefined) {
    body.dietBaselineMethod = patch.dietBaselineMethod;
  }
  if (patch.lossInitialDeficitKcal !== undefined) {
    body.lossInitialDeficitKcal = patch.lossInitialDeficitKcal;
  }
  if (patch.gainInitialSurplusKcal !== undefined) {
    body.gainInitialSurplusKcal = patch.gainInitialSurplusKcal;
  }
  if (patch.lossCutKcal !== undefined) body.lossCutKcal = patch.lossCutKcal;
  if (patch.lossRecoverKcal !== undefined) {
    body.lossRecoverKcal = patch.lossRecoverKcal;
  }
  if (patch.lossActivityKcal !== undefined) {
    body.lossActivityKcal = patch.lossActivityKcal;
  }
  if (patch.gainSurplusKcal !== undefined) {
    body.gainSurplusKcal = patch.gainSurplusKcal;
  }
  if (patch.gainCutKcal !== undefined) body.gainCutKcal = patch.gainCutKcal;
  if (patch.gainCeilingDeltaKcal !== undefined) {
    body.gainCeilingDeltaKcal = patch.gainCeilingDeltaKcal;
  }
  if (patch.geminiMealConsent !== undefined) {
    body.geminiMealConsent = patch.geminiMealConsent;
  }
  if (patch.weekStartsOn !== undefined) body.weekStartsOn = patch.weekStartsOn;
  if (patch.weekActivityExtraKcal !== undefined) {
    body.weekActivityExtraKcal = patch.weekActivityExtraKcal;
  }
  if (patch.onboardingComplete !== undefined) {
    body.onboardingComplete = patch.onboardingComplete;
  }
  return body;
}
