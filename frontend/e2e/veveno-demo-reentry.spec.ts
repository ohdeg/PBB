import { expect, test, type Page } from '@playwright/test'

async function dismissOpenChecklist(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog', { name: '오픈' })
  try {
    await dialog.waitFor({ state: 'visible', timeout: 8_000 })
  } catch {
    return
  }
  await dialog.getByRole('button', { name: '닫기' }).click()
  await expect(dialog).toBeHidden()
}

test('after a demo stock-check, 사장님으로 써보기 still opens', async ({
  page,
}) => {
  test.setTimeout(45_000)
  await page.goto('/hobbies/veveno/stores/demo')
  await dismissOpenChecklist(page)
  await expect(page.getByRole('heading', { name: '베베노 카페' })).toBeVisible()

  await page.evaluate(() => {
    const raw = localStorage.getItem('veveno:demo:v5')
    if (!raw) {
      throw new Error('demo storage missing')
    }
    const data = JSON.parse(raw) as {
      stocks: { id: number }[]
      stockCheck: {
        requestId: string
        stockIds: number[]
        requestedAt: string
        updatedAt: string
      } | null
    }
    const firstId = data.stocks[0]?.id
    if (firstId == null) {
      throw new Error('no demo stocks')
    }
    const at = new Date().toISOString()
    data.stockCheck = {
      requestId: `check-${at}`,
      stockIds: [firstId],
      requestedAt: at,
      updatedAt: at,
    }
    localStorage.setItem('veveno:demo:v5', JSON.stringify(data))
    localStorage.setItem('veveno:stock-check:watch', 'demo')
  })

  await page.goto('/hobbies/veveno')
  await page.getByRole('link', { name: '사장님으로 써보기' }).click()
  await expect(page).toHaveURL(/\/hobbies\/veveno\/stores\/demo/)
  await dismissOpenChecklist(page)
  await expect(page.getByRole('heading', { name: '베베노 카페' })).toBeVisible()
})
