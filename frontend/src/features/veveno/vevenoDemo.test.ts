import { beforeEach, describe, expect, it } from 'vitest'
import { isVevenoDemoStoreId, VEVENO_DEMO_STORE_ID } from './vevenoDemo'
import { applyDemoRole, resetVevenoDemo, vevenoDemoApi } from './vevenoDemoApi'

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
})
