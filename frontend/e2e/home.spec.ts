import { test, expect } from '@playwright/test'

test('home loads hobby cards', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '취미 앱을 모은 가방' })).toBeVisible()
  await expect(page.getByText('Veveno', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('6PICK', { exact: true }).first()).toBeVisible()
})
