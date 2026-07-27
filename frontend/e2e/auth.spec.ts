import { test, expect } from '@playwright/test'

const email = process.env.E2E_USER_EMAIL ?? 'e2e@pbb.test'
const password = process.env.E2E_USER_PASSWORD ?? 'E2ePassw0rd!'

test('login reaches authenticated home', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible({
    timeout: 15_000,
  })
})
