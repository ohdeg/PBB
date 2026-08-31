import { test, expect } from '@playwright/test'

test('veveno landing shows brand copy', async ({ page }) => {
  await page.goto('/hobbies/veveno')
  await expect(page.getByRole('heading', { name: 'Veveno', level: 1 })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: '가게 일을 조금 더 편하게' }),
  ).toBeVisible()
})

test('veveno hub is reachable without login and opens POS QR modal', async ({
  page,
}) => {
  await page.goto('/hobbies/veveno/hub')
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByText('로그인 전')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'POS 모드 사용' }).click()
  await expect(
    page.getByRole('heading', { name: '휴대폰으로 QR을 찍어 주세요' }),
  ).toBeVisible()
})

test('sixpick is hidden without DEV', async ({ page }) => {
  await page.goto('/hobbies/6pick')
  await expect(page).toHaveURL(/\/$/)
})

test('dieta is hidden without DEV', async ({ page }) => {
  await page.goto('/hobbies/dieta')
  await expect(page).toHaveURL(/\/$/)
})

test('score viewer landing shows brand', async ({ page }) => {
  await page.goto('/hobbies/score-viewer')
  await expect(
    page.getByRole('heading', { name: 'Score Viewer', level: 1 }),
  ).toBeVisible()
})
