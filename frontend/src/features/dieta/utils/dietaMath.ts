import type {
  DietaGoalType,
  DietaMacroPercents,
  DietaProfile,
  DietaWeightEval,
} from '../types';

/** Mifflin–St Jeor (male coefficients as default estimate when sex unknown). */
export function estimateBmrKcal(params: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: 'M' | 'F';
}): number {
  const { weightKg, heightCm, ageYears, sex } = params;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === 'F' ? base - 161 : base + 5);
}

/** Discount applied to (activityFactor − 1) when computing TDEE so maintain kcal is not overstated. */
const ACTIVITY_FACTOR_CONSERVATIVE_SCALE = 0.75
const MIN_TDEE_ACTIVITY_FACTOR = 1.2

/**
 * Conservative TDEE activity factor: `1 + (factor − 1) × 0.75`, floored at 1.2.
 * UI still stores/shows the raw survey factor; only TDEE uses this.
 */
export function conservativeActivityFactor(activityFactor: number): number {
  const scaled = 1 + (activityFactor - 1) * ACTIVITY_FACTOR_CONSERVATIVE_SCALE
  return Math.max(scaled, MIN_TDEE_ACTIVITY_FACTOR)
}

export function computeTdee(bmr: number, activityFactor: number): number {
  const factor = conservativeActivityFactor(activityFactor)
  return Math.max(Math.round(bmr * factor), bmr)
}

export function applyLossDaily(daily: number, bmr: number): number {
  return Math.max(Math.round(daily), bmr);
}

export function applyGainDaily(
  daily: number,
  tdee: number,
  ceilingDelta: number,
): number {
  return Math.min(Math.round(daily), tdee + ceilingDelta);
}

export function macrosFromDaily(
  dailyKcal: number,
  pct: DietaMacroPercents,
): { carbG: number; proteinG: number; fatG: number } {
  return {
    carbG: Math.round((dailyKcal * pct.carbPct) / 4),
    proteinG: Math.round((dailyKcal * pct.proteinPct) / 4),
    fatG: Math.round((dailyKcal * pct.fatPct) / 9),
  };
}

export function kcalFromMacros(
  carbG: number,
  proteinG: number,
  fatG: number,
): number {
  return Math.round(carbG * 4 + proteinG * 4 + fatG * 9);
}

/** Activity +kcal → steps / minutes (weight-aware). */
export function activityFromExtraKcal(params: {
  extraKcal: number;
  weightKg: number | null;
  heightCm: number;
}): { steps: number; minutesBrisk: number; minutesMod: number } {
  const { extraKcal, weightKg, heightCm } = params;
  if (weightKg == null || weightKg <= 0) {
    return {
      steps: Math.round(extraKcal * 20),
      minutesBrisk: Math.round(extraKcal / 6),
      minutesMod: Math.round(extraKcal / 10),
    };
  }
  const strideM = heightCm > 0 ? (heightCm * 0.415) / 100 : 0.75;
  const distanceKm = extraKcal / (0.5 * weightKg);
  const steps = Math.round((distanceKm * 1000) / strideM);
  const minutesBrisk = Math.round((extraKcal * 60) / (4 * weightKg));
  const minutesMod = Math.round((extraKcal * 60) / (7 * weightKg));
  return { steps, minutesBrisk, minutesMod };
}

/**
 * Weekly coaching X: body-fat delta preferred; else weight/1.2.
 * Positive X = progress in goal direction (loss amount or gain amount).
 */
export function computeWeeklyX(params: {
  goalType: 'LOSS' | 'GAIN' | 'MAINTAIN';
  fatDeltaKg: number | null;
  weightDeltaKg: number | null;
}): { x: number | null; source: 'FAT' | 'WEIGHT' | null } {
  const { goalType, fatDeltaKg, weightDeltaKg } = params;
  if (goalType === 'MAINTAIN') {
    return { x: null, source: null };
  }
  if (fatDeltaKg != null) {
    const x = goalType === 'LOSS' ? -fatDeltaKg : fatDeltaKg;
    return { x, source: 'FAT' };
  }
  if (weightDeltaKg != null) {
    const raw = goalType === 'LOSS' ? -weightDeltaKg : weightDeltaKg;
    return { x: raw / 1.2, source: 'WEIGHT' };
  }
  return { x: null, source: null };
}

export function evaluateWeeklyX(
  x: number,
  weeklyTargetKg: number,
): DietaWeightEval {
  const w = Math.max(weeklyTargetKg, 0.01);
  if (x < 0.75 * w) {
    return 'PLATEAU';
  }
  if (x > 1.25 * w) {
    return 'TOO_FAST';
  }
  return 'ON_TRACK';
}

