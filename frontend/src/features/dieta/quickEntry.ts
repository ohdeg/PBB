import type { DietaMealType } from './types';

export function shiftDay(iso: string, days: number) {
  const date = new Date(iso + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export const activityLabels = {steps:'걸음', durationMin:'운동 시간', exerciseKcal:'운동 열량'} as const;
export type ActivityField = keyof typeof activityLabels;
export const activityFields = Object.keys(activityLabels) as ActivityField[];
export interface MenuItem {id:string;mealType:DietaMealType;text:string;recipeId:string|null;legacy?:unknown;portion:number}
export interface Favorite {id:string;name:string;items:MenuItem[]}
export interface Nutrition {carbG:number;proteinG:number;fatG:number;kcal:number}
export interface QuickPreview {
  day:string;previousDay:string;current:MenuItem[];previous:MenuItem[];favorites:Favorite[];
  averages:{mealType:DietaMealType;days:number;totals:Nutrition}[];
  estimates:Partial<Record<DietaMealType,Nutrition>>;revision:string;requestId:string;
}
export interface QuickEdit {
  action:'previous'|'favorite'|'saveFavorite'|'deleteFavorite'|'estimate'|'clearEstimate';
  requestId:string;revision:string;favoriteId?:string;name?:string;
  picks?:MenuItem[];mealType?:DietaMealType;portion?:number;
}
export const mealStatusLabels = {COMPLETE:'기록 완료', SKIPPED:'건너뜀', UNKNOWN:'기억 안 남'} as const;
export type MealStatus = keyof typeof mealStatusLabels;
export interface WeekMeal {
  mealType:DietaMealType;
  directDays:number;
  estimatedDays:number;
  mixedDays:number;
  skippedDays:number;
  unknownDays:number;
  frequentFood:string|null;
  foodDays:number;
  trend?:{earlyAverage:number;earlyDays:number;lateAverage:number;lateDays:number}|null;
}
export interface RecordWeek { mealDays:number;estimatedMealDays:number;activityDays:number;estimatedActivityDays:number;workouts:number }

export interface MealDayDetails {
  day: string;
  queue: import('./types').DietaMealQueueDay;
  intake: import('./types').DietaIntakeLog | null;
  feedback?: {dayReview:string;meals:Partial<Record<DietaMealType,string>>}|null;
  feedbackStale?:boolean;
  mealStatuses?:Partial<Record<DietaMealType,MealStatus>>;
  completedStage: 'MAIN'|'SUPPLEMENT'|null;
  mealTotals: Partial<Record<DietaMealType|'OTHER',Nutrition>>;
  foods: {mealType:string|null;name:string;portion:string|null;source:string;nutrition:Nutrition|null}[];
}
