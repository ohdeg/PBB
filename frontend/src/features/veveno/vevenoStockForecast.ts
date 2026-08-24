export const STOCK_USAGE_WINDOW_DAYS = 14
export const STOCK_USAGE_MIN_SAMPLE_DAYS = 3
export const STOCK_USAGE_SOON_WITHIN_DAYS = 3

export interface StockUsageQty {
  qty: number
}

export const STOCK_USAGE_FORECAST_NONE = {
  soonLow: false,
  daysOfStock: null as number | null,
}

export function addDaysYmd(ymd: string, delta: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day + delta))
  return dt.toISOString().slice(0, 10)
}

export function stockUsageWindowStart(todayYmd: string): string {
  return addDaysYmd(todayYmd, -(STOCK_USAGE_WINDOW_DAYS - 1))
}

export function computeStockUsageForecast(
  stockNum: number,
  stockMinNum: number | null,
  days: StockUsageQty[],
): { soonLow: boolean; daysOfStock: number | null } {
  let dayCount = 0
  let sum = 0
  for (const day of days) {
    if (day.qty > 0) {
      dayCount += 1
      sum += day.qty
    }
  }
  if (dayCount < STOCK_USAGE_MIN_SAMPLE_DAYS || sum <= 0) {
    return STOCK_USAGE_FORECAST_NONE
  }
  const avg = sum / dayCount
  const daysOfStock = Math.floor(stockNum / avg)
  const alreadyLow = stockMinNum != null && stockNum <= stockMinNum
  const min = stockMinNum == null ? 0 : stockMinNum
  const remaining = Math.max(0, stockNum - min)
  const soonLow = !alreadyLow && remaining / avg <= STOCK_USAGE_SOON_WITHIN_DAYS
  return { soonLow, daysOfStock }
}
