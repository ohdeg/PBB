import { test, expect } from '@playwright/test'

test('home loads hobby cards', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '일상에 필요한 도구, 한곳에.' })).toBeVisible()
  await expect(page.getByText('Veveno', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Tempori', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('6PICK', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Dieta', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('article')).toHaveCount(3)
  await expect(page.getByRole('link', { name: 'Veveno 열기' })).toHaveAttribute('href', '/hobbies/veveno/hub')
  await expect(page.getByRole('link', { name: 'Veveno 소개' })).toHaveAttribute('href', '/hobbies/veveno')
})

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`home keeps descriptions and usable links at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.getByText('메뉴·재고·근무를 한곳에서', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Tempori 열기' })).toBeVisible()
    const layout = await page.locator('.home-hub__grid').evaluate((grid) => ({
      columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }))
    expect(layout.columns).toBe(width < 768 ? 1 : width < 1024 ? 2 : 3)
    expect(layout.overflow).toBe(false)
  })
}

test('mobile menu supports Escape and navigation and theme switching', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const menu = page.getByRole('button', { name: '메뉴 열기' })
  await menu.click()
  const apps = page.getByRole('navigation', { name: '앱 목록' })
  await expect(apps.getByRole('link')).toHaveCount(3)
  await apps.getByRole('link').first().focus()
  await page.keyboard.press('Escape')
  await expect(menu).toBeFocused()
  await expect(apps).toHaveCount(0)
  const theme = page.getByRole('button', { name: /모드로 전환/ })
  const before = await theme.getAttribute('aria-label')
  await theme.click()
  await expect(theme).not.toHaveAttribute('aria-label', before!)
  await menu.click()
  await apps.getByRole('link', { name: /Veveno/ }).click()
  await expect(page).toHaveURL(/\/hobbies\/veveno$/)
  await expect(apps).toHaveCount(0)
})
