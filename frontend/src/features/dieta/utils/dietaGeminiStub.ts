import type {
  DietaGeminiActivityHint,
  DietaGeminiGoalHint,
  DietaGeminiMealRequest,
  DietaGeminiMealResponse,
  DietaMealType,
} from '../types';
import { kcalFromMacros } from './dietaMath';

const EMPTY_ACTIVITY_HINT: DietaGeminiActivityHint = {
  steps: 0,
  activeMinutes: 0,
};

/** Stub Gemini: hash texts into plausible macros + Korean one-liner. */
export function stubGeminiAnalyzeMeals(
  request: DietaGeminiMealRequest,
): DietaGeminiMealResponse {
  const allTexts = request.meals.flatMap((m) => m.items);
  let carb = 0;
  let protein = 0;
  let fat = 0;

  for (const text of allTexts) {
    const t = text.toLowerCase();
    const estG = estimatePortionG(text);
    if (
      t.includes('닭')
      || t.includes('계란')
      || t.includes('달걀')
      || t.includes('연어')
      || t.includes('두부')
      || t.includes('고기')
    ) {
      protein += estG * 0.22;
      fat += estG * 0.08;
      carb += estG * 0.02;
    } else if (
      t.includes('밥')
      || t.includes('면')
      || t.includes('빵')
      || t.includes('토스트')
      || t.includes('고구마')
      || t.includes('바나나')
    ) {
      carb += estG * 0.28;
      protein += estG * 0.04;
      fat += estG * 0.02;
    } else if (
      t.includes('아보카도')
      || t.includes('기름')
      || t.includes('치즈')
      || t.includes('견과')
    ) {
      fat += estG * 0.2;
      carb += estG * 0.05;
      protein += estG * 0.04;
    } else {
      carb += estG * 0.12;
      protein += estG * 0.08;
      fat += estG * 0.05;
    }
  }

  if (allTexts.length === 0) {
    carb = 0;
    protein = 0;
    fat = 0;
  }

  const carbG = Math.round(carb * 10) / 10;
  const proteinG = Math.round(protein * 10) / 10;
  const fatG = Math.round(fat * 10) / 10;
  const kcal = kcalFromMacros(carbG, proteinG, fatG);

  const mealCount = request.meals.filter((m) => m.items.length > 0).length;
  const oneLineReview = buildReview({
    carbG,
    proteinG,
    fatG,
    kcal,
    mealCount,
    itemCount: allTexts.length,
    goalHint: request.goalHint,
    activityHint: request.activityHint,
    includeActivityInReview: request.instructions.includeActivityInReview,
    estimateActivityKcalIfMissing:
      request.instructions.estimateActivityKcalIfMissing,
  });

  return {
    schemaVersion: 1,
    loggedOn: request.loggedOn,
    totals: { carbG, proteinG, fatG, kcal },
    oneLineReview,
  };
}

export function buildGeminiRequestFromQueue(
  loggedOn: string,
  items: Array<{ mealType: DietaMealType; text: string }>,
  goalHint: DietaGeminiGoalHint,
  activityHint: DietaGeminiActivityHint = EMPTY_ACTIVITY_HINT,
): DietaGeminiMealRequest {
  const order: DietaMealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];
  const meals = order
    .map((mealType) => ({
      mealType,
      items: items
        .filter((i) => i.mealType === mealType)
        .map((i) => i.text.trim())
        .filter(Boolean),
    }))
    .filter((m) => m.items.length > 0);

  const hint: DietaGeminiActivityHint = {
    steps: activityHint.steps,
    activeMinutes: activityHint.activeMinutes,
  };
  // Only include user-entered burned kcal; never send 0 as a stand-in.
  if (activityHint.activityKcal != null) {
    hint.activityKcal = activityHint.activityKcal;
  }

  return {
    schemaVersion: 1,
    locale: 'ko-KR',
    loggedOn,
    goalHint,
    meals,
    activityHint: hint,
    instructions: {
      needMacros: true,
      needKcal: true,
      needOneLineReview: true,
      missingAmountAsOneServing: true,
      includeActivityInReview: true,
      // 기입된 소비 칼로리만 사용하고, 없으면 걸음·활동 분으로 추정하라
      estimateActivityKcalIfMissing: true,
    },
  };
}

function estimatePortionG(text: string): number {
  const withG = text.match(/(\d+(?:\.\d+)?)\s*g/i);
  if (withG) {
    return Math.min(Math.max(Number(withG[1]), 30), 800);
  }
  const bare = text.match(/(\d+(?:\.\d+)?)/);
  if (bare && Number(bare[1]) >= 20 && Number(bare[1]) <= 500) {
    return Number(bare[1]);
  }
  if (/한\s*그릇|한그릇|사발|공기|1인분|한\s*인분/.test(text)) {
    return 350;
  }
  if (/개/.test(text)) {
    return 100;
  }
  // No explicit amount → 1인분 (per instructions.missingAmountAsOneServing)
  return 350;
}