export function estimateTdeeFromIntake(params: {
  avgIntakeKcal: number;
  fatDeltaKg: number | null;
  weightDeltaKg: number | null;
  bmr: number;
}): { tdee: number; source: 'INTAKE_FAT_BALANCE' | 'INTAKE_WEIGHT_BALANCE' } {
  const { avgIntakeKcal, fatDeltaKg, weightDeltaKg, bmr } = params;
  if (fatDeltaKg != null) {
    const est = avgIntakeKcal + (-fatDeltaKg * 7700) / 7;
    return {
      tdee: Math.max(Math.round(est), bmr),
      source: 'INTAKE_FAT_BALANCE',
    };
  }
  const w = weightDeltaKg ?? 0;
  const effective = w / 1.2;
  const est = avgIntakeKcal + (-effective * 7700) / 7;
  return {
    tdee: Math.max(Math.round(est), bmr),
    source: 'INTAKE_WEIGHT_BALANCE',
  };
}

export function todayIsoDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Whole calendar days from startIso to endIso (end − start). */
export function daysBetweenIso(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function isWeeklyCheckInDue(
  weekStartsOn: string,
  today = todayIsoDate(),
): boolean {
  return daysBetweenIso(weekStartsOn, today) >= 7;
}

/** Last check-in or onboarding weigh-in before `beforeIso` (single-compare baseline). */
export function findCheckInBaseline<
  T extends {
    loggedOn: string;
    weightKg: number | null;
    source: string;
  },
>(logs: T[], beforeIso: string): T | null {
  const eligible = logs.filter(
    (l) =>
      l.loggedOn < beforeIso
      && l.weightKg != null
      && (l.source === 'CHECK_IN' || l.source === 'ONBOARDING'),
  );
  if (eligible.length === 0) {
    return null;
  }
  return eligible.reduce((a, b) => (a.loggedOn >= b.loggedOn ? a : b));
}

export function averageDailyIntakeKcal(
  intakes: { loggedOn: string; kcal: number }[],
  fromIso: string,
  toIsoExclusive: string,
): { avgKcal: number; dayCount: number; totalKcal: number } {
  const byDay = new Map<string, number>();
  for (const row of intakes) {
    if (row.loggedOn < fromIso || row.loggedOn >= toIsoExclusive) {
      continue;
    }
    byDay.set(row.loggedOn, (byDay.get(row.loggedOn) ?? 0) + row.kcal);
  }
  const dayCount = byDay.size;
  const totalKcal = [...byDay.values()].reduce((s, v) => s + v, 0);
  return {
    avgKcal: dayCount > 0 ? Math.round(totalKcal / dayCount) : 0,
    dayCount,
    totalKcal,
  };
}

export type DietaPlateauChoice = 'CUT_KCAL' | 'ADD_ACTIVITY';

export interface DietaWeekProposal {
  eval: DietaWeightEval | 'MAINTAIN';
  x: number | null;
  source: 'FAT' | 'WEIGHT' | 'MUSCLE' | null;
  avgIntakeKcal: number;
  intakeDays: number;
  weightDeltaKg: number | null;
  fatDeltaKg: number | null;
  muscleDeltaKg: number | null;
  proposedTdee: number;
  proposedDailyKcal: number;
  proposedActivityExtraKcal: number;
  action: 'HOLD' | 'CUT_KCAL' | 'ADD_ACTIVITY' | 'RECOVER' | 'SURPLUS' | 'CUT_GAIN';
  summary: string;
}

export function buildWeeklyCheckInProposal(params: {
  goalType: 'LOSS' | 'GAIN' | 'MAINTAIN';
  weeklyTargetKg: number;
  currentDailyKcal: number;
  currentTdee: number;
  bmr: number;
  lossCutKcal: number;
  lossRecoverKcal: number;
  lossActivityKcal: number;
  gainSurplusKcal: number;
  gainCutKcal: number;
  gainCeilingDeltaKcal: number;
  avgIntakeKcal: number;
  intakeDays: number;
  weightDeltaKg: number | null;
  fatDeltaKg: number | null;
  muscleDeltaKg: number | null;
  plateauChoice: DietaPlateauChoice;
}): DietaWeekProposal {
  const {
    goalType,
    weeklyTargetKg,
    currentDailyKcal,
    bmr,
    lossCutKcal,
    lossRecoverKcal,
    lossActivityKcal,
    gainSurplusKcal,
    gainCutKcal,
    gainCeilingDeltaKcal,
    avgIntakeKcal,
    intakeDays,
    weightDeltaKg,
    fatDeltaKg,
    muscleDeltaKg,
    plateauChoice,
  } = params;

  const intakeForTdee =
    intakeDays > 0 ? avgIntakeKcal : currentDailyKcal;
  const { tdee: proposedTdee } = estimateTdeeFromIntake({
    avgIntakeKcal: intakeForTdee,
    fatDeltaKg,
    weightDeltaKg,
    bmr,
  });

  if (goalType === 'MAINTAIN') {
    return {
      eval: 'MAINTAIN',
      x: null,
      source: null,
      avgIntakeKcal,
      intakeDays,
      weightDeltaKg,
      fatDeltaKg,
      muscleDeltaKg,
      proposedTdee,
      proposedDailyKcal: proposedTdee,
      proposedActivityExtraKcal: 0,
      action: 'HOLD',
      summary: '유지: 다음 주 일일 목표를 추정 TDEE에 맞춥니다.',
    };
  }

  let x: number | null = null;
  let source: 'FAT' | 'WEIGHT' | 'MUSCLE' | null = null;
  if (goalType === 'GAIN' && muscleDeltaKg != null) {
    x = muscleDeltaKg;
    source = 'MUSCLE';
  } else {
    const computed = computeWeeklyX({
      goalType,
      fatDeltaKg,
      weightDeltaKg,
    });
    x = computed.x;
    source = computed.source;
  }

  if (x == null) {
    return {
      eval: 'ON_TRACK',
      x: null,
      source: null,
      avgIntakeKcal,
      intakeDays,
      weightDeltaKg,
      fatDeltaKg,
      muscleDeltaKg,
      proposedTdee,
      proposedDailyKcal: currentDailyKcal,
      proposedActivityExtraKcal: 0,
      action: 'HOLD',
      summary: '변화량을 계산할 수 없어 이번 주 목표를 유지합니다.',
    };
  }

  const band = evaluateWeeklyX(x, weeklyTargetKg);

  if (goalType === 'LOSS') {
    if (band === 'PLATEAU') {
      const canCut = currentDailyKcal - lossCutKcal >= bmr;
      const useActivity = plateauChoice === 'ADD_ACTIVITY' || !canCut;
      if (useActivity) {
        return {
          eval: band,
          x,
          source,
          avgIntakeKcal,
          intakeDays,
          weightDeltaKg,
          fatDeltaKg,
          muscleDeltaKg,
          proposedTdee,
          proposedDailyKcal: currentDailyKcal,
          proposedActivityExtraKcal: lossActivityKcal,
          action: 'ADD_ACTIVITY',
          summary: `정체: 식사량은 유지하고 활동 +${lossActivityKcal}kcal를 제안합니다.`,
        };
      }
      const daily = applyLossDaily(currentDailyKcal - lossCutKcal, bmr);
      return {
        eval: band,
        x,
        source,
        avgIntakeKcal,
        intakeDays,
        weightDeltaKg,
        fatDeltaKg,
        muscleDeltaKg,
        proposedTdee,
        proposedDailyKcal: daily,
        proposedActivityExtraKcal: 0,
        action: 'CUT_KCAL',
        summary: `정체: 식사 −${lossCutKcal}kcal → 일일 ${daily}kcal를 제안합니다.`,
      };
    }
    if (band === 'TOO_FAST') {
      const daily = applyLossDaily(currentDailyKcal + lossRecoverKcal, bmr);
      return {
        eval: band,
        x,
        source,
        avgIntakeKcal,
        intakeDays,
        weightDeltaKg,
        fatDeltaKg,
        muscleDeltaKg,
        proposedTdee,
        proposedDailyKcal: daily,
        proposedActivityExtraKcal: 0,
        action: 'RECOVER',
        summary: `과속: 식사 +${lossRecoverKcal}kcal → 일일 ${daily}kcal를 제안합니다.`,
      };
    }
    return {
      eval: band,
      x,
      source,
      avgIntakeKcal,
      intakeDays,
      weightDeltaKg,
      fatDeltaKg,
      muscleDeltaKg,
      proposedTdee,
      proposedDailyKcal: currentDailyKcal,
      proposedActivityExtraKcal: 0,
      action: 'HOLD',
      summary: '순항: 식사·활동 목표를 유지하고 TDEE만 갱신합니다.',
    };
  }

  // GAIN
  if (band === 'PLATEAU') {
    const daily = applyGainDaily(
      currentDailyKcal + gainSurplusKcal,
      proposedTdee,
      gainCeilingDeltaKcal,
    );
    return {
      eval: band,
      x,
      source,
      avgIntakeKcal,
      intakeDays,
      weightDeltaKg,
      fatDeltaKg,
      muscleDeltaKg,
      proposedTdee,
      proposedDailyKcal: daily,
      proposedActivityExtraKcal: 0,
      action: 'SURPLUS',
      summary: `정체: 식사 +${gainSurplusKcal}kcal → 일일 ${daily}kcal를 제안합니다.`,
    };
  }
  if (band === 'TOO_FAST') {
    const daily = applyGainDaily(
      currentDailyKcal - gainCutKcal,
      proposedTdee,
      gainCeilingDeltaKcal,
    );
    return {
      eval: band,
      x,
      source,
      avgIntakeKcal,
      intakeDays,
      weightDeltaKg,
      fatDeltaKg,
      muscleDeltaKg,
      proposedTdee,
      proposedDailyKcal: daily,
      proposedActivityExtraKcal: 0,
      action: 'CUT_GAIN',
      summary: `과속: 식사 −${gainCutKcal}kcal → 일일 ${daily}kcal를 제안합니다.`,
    };
  }
  return {
    eval: band,
    x,
    source,
    avgIntakeKcal,
    intakeDays,
    weightDeltaKg,
    fatDeltaKg,
    muscleDeltaKg,
    proposedTdee,
    proposedDailyKcal: currentDailyKcal,
    proposedActivityExtraKcal: 0,
    action: 'HOLD',
    summary: '순항: 식사·활동 목표를 유지하고 TDEE만 갱신합니다.',
  };
}

export function hasReachedTargetWeight(params: {
  goalType: 'LOSS' | 'GAIN' | 'MAINTAIN';
  weightKg: number;
  targetWeightKg: number | null;
}): boolean {
  const { goalType, weightKg, targetWeightKg } = params;
  if (targetWeightKg == null || !Number.isFinite(targetWeightKg) || targetWeightKg <= 0) {
    return false;
  }
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return false;
  }
  if (goalType === 'LOSS') {
    return weightKg <= targetWeightKg;
  }
  if (goalType === 'GAIN') {
    return weightKg >= targetWeightKg;
  }
  return false;
}

