export type DietaGoalType = 'LOSS' | 'GAIN' | 'MAINTAIN';

export type DietaDietStyle = 'BALANCED' | 'TRAINING' | 'KETO' | 'VEGAN';

export type DietaMealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

export type DietaWeightEval = 'ON_TRACK' | 'PLATEAU' | 'TOO_FAST';

export type DietaAdjustmentAction =
  | 'HOLD'
  | 'EASE'
  | 'CUT_KCAL'
  | 'ADD_ACTIVITY'
  | 'RECOVER'
  | 'SURPLUS'
  | 'CUT_FAT_GAIN';

export type DietaMealQueueStatus = 'open' | 'pending' | 'done' | 'failed';

export interface DietaMacroPercents {
  carbPct: number;
  proteinPct: number;
  fatPct: number;
}

export interface DietaProfile {
  userKey: string;
  heightCm: number;
  goalType: DietaGoalType;
  /** Remembered LOSS/GAIN for leaving MAINTAIN (Settings toggle). */
  lastNonMaintainGoalType: 'LOSS' | 'GAIN';
  weeklyTargetKg: number;
  /** Goal body weight; LOSS/GAIN use for auto-switch to MAINTAIN. */
  targetWeightKg: number | null;
  weeklyBodyFatLossKg: number | null;
  weeklyMuscleGainKg: number | null;
  intensityPreference: 'BOOST' | 'HOLD' | null;
  bmrKcal: number;
  bmrSource: 'USER_ENTERED' | 'ESTIMATED';
  activityFactor: number;
  tdeeKcal: number;
  dietStyle: DietaDietStyle;
  macros: DietaMacroPercents;
  macrosCustomized: boolean;
  dietBaselineMethod: 'SURVEY' | 'DIARY_5D' | null;
  lossInitialDeficitKcal: number;
  gainInitialSurplusKcal: number;
  lossCutKcal: number;
  lossRecoverKcal: number;
  lossActivityKcal: number;
  gainSurplusKcal: number;
  gainCutKcal: number;
  gainCeilingDeltaKcal: number;
  /** Required for end-of-day Gemini meal analysis. */
  geminiMealConsent: boolean;
  onboardingComplete: boolean;
  dailyKcal: number;
  weekStartsOn: string;
  /** Confirmed extra activity kcal target for the current coaching week. */
  weekActivityExtraKcal: number;
  createdAt: string;
  updatedAt: string;
}

export interface DietaBodyLog {
  id: string;
  loggedOn: string;
  weightKg: number | null;
  bodyFatMassKg: number | null;
  skeletalMuscleMassKg: number | null;
  fasted: boolean;
  source: 'DAILY_FASTED' | 'ONBOARDING' | 'CHECK_IN' | 'MANUAL';
}

export interface DietaMealQueueItem {
  id: string;
  mealType: DietaMealType;
  text: string;
  addedAt: string;
}

/** Day queue (Redis `dieta:mealq:{user}:{date}` — FE stub in localStorage). */
export interface DietaMealQueueDay {
  loggedOn: string;
  status: DietaMealQueueStatus;
  items: DietaMealQueueItem[];
  updatedAt: string;
}

/** Gemini finalize result persisted to intake log. */
export interface DietaIntakeLog {
  id: string;
  loggedOn: string;
  carbG: number;
  proteinG: number;
  fatG: number;
  kcal: number;
  review: string | null;
  /** Snapshot: queue meals + recipeIds[] + optional queueTotals/knownRecipes. */
  sourceMealsJson: string | null;
}

/** Day-scoped homemade recipe row from `dieta_recipes`. */
export interface DietaRecipe {
  id: string;
  loggedOn: string;
  /** Null on create/library source; set when copied via add-to-day. */
  mealType: DietaMealType | null;
  title: string;
  ingredients: string[];
  steps: string | null;
  /** Per 1 serving. */
  carbG: number;
  proteinG: number;
  fatG: number;
  kcal: number;
  oneLineReview: string | null;
  /** Batch servings entered at create; macros are per 1 serving. */
  servings: number;
  createdAt: string | null;
}

