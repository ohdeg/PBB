import type { LottoDraw } from '../../../types/lotto'

/** Hot/Cold 기본 분석 구간 (52주) */
export const ROLLING_DRAW_COUNT = 52

/** Hot/Cold 분석에 쓸 회차 구간 */
export type HotColdWindowKey = 'all' | 52 | 12 | 8 | 4

export const DEFAULT_HOT_COLD_WINDOW: HotColdWindowKey = 52

export const HOT_COLD_WINDOW_OPTIONS: ReadonlyArray<{
  key: HotColdWindowKey
  label: string
}> = [
  { key: 'all', label: '전체 회차' },
  { key: 52, label: '52주' },
  { key: 12, label: '12주' },
  { key: 8, label: '8주' },
  { key: 4, label: '4주' },
] as const

export function getHotColdWindowLabel(window: HotColdWindowKey): string {
  return (
    HOT_COLD_WINDOW_OPTIONS.find((o) => o.key === window)?.label ?? '52주'
  )
}

/** 선택한 구간에 해당하는 회차 목록 (최신 N주 또는 전체) */
export function getDrawsForHotColdWindow(
  draws: LottoDraw[],
  window: HotColdWindowKey,
): LottoDraw[] {
  const sorted = sortDraws(draws)
  if (window === 'all') return sorted
  return sorted.slice(-window)
}

/** 1~45번 중 상·하위 몇 개를 Hot/Cold로 볼지 (20%) */
const HOT_COLD_PERCENTILE_FRACTION = 0.2

export function sortDraws(draws: LottoDraw[]): LottoDraw[] {
  return [...draws].sort((a, b) => a.round - b.round)
}

export function mergeDrawByRound(
  draws: LottoDraw[],
  draw: LottoDraw,
): LottoDraw[] {
  const without = draws.filter((d) => d.round !== draw.round)
  return sortDraws([...without, draw])
}

export function getLatestDraw(draws: LottoDraw[]): LottoDraw | null {
  if (draws.length === 0) return null
  return sortDraws(draws)[draws.length - 1] ?? null
}

export function getNextSuggestedRound(draws: LottoDraw[]): number {
  const latest = getLatestDraw(draws)
  return latest ? latest.round + 1 : 1
}

export function getNextSuggestedRoundFromLatest(
  latest: LottoDraw | null,
): number {
  return latest ? latest.round + 1 : 1
}

/** 본번호 6개: 1~45, 중복 없음. 유효하면 정렬된 배열, 아니면 null */
export function normalizeMainNumbers(nums: number[]): number[] | null {
  if (nums.length !== 6) return null
  const sorted = [...nums].sort((a, b) => a - b)
  if (sorted.some((n) => !Number.isInteger(n) || n < 1 || n > 45)) return null
  if (new Set(sorted).size !== 6) return null
  return sorted
}

export function validateDrawInput(
  round: number,
  mainNumbers: number[],
): string | null {
  if (!Number.isFinite(round) || round < 1 || !Number.isInteger(round)) {
    return '회차는 1 이상의 정수여야 합니다.'
  }
  const normalized = normalizeMainNumbers(mainNumbers)
  if (!normalized) {
    return '번호는 1~45 사이 서로 다른 숫자 6개여야 합니다.'
  }
  return null
}

/**
 * 최근 N회차 본번호 출현 횟수로 Hot/Cold 계산
 * - Hot: 출현 상위 20%
 * - Cold: 출현 하위 20% (Hot과 겹치지 않음)
 */
export function hotColdFromDraws(
  draws: LottoDraw[],
  window: HotColdWindowKey = DEFAULT_HOT_COLD_WINDOW,
): { hotNumbers: number[]; coldNumbers: number[] } {
  const rolling = getDrawsForHotColdWindow(draws, window)
  const counts = new Array(46).fill(0)
  rolling.forEach(({ mainNumbers }) => {
    mainNumbers.forEach((num) => {
      if (num >= 1 && num <= 45) counts[num]++
    })
  })
  return hotColdFromPercentileBands(counts)
}

function hotColdFromPercentileBands(countsArr: number[]): {
  hotNumbers: number[]
  coldNumbers: number[]
} {
  const nums = Array.from({ length: 45 }, (_, i) => i + 1)
  const pickCount = Math.max(1, Math.round(45 * HOT_COLD_PERCENTILE_FRACTION))

  const byCountDesc = [...nums].sort(
    (a, b) => (countsArr[b] ?? 0) - (countsArr[a] ?? 0) || a - b,
  )
  const hotNumbers = byCountDesc.slice(0, pickCount)
  const hotNumberSet = new Set(hotNumbers)

  const byCountAsc = [...nums].sort(
    (a, b) => (countsArr[a] ?? 0) - (countsArr[b] ?? 0) || a - b,
  )
  const coldNumbers: number[] = []
  for (const n of byCountAsc) {
    if (coldNumbers.length >= pickCount) break
    if (!hotNumberSet.has(n)) coldNumbers.push(n)
  }

  return { hotNumbers, coldNumbers }
}
