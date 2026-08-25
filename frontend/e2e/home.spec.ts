import { test, expect } from '@playwright/test'

test('home loads hobby cards', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '무엇을 시작할까요?' })).toBeVisible()
  await expect(page.getByText('Veveno', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Score Viewer', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('6PICK', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Dieta', { exact: true })).toHaveCount(0)
})