/** Rough stub estimate when activityKcal was not entered (~0.04 kcal/step, ~5 kcal/min). */
function estimateBurnedKcal(steps: number, activeMinutes: number): number {
  return Math.round(steps * 0.04 + activeMinutes * 5);
}

function resolveActivityKcal(
  activityHint: DietaGeminiActivityHint,
  estimateIfMissing: boolean,
): number | null {
  if (activityHint.activityKcal != null) {
    return activityHint.activityKcal;
  }
  if (!estimateIfMissing) {
    return null;
  }
  const { steps, activeMinutes } = activityHint;
  if (steps <= 0 && activeMinutes <= 0) {
    return null;
  }
  return estimateBurnedKcal(steps, activeMinutes);
}

function buildReview(params: {
  carbG: number;
  proteinG: number;
  fatG: number;
  kcal: number;
  mealCount: number;
  itemCount: number;
  goalHint: DietaGeminiGoalHint;
  activityHint: DietaGeminiActivityHint;
  includeActivityInReview: boolean;
  estimateActivityKcalIfMissing: boolean;
}): string {
  const {
    carbG,
    proteinG,
    fatG,
    kcal,
    mealCount,
    itemCount,
    goalHint,
    activityHint,
    includeActivityInReview,
    estimateActivityKcalIfMissing,
  } = params;
  if (itemCount === 0) {
    return '기록된 음식이 없어 분석을 건너뛰었어요.';
  }

  const parts: string[] = [];
  const { goalType, maintainKcal, dailyKcalTarget } = goalHint;
  const vsMaintain = kcal - maintainKcal;
  const vsDaily = kcal - dailyKcalTarget;

  if (goalType === 'LOSS') {
    if (vsDaily <= 50) {
      parts.push(`목표 ${dailyKcalTarget}kcal 대비 잘 맞췄어요`);
    } else {
      parts.push(`목표 ${dailyKcalTarget}kcal보다 ${Math.round(vsDaily)}kcal 높아요`);
    }
    if (vsMaintain < -200) {
      parts.push(`유지(${maintainKcal})보다 적자라 감량 방향이에요`);
    } else if (vsMaintain > 0) {
      parts.push(`유지(${maintainKcal})보다 많아 감량이 느려질 수 있어요`);
    }
  } else if (goalType === 'GAIN') {
    if (vsDaily >= -50) {
      parts.push(`목표 ${dailyKcalTarget}kcal 근처로 잘 채웠어요`);
    } else {
      parts.push(`목표 ${dailyKcalTarget}kcal보다 ${Math.round(-vsDaily)}kcal 부족해요`);
    }
    if (vsMaintain > 100) {
      parts.push(`유지(${maintainKcal})보다 잉여라 증량에 유리해요`);
    }
  } else {
    if (Math.abs(vsMaintain) <= 150) {
      parts.push(`유지 ${maintainKcal}kcal에 가깝게 먹었어요`);
    } else if (vsMaintain > 0) {
      parts.push(`유지(${maintainKcal})보다 ${Math.round(vsMaintain)}kcal 많아요`);
    } else {
      parts.push(`유지(${maintainKcal})보다 ${Math.round(-vsMaintain)}kcal 적어요`);
    }
  }

  if (proteinG >= 80) {
    parts.push('단백질은 넉넉해요');
  } else if (proteinG < 40) {
    parts.push('단백질이 조금 부족한 편이에요');
  }

  if (carbG > proteinG * 2.5) {
    parts.push('탄수화물 비중이 높아요');
  } else if (fatG > 70) {
    parts.push('지방이 다소 많아요');
  }

  parts.push(`총 ${kcal}kcal · ${mealCount}끼 ${itemCount}항목`);
  let review = parts.slice(0, 3).join('. ') + (parts.length > 3 ? '.' : '');

  if (includeActivityInReview) {
    const { steps, activeMinutes } = activityHint;
    const burned = resolveActivityKcal(
      activityHint,
      estimateActivityKcalIfMissing,
    );
    if (burned != null && burned > 0) {
      const net = Math.round(kcal - burned);
      const estimated = activityHint.activityKcal == null;
      review += estimated
        ? ` 활동(추정 ${burned}kcal) 반영하면 순 ${net}kcal 느낌이에요.`
        : ` 활동 ${burned}kcal도 반영하면 순 ${net}kcal 느낌이에요.`;
    } else if (steps > 0 || activeMinutes > 0) {
      review += ` 걸음 ${steps.toLocaleString('ko-KR')}보·활동 ${activeMinutes}분도 참고했어요.`;
    } else {
      review += ' 활동 기록은 없어 섭취 위주로 봤어요.';
    }
  }

  return review;
}
