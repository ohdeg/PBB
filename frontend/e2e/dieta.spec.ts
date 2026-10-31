import { test, expect, type Page } from '@playwright/test';
import { sampleProfile } from '../src/features/dieta/testProfile';
const today = new Date().toLocaleDateString('en-CA');
const profile = {...sampleProfile, weekStartsOn: today};
const jwt = `fixture.${Buffer.from(JSON.stringify({sub:'dieta-fixture@example.test',nickname:'미리보기',userId:profile.userId,userClass:'dev',type:'access',exp:4102444800})).toString('base64url')}.fixture`;
export async function setupDieta(page: Page, mode: 'light'|'dark' = 'dark') {
  await page.addInitScript(theme => localStorage.setItem('pbb-theme',theme),mode);
  let current = {...profile};
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path.endsWith('/auth/refresh')) data = {accessToken:jwt};
    else if (path.endsWith('/dieta/profile')) {
      if(route.request().method()==='PATCH') current = {...current,...route.request().postDataJSON()};
      data = current;
    } else if(path.endsWith('/meal-queue/auto-finalize-yesterday')) { await route.fulfill({status:204}); return; }
    else if(path.endsWith('/meal-queue')) data = {loggedOn:today,status:'open',items:[],updatedAt:today};
    else if(path.endsWith('/check-ins/proposal')) data = {revisionToken:'fixture-revision',eval:'ON_TRACK',source:'WEIGHT',x:0.3,avgIntakeKcal:1800,intakeDays:3,weightDeltaKg:-0.4,proposedTdee:2240,proposedDailyKcal:1840,proposedActivityExtraKcal:0,action:'HOLD',summary:'꾸준히 기록하고 있어요.',baselineWeightKg:70,checkInWeightKg:69.6,weekStartsOn:today,due:false,targetWeightReached:false};
    await route.fulfill({json:data});
  });
}
for (const mode of ['light','dark'] as const) for (const width of [320,390,768,1440]) {
 test(`${mode} ${width}px home and meal dialog`, async ({page}) => {
  await page.setViewportSize({width,height:1000}); await setupDieta(page,mode);
  await page.goto('/hobbies/dieta/home');
  await expect(page.getByRole('heading',{name:'오늘의 기록'})).toBeVisible();
  await expect(page.getByLabel('오늘 체중 (kg)')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  if(width===1440) expect(await page.locator('.dieta-shell').evaluate(e=>e.getBoundingClientRect().width)).toBeGreaterThan(900);
  await page.getByRole('navigation',{name:'Dieta',exact:true}).getByRole('link',{name:'식사',exact:true}).click();
  await page.getByRole('button',{name:'저장한 음식',exact:true}).click();
  const modal = page.getByRole('dialog'); await expect(modal).toBeVisible();
  expect(await modal.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe(mode==='dark'?'rgb(44, 44, 46)':'rgb(255, 255, 255)');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.keyboard.press('Escape'); await expect(modal).toBeHidden();
  await expect(page.getByRole('button',{name:'저장한 음식',exact:true})).toBeFocused();
 });
}
test('settings preserve draft across navigation, save explicitly and cancel reset', async ({page}) => {
 await setupDieta(page); await page.goto('/hobbies/dieta/settings');
 await page.getByLabel('목표 체중 (kg)').fill('64');
 await page.getByRole('navigation',{name:'Dieta',exact:true}).getByRole('link',{name:'활동',exact:true}).click();
 await page.getByRole('navigation',{name:'Dieta',exact:true}).getByRole('link',{name:'설정',exact:true}).click();
 await expect(page.getByLabel('목표 체중 (kg)')).toHaveValue('64');
 await page.getByRole('button',{name:'목표 저장',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('목표를 저장했어요.');
 let resets = 0; page.on('request',r=>{if(r.url().endsWith('/reset')) resets++;});
 page.once('dialog',dialog=>dialog.dismiss());
 await page.getByRole('button',{name:'모든 기록 삭제 후 다시 시작'}).click(); expect(resets).toBe(0);
});
test('initial load failure is retryable, not an empty day', async ({page}) => {
 await setupDieta(page); await page.route('**/api/v1/dieta/profile',route=>route.fulfill({status:500,json:{message:'연결 실패'}}));
 await page.goto('/hobbies/dieta/home'); await expect(page.getByRole('alert')).toBeVisible();
 await expect(page.getByRole('button',{name:'다시 시도'})).toBeVisible(); await expect(page.getByRole('heading',{name:'오늘 식사 요약'})).toHaveCount(0);
});
