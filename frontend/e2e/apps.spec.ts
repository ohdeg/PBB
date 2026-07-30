import { test, expect } from '@playwright/test'

test('veveno landing shows brand copy', async ({ page }) => {
  await page.goto('/hobbies/veveno')
  await expect(page.locator('.veveno-landing__brand')).toHaveText('Veveno')
  await expect(
    page.getByRole('heading', { name: '가게 일을 조금 더 편하게' }),
  ).toBeVisible()
})

test('lotto shell loads after splash', async ({ page }) => {
  await page.goto('/hobbies/6pick')
  await expect(page.getByRole('main')).toBeVisible({ timeout: 20_000 })
})