/** Profile fields to apply when target weight is reached. */
export function maintainSwitchPatch(tdeeKcal: number): {
  goalType: 'MAINTAIN';
  weeklyTargetKg: number;
  weeklyBodyFatLossKg: null;
  weeklyMuscleGainKg: null;
  dailyKcal: number;
  weekActivityExtraKcal: number;
  tdeeKcal: number;
} {
  return {
    goalType: 'MAINTAIN',
    weeklyTargetKg: 0,
    weeklyBodyFatLossKg: null,
    weeklyMuscleGainKg: null,
    dailyKcal: tdeeKcal,
    weekActivityExtraKcal: 0,
    tdeeKcal,
  };
}

/** Enter MAINTAIN while remembering prior LOSS/GAIN for Settings restore. */
export function toMaintainModePatch(
  profile: Pick<DietaProfile, 'goalType' | 'lastNonMaintainGoalType'>,
  tdeeKcal: number,
): Partial<DietaProfile> {
  const last: 'LOSS' | 'GAIN' =
    profile.goalType === 'LOSS' || profile.goalType === 'GAIN'
      ? profile.goalType
      : (profile.lastNonMaintainGoalType ?? 'LOSS');
  return {
    ...maintainSwitchPatch(tdeeKcal),
    lastNonMaintainGoalType: last,
  };
}

