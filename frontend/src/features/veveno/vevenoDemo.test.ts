import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isVevenoDemoStoreId, VEVENO_DEMO_STORE_ID } from './vevenoDemo'
import * as demoSession from './pos/demoSession'
import { applyDemoRole, resetVevenoDemo, setDemoRole, vevenoDemoApi } from './vevenoDemoApi'

describe('veveno demo', () => {
  beforeEach(() => {
    resetVevenoDemo()
  })

  it('recognizes only the demo store id', () => {
    expect(isVevenoDemoStoreId(VEVENO_DEMO_STORE_ID)).toBe(true)
    expect(isVevenoDemoStoreId('other')).toBe(false)
  })

  it('staff role is subscribed and can edit stock on duty', () => {
    const owner = applyDemoRole('owner')
    expect(owner.owned).toBe(true)
    expect(owner.subscribed).toBe(false)

    const staff = applyDemoRole('staff')
    expect(staff.owned).toBe(false)
    expect(staff.subscribed).toBe(true)
    expect(staff.canEditStock).toBe(true)
    expect(staff.onDuty).toBe(true)
    expect(staff.inviteCode).toBeNull()
  })

  it('logs stock quantity changes locally', async () => {
    const { data: cats } = await vevenoDemoApi.listStocks(VEVENO_DEMO_STORE_ID)
    const stock = cats[0]?.stocks[0]
    expect(stock).toBeDefined()
    if (!stock) return

    await vevenoDemoApi.updateStock(stock.id, {
      stockName: stock.stockName,
      stockNum: stock.stockNum + 1,
      stockMinNum: stock.stockMinNum,
      version: stock.version,
    })
    const { data: logs } = await vevenoDemoApi.listStockLogs(
      VEVENO_DEMO_STORE_ID,
      stock.id,
    )
    expect(logs[0]?.fromNum).toBe(stock.stockNum)
    expect(logs[0]?.toNum).toBe(stock.stockNum + 1)
  })

  it('seeds 개 units and solo / overlap / handover / pending staff', async () => {
    const { data: cats } = await vevenoDemoApi.listStocks(VEVENO_DEMO_STORE_ID)
    expect(cats.flatMap((cat) => cat.stocks).every((row) => row.unit === '개')).toBe(
      true,
    )

    const { data: staff } = await vevenoDemoApi.listStaff(VEVENO_DEMO_STORE_ID)
    expect(staff.map((row) => row.nickname)).toEqual(
      expect.arrayContaining(['사장', '민수', '지혜', '태호']),
    )

    const { data: cal } = await vevenoDemoApi.getCalendar(
      VEVENO_DEMO_STORE_ID,
      '2026-08-24',
      '2026-08-30',
    )
    const regular = (date: string) =>
      cal.occurrences.filter((row) => row.date === date && row.type === 'REGULAR')
    expect(regular('2026-08-24')).toHaveLength(1)
    expect(regular('2026-08-25').map((row) => `${row.startTime}-${row.endTime}`).sort()).toEqual([
      '09:00-17:00',
      '11:00-19:00',
    ])
    expect(regular('2026-08-26').map((row) => `${row.startTime}-${row.endTime}`).sort()).toEqual([
      '08:00-16:00',
      '10:00-18:00',
      '12:00-20:00',
    ])
    expect(regular('2026-08-27').map((row) => row.startTime).sort()).toEqual([
      '09:00',
      '15:00',
    ])

    const { data: pending } = await vevenoDemoApi.listPendingCovers(VEVENO_DEMO_STORE_ID)
    expect(pending.map((row) => row.status).sort()).toEqual([
      'PENDING_COVER',
      'PENDING_OWNER',
    ])

    const { data: joins } = await vevenoDemoApi.listJoinRequests(VEVENO_DEMO_STORE_ID)
    expect(joins.map((row) => row.nickname)).toEqual(['하린'])
  })

  it('seeds soon-low ethiopia and hides order url from staff', async () => {
    const { data: ownerCats } = await vevenoDemoApi.listStocks(VEVENO_DEMO_STORE_ID)
    const ethiopia = ownerCats.flatMap((cat) => cat.stocks).find((row) => row.stockName === '에티오피아')
    expect(ethiopia?.soonLow).toBe(true)
    expect(ethiopia?.daysOfStock).toBe(2)
    expect(ethiopia?.orderUrl).toBe('https://example.com/beans')

    setDemoRole('staff')
    const { data: staffCats } = await vevenoDemoApi.listStocks(VEVENO_DEMO_STORE_ID)
    const staffEthiopia = staffCats
      .flatMap((cat) => cat.stocks)
      .find((row) => row.stockName === '에티오피아')
    expect(staffEthiopia?.soonLow).toBe(true)
    expect(staffEthiopia?.orderUrl).toBeNull()

    if (!staffEthiopia) return
    await vevenoDemoApi.updateStock(staffEthiopia.id, {
      stockName: staffEthiopia.stockName,
      stockNum: staffEthiopia.stockNum,
      stockMinNum: staffEthiopia.stockMinNum,
      version: staffEthiopia.version,
      orderUrl: 'https://evil.example/steal',
    })

    setDemoRole('owner')
    const { data: afterCats } = await vevenoDemoApi.listStocks(VEVENO_DEMO_STORE_ID)
    const after = afterCats.flatMap((cat) => cat.stocks).find((row) => row.stockName === '에티오피아')
    expect(after?.orderUrl).toBe('https://example.com/beans')
  })

  it('clears soon-low when ethiopia stock is raised well above usage', async () => {
    const { data: cats } = await vevenoDemoApi.listStocks(VEVENO_DEMO_STORE_ID)
    const ethiopia = cats.flatMap((cat) => cat.stocks).find((row) => row.stockName === '에티오피아')
    expect(ethiopia?.soonLow).toBe(true)
    if (!ethiopia) return

    await vevenoDemoApi.updateStock(ethiopia.id, {
      stockName: ethiopia.stockName,
      stockNum: 20,
      stockMinNum: ethiopia.stockMinNum,
      version: ethiopia.version,
    })
    const { data: afterCats } = await vevenoDemoApi.listStocks(VEVENO_DEMO_STORE_ID)
    const after = afterCats.flatMap((cat) => cat.stocks).find((row) => row.stockName === '에티오피아')
    expect(after?.soonLow).toBe(false)
    expect(after?.daysOfStock).toBe(20)
  })

  it('persists call bell phrase on the demo store', async () => {
    const { data: saved } = await vevenoDemoApi.updateCallBellPhrase(VEVENO_DEMO_STORE_ID, {
      phrase: '  픽업하세요  ',
      rate: 1.2,
      pitch: 0.8,
    })
    expect(saved.callBellPhrase).toBe('픽업하세요')
    expect(saved.callBellRate).toBe(1.2)
    expect(saved.callBellPitch).toBe(0.8)
    expect(applyDemoRole('staff').callBellPhrase).toBe('픽업하세요')
  })

  it('merges stock-check items then completes to owner done', async () => {
    setDemoRole('owner')
    const { data: cats } = await vevenoDemoApi.listStocks(VEVENO_DEMO_STORE_ID)
    const stocks = cats.flatMap((cat) => cat.stocks)
    const first = stocks[0]
    const second = stocks[1]
    expect(first && second).toBeTruthy()
    if (!first || !second) {
      return
    }

    const created = await vevenoDemoApi.createStockCheck(VEVENO_DEMO_STORE_ID, [first.id])
    const merged = await vevenoDemoApi.createStockCheck(VEVENO_DEMO_STORE_ID, [second.id, first.id])
    expect(merged.data.requestId).toBe(created.data.requestId)
    expect(merged.data.items.map((item) => item.id)).toEqual([first.id, second.id])

    await vevenoDemoApi.removeStockCheckItems(VEVENO_DEMO_STORE_ID, [second.id])
    const afterRemove = await vevenoDemoApi.getStockCheckCurrent(VEVENO_DEMO_STORE_ID)
    expect(afterRemove.data?.items.map((item) => item.id)).toEqual([first.id])

    const last = await vevenoDemoApi.removeStockCheckItems(VEVENO_DEMO_STORE_ID, [first.id])
    expect(last.data).toBeNull()

    await vevenoDemoApi.createStockCheck(VEVENO_DEMO_STORE_ID, [first.id])
    vi.spyOn(demoSession, 'getDemoPosSession').mockReturnValue({
      deviceId: 'demo-pos',
      canEditStock: false,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    await vevenoDemoApi.completeStockCheck(VEVENO_DEMO_STORE_ID)
    vi.restoreAllMocks()
    expect((await vevenoDemoApi.getStockCheckCurrent(VEVENO_DEMO_STORE_ID)).data).toBeNull()
    const done = await vevenoDemoApi.getStockCheckDone(VEVENO_DEMO_STORE_ID)
    expect(done.data?.items.map((item) => item.id)).toEqual([first.id])
    await vevenoDemoApi.ackStockCheckDone(VEVENO_DEMO_STORE_ID)
    expect((await vevenoDemoApi.getStockCheckDone(VEVENO_DEMO_STORE_ID)).data).toBeNull()
  })
})
