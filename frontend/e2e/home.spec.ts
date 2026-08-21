import { test, expect } from '@playwright/test'

test('home loads hobby cards', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '열어 볼 앱' })).toBeVisible()
  await expect(page.getByText('Veveno', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('6PICK', { exact: true }).first()).toBeVisible()
})