/** Immediate homemade-recipe Gemini analysis result (macros = per 1 serving). */
export interface DietaRecipeAnalyzeResult {
  recipeId: string;
  carbG: number;
  proteinG: number;
  fatG: number;
  kcal: number;
  oneLineReview: string | null;
  servings: number;
  intake: DietaIntakeLog;
}

export interface DietaRecipeAnalyzeInput {
  loggedOn: string;
  title: string;
  ingredients: string[];
  steps?: string | null;
  /** Batch servings the ingredient list was written for. */
  servings: number;
}

/** Copy existing recipe macros onto a day (no Gemini). */
export interface DietaRecipeAddToDayInput {
  recipeId: string;
  loggedOn: string;
  mealType?: DietaMealType | null;
}

export interface DietaActivityLog {
  id: string;
  loggedOn: string;
  steps: number | null;
  durationMin: number | null;
  activityKcal: number | null;
  note: string | null;
}

export interface DietaKetoEvent {
  id: string;
  recordedAt: string;
  easeRequested: boolean;
}

/** Weekly check-in confirmation (FE stub; future API payload). */
export interface DietaCheckInLog {
  id: string;
  loggedOn: string;
  weightKg: number | null;
  baselineWeightKg: number | null;
  weightDeltaKg: number | null;
  /** true = 유지 — keep daily/W/activity targets; ignore weight-based X. */
  keepTargets: boolean;
  appliedDailyKcal: number;
  appliedActivityExtraKcal: number;
  appliedWeeklyTargetKg: number;
  createdAt: string;
}

export interface DietaGeminiGoalHint {
  goalType: DietaGoalType;
  /** TDEE — maintenance calories. */
  maintainKcal: number;
  /** Current daily coaching target. */
  dailyKcalTarget: number;
  targetWeightKg: number | null;
}

/**
 * That day's activity for Gemini.
 * `steps` / `activeMinutes` always present (0 if unknown).
 * `activityKcal` only when the user entered burned kcal — omit when null/absent (never fake 0).
 */
export interface DietaGeminiActivityHint {
  steps: number;
  activeMinutes: number;
  activityKcal?: number;
}

export interface DietaGeminiMealRequest {
  schemaVersion: 1;
  locale: 'ko-KR';
  loggedOn: string;
  goalHint: DietaGeminiGoalHint;
  meals: Array<{ mealType: DietaMealType; items: string[] }>;
  activityHint: DietaGeminiActivityHint;
  instructions: {
    needMacros: true;
    needKcal: true;
    needOneLineReview: true;
    /** When portion/amount is omitted in item text, treat as one serving (1인분). */
    missingAmountAsOneServing: true;
    /** One-line review may mention steps/active minutes and burned kcal (entered or estimated). */
    includeActivityInReview: true;
    /** When activityHint.activityKcal is absent, estimate burned kcal from steps/activeMinutes. */
    estimateActivityKcalIfMissing: true;
  };
}

export interface DietaGeminiMealResponse {
  schemaVersion: 1;
  loggedOn: string;
  totals: {
    carbG: number;
    proteinG: number;
    fatG: number;
    kcal: number;
  };
  oneLineReview: string;
}

export const DIETA_MEAL_LABELS: Record<DietaMealType, string> = {
  BREAKFAST: '아침',
  LUNCH: '점심',
  DINNER: '저녁',
  SNACK: '간식',
};

export const DIETA_STYLE_PRESETS: Record<DietaDietStyle, DietaMacroPercents> = {
  BALANCED: { carbPct: 0.4, proteinPct: 0.3, fatPct: 0.3 },
  TRAINING: { carbPct: 0.35, proteinPct: 0.4, fatPct: 0.25 },
  KETO: { carbPct: 0.05, proteinPct: 0.25, fatPct: 0.7 },
  VEGAN: { carbPct: 0.5, proteinPct: 0.25, fatPct: 0.25 },
};

export const DIETA_STYLE_LABELS: Record<DietaDietStyle, string> = {
  BALANCED: '일반',
  TRAINING: '운동',
  KETO: '키토',
  VEGAN: '비건',
};