const DEFAULT_WEEKLY_TARGET_KG = 0.5;

/**
 * Manual goal-mode change (Settings). Keeps `targetWeightKg`.
 * MAINTAIN → daily=TDEE, W=0. LOSS/GAIN → re-apply initial deficit/surplus helpers.
 */
export function goalModeSwitchPatch(
  profile: Pick<
    DietaProfile,
    | 'tdeeKcal'
    | 'bmrKcal'
    | 'lossInitialDeficitKcal'
    | 'gainInitialSurplusKcal'
    | 'gainCeilingDeltaKcal'
    | 'weeklyTargetKg'
  >,
  nextGoal: DietaGoalType,
): Partial<DietaProfile> {
  if (nextGoal === 'MAINTAIN') {
    return maintainSwitchPatch(profile.tdeeKcal);
  }

  const weekly =
    profile.weeklyTargetKg > 0
      ? profile.weeklyTargetKg
      : DEFAULT_WEEKLY_TARGET_KG;
  const derived = Math.round(weekly * 0.9 * 1000) / 1000;

  if (nextGoal === 'LOSS') {
    return {
      goalType: 'LOSS',
      weeklyTargetKg: weekly,
      weeklyBodyFatLossKg: derived,
      weeklyMuscleGainKg: null,
      dailyKcal: applyLossDaily(
        profile.tdeeKcal - profile.lossInitialDeficitKcal,
        profile.bmrKcal,
      ),
      weekActivityExtraKcal: 0,
    };
  }

  return {
    goalType: 'GAIN',
    weeklyTargetKg: weekly,
    weeklyBodyFatLossKg: null,
    weeklyMuscleGainKg: derived,
    dailyKcal: applyGainDaily(
      profile.tdeeKcal + profile.gainInitialSurplusKcal,
      profile.tdeeKcal,
      profile.gainCeilingDeltaKcal,
    ),
    weekActivityExtraKcal: 0,
  };
}

export function newId(): string {
  return crypto.randomUUID();
}
