import { expect,it } from 'vitest';
import { suggestMeal } from './suggestMeal';

it('uses the user zone and suggests the next unrecorded meal from the current period',()=>{
  const noon = new Date('2026-11-11T03:00Z');
  expect(suggestMeal(noon,'Asia/Seoul',true,[])).toBe('LUNCH');
  expect(suggestMeal(noon,'Asia/Seoul',true,['LUNCH'])).toBe('DINNER');
  expect(suggestMeal(noon,'Asia/Seoul',true,['LUNCH','DINNER'])).toBe('SNACK');
  expect(suggestMeal(noon,'UTC',true,[])).toBe('SNACK');
});
it('suggests missing main meals in order for yesterday',()=>{
  expect(suggestMeal(new Date(),undefined,false,['BREAKFAST','DINNER'])).toBe('LUNCH');
});
