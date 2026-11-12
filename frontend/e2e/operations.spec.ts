import { expect, test } from '@playwright/test';

for (const width of [375, 1280]) {
  test(`DEV can filter today's failures and page audit records at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    const token = 'fixture.' + Buffer.from(JSON.stringify({
      sub: 'fixture@example.invalid', nickname: '운영 테스트', userId: 'fixture', userClass: 'dev',
    })).toString('base64url') + '.fixture';
    await page.route('**/api/v1/**', async route => {
      const url = new URL(route.request().url());
      let body: unknown = {};
      if (url.pathname.endsWith('/auth/refresh')) body = { accessToken: token };
      if (url.pathname.endsWith('/featured-app')) body = { appIds: ['veveno'] };
      if (url.pathname.endsWith('/operations/today')) {
        const more = url.searchParams.has('cursor');
        body = { date: '2026-11-13', errors: [
          { app: 'Tempori', operation: 'saveScore', status: 500, count: 4, lastMs: 1600000000000, requestId: 'fixture-a' },
          { app: 'Dieta', operation: 'finalizeMeal', status: 503, count: 1, lastMs: 1600000000001, requestId: 'fixture-b' },
        ], changes: [{ id: more ? '1' : '2', atMs: 1600000000000, actor: 'admin-id',
          target: 'PBB', action: 'FEATURED_APPS', before: 'veveno', after: more ? 'sranko' : 'dieta' }],
        nextCursor: more ? null : '2' };
      }
      await route.fulfill({ json: body });
    });
    await page.goto('/profile');
    const panel = page.getByRole('region', { name: '오늘의 운영 기록' });
    await expect(panel.getByText('HTTP 500', { exact: false })).toBeVisible();
    await panel.getByRole('combobox').selectOption('Dieta');
    await expect(panel.getByText('HTTP 500', { exact: false })).toHaveCount(0);
    await expect(panel.getByText('HTTP 503', { exact: false })).toBeVisible();
    await panel.getByRole('button', { name: '이전 변경 더 보기' }).click();
    await expect(panel.getByText('veveno → sranko')).toBeVisible();
    expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  });
}
