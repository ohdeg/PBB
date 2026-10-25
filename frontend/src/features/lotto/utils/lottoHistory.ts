import type {
  LottoDraw,
  LottoHistoryItem,
  LottoPrizeRank,
} from '../../../types/lotto'

export type LottoHistoryTab = 'pending' | 'won'

function validRound(round: unknown): round is number {
  return typeof round === 'number' && Number.isInteger(round) && round > 0
}

function validNumbers(numbers: unknown): numbers is number[] {
  return (
    Array.isArray(numbers) &&
    numbers.length === 6 &&
    new Set(numbers).size === 6 &&
    numbers.every((number) => Number.isInteger(number) && number >= 1 && number <= 45)
  )
}

export function migrateLottoHistory(
  items: LottoHistoryItem[],
  rootRound: number | null,
): LottoHistoryItem[] {
  return items.map((item) => {
    const won =
      item.status === 'won' &&
      Number.isInteger(item.prizeRank) &&
      item.prizeRank! >= 1 &&
      item.prizeRank! <= 5
    let targetRound: number | null = null
    if (validRound(item.targetRound)) {
      targetRound = item.targetRound
    } else if (!Object.hasOwn(item, 'targetRound') && !won && validRound(rootRound)) {
      // Only old pending records without their own round inherit the legacy root.
      targetRound = rootRound
    }
    return {
      ...item,
      targetRound,
      status: won ? 'won' : 'pending',
      prizeRank: won ? item.prizeRank : undefined,
      winAcknowledged: won ? item.winAcknowledged === true : undefined,
    }
  })
}

function completeDraw(draw: LottoDraw): boolean {
  const bonus = draw.bonusNumber
  return (
    validRound(draw.round) &&
    validNumbers(draw.mainNumbers) &&
    typeof bonus === 'number' &&
    Number.isInteger(bonus) &&
    bonus >= 1 && bonus <= 45 &&
    !draw.mainNumbers.includes(bonus)
  )
}

function prizeRank(matches: number, bonusMatches: boolean): LottoPrizeRank | null {
  if (matches === 6) return 1
  if (matches === 5) return bonusMatches ? 2 : 3
  if (matches === 4) return 4
  if (matches === 3) return 5
  return null
}

export function settleLottoHistory(
  items: LottoHistoryItem[],
  draws: LottoDraw[],
): LottoHistoryItem[] {
  const published = new Map(
    draws.filter(completeDraw).map((draw) => [draw.round, draw]),
  )
  let changed = false
  const settled = items.flatMap((item) => {
    if (item.status === 'won' || !validRound(item.targetRound) || !validNumbers(item.numbers)) {
      return [item]
    }
    const draw = published.get(item.targetRound)
    if (!draw) return [item]
    const matches = item.numbers.filter((number) => draw.mainNumbers.includes(number)).length
    const rank = prizeRank(matches, item.numbers.includes(draw.bonusNumber!))
    changed = true
    if (rank === null) return []
    return [{ ...item, status: 'won' as const, prizeRank: rank, winAcknowledged: false }]
  })
  return changed ? settled : items
}

export function getHistoryForTab(
  items: LottoHistoryItem[],
  tab: LottoHistoryTab,
): LottoHistoryItem[] {
  const filtered = items.filter((item) => (item.status === 'won') === (tab === 'won'))
  if (tab === 'pending') return filtered
  return filtered.sort((a, b) =>
    (b.targetRound ?? 0) - (a.targetRound ?? 0) || b.id - a.id,
  )
}

export function getHistoryActionItems(
  items: LottoHistoryItem[],
  tab: LottoHistoryTab,
  selected: number[],
): LottoHistoryItem[] {
  const visible = getHistoryForTab(items, tab)
  return selected.length
    ? visible.filter((item) => selected.includes(item.id))
    : visible
}

export function removeHistoryItems(
  items: LottoHistoryItem[],
  tab: LottoHistoryTab,
  selected: number[],
): LottoHistoryItem[] {
  const ids = new Set(getHistoryActionItems(items, tab, selected).map((item) => item.id))
  return items.filter((item) => !ids.has(item.id))
}

function isThisKoreanWeek(rawDate: string | null | undefined, now: Date): boolean {
  if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return false
  const date = new Date(`${rawDate}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== rawDate) {
    return false
  }
  const koreanToday = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  koreanToday.setUTCHours(0, 0, 0, 0)
  const monday = new Date(koreanToday)
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7)
  return date >= monday && date <= koreanToday
}

export function getWinNoticeMessage(
  wins: LottoHistoryItem[],
  draws: LottoDraw[],
  now = new Date(),
): string {
  const allFromThisWeek = wins.length > 0 && wins.every((item) => {
    const draw = draws.find((candidate) => candidate.round === item.targetRound)
    return isThisKoreanWeek(draw?.drawDate, now)
  })
  return allFromThisWeek
    ? '축하드립니다. 이번 주 당첨된 번호가 있습니다.'
    : '축하드립니다. 당첨된 번호가 있습니다.'
}
