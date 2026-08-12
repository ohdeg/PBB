import { test, expect } from '@playwright/test'

test('veveno landing shows brand copy', async ({ page }) => {
  await page.goto('/hobbies/veveno')
  await expect(page.getByRole('heading', { name: 'Veveno', level: 1 })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: '가게 일을 조금 더 편하게' }),
  ).toBeVisible()
})

test('sixpick landing shows brand', async ({ page }) => {
  await page.goto('/hobbies/6pick')
  await expect(page.getByRole('heading', { name: '6PICK', level: 1 })).toBeVisible()
})

test('lotto shell loads after splash', async ({ page }) => {
  await page.goto('/hobbies/6pick/play')
  await expect(page.getByRole('main')).toBeVisible({ timeout: 20_000 })
})

test('score viewer landing shows brand', async ({ page }) => {
  await page.goto('/hobbies/score-viewer')
  await expect(
    page.getByRole('heading', { name: 'Score Viewer', level: 1 }),
  ).toBeVisible()
})
