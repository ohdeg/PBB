import type { DietaMealType } from './types';

export const mealOrder: DietaMealType[] = ['BREAKFAST','LUNCH','DINNER','SNACK'];

export function suggestMeal(now: Date, zone: string | undefined, isToday: boolean, recorded: readonly string[]): DietaMealType {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, hour: '2-digit', hourCycle: 'h23',
  }).format(now));
  const first = !isToday ? 0 : hour < 5 || hour >= 22 ? 3 : hour < 11 ? 0 : hour < 17 ? 1 : 2;
  return mealOrder.slice(first).find(meal => !recorded.includes(meal)) ?? 'SNACK';
}
