import { test, expect } from '@playwright/test'

const email = process.env.E2E_USER_EMAIL ?? 'e2e@pbb.test'
const password = process.env.E2E_USER_PASSWORD ?? 'E2ePassw0rd!'

test('login reaches authenticated home', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(/\/$/)
  await page.locator('.global-nav__account summary').click()
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible({
    timeout: 15_000,
  })
})

test.describe('login history with a simulated session', () => {
  const payload = { sub: 'demo@example.test', nickname: 'Demo', userId: 'demo', userClass: 'free' }
  const accessToken = 'fixture.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.fixture'

  test.beforeEach(async ({ page }) => {
    let active = false
    await page.route('**/api/v1/**', async (route) => {
      const { pathname } = new URL(route.request().url())
      if (pathname === '/api/v1/auth/login') active = true
      if (pathname === '/api/v1/auth/logout') active = false
      if (pathname === '/api/v1/auth/refresh' || pathname === '/api/v1/auth/login') {
        await route.fulfill({ status: active ? 200 : 401, json: active ? { accessToken } : {} })
        return
      }
      const collection = /\/sranko\/(items|looks|posts)$/.test(pathname)
      await route.fulfill({ json: collection ? [] : {} })
    })
  })

  test('back and forward preserve the public page and protected destination', async ({ page }) => {
    await page.goto('/hobbies/sranko')
    await page.getByRole('button', { name: '옷장 열기' }).click()
    await page.locator('#login-email').fill('demo@example.test')
    await page.locator('#login-password').fill('fixture')
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    await expect(page).toHaveURL(/\/hobbies\/sranko\/closet$/)
    await expect(page.getByRole('button', { name: '옷 추가', exact: true })).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/\/hobbies\/sranko$/)
    await page.goForward()
    await expect(page).toHaveURL(/\/hobbies\/sranko\/closet$/)
    await expect(page.getByRole('button', { name: '옷 추가', exact: true })).toBeVisible()
  })

  test('login entry follows restored, expired and logged-out sessions', async ({ page }) => {
    await page.goto('/login')
    await page.reload()
    await page.locator('#login-email').fill('demo@example.test')
    await page.locator('#login-password').fill('fixture')
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await page.goto('/login')
    await expect(page).toHaveURL(/\/$/)
    await page.locator('.global-nav__account summary').click()
    await page.getByRole('button', { name: '로그아웃' }).click()
    await page.getByRole('link', { name: '로그인', exact: true }).click()
    await expect(page.locator('#login-email')).toBeVisible()
  })
})
