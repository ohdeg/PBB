/** 로또 통계 패턴 분석·점수 (몬테카를로 필터용) */

import {
  blendPatternScores,
  scoreContinuousPreference,
  scoreDiscretePreference,
  type LearnedPatternProfile,
} from './lottoPatternLearn'

const PRIMES = new Set([
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43,
])

/** 10단위 구간: 단번대(1-9), 10~40번대, 40번대(40-45) */
const DECADE_RANGES: ReadonlyArray<{ min: number; max: number }> = [
  { min: 1, max: 9 },
  { min: 10, max: 19 },
  { min: 20, max: 29 },
  { min: 30, max: 39 },
  { min: 40, max: 45 },
]

/** 1번·6번(최소·최대) 당첨번호 간격 안전지대 (1229회 기준 50%+ 밀집) */
export const LOTTO_FIRST_LAST_SPAN_MIN = 28
export const LOTTO_FIRST_LAST_SPAN_MAX = 38
/** 추첨 1게임당 안전지대 강제 적용 확률 */
export const LOTTO_FIRST_LAST_SPAN_SAFE_ZONE_PROBABILITY = 0.7

export function shouldEnforceFirstLastSpanSafeZone(): boolean {
  return Math.random() < LOTTO_FIRST_LAST_SPAN_SAFE_ZONE_PROBABILITY
}

export function getFirstLastSpan(numbers: readonly number[]): number {
  if (numbers.length < 2) return 0
  const sorted = [...numbers].sort((a, b) => a - b)
  return sorted[sorted.length - 1]! - sorted[0]!
}

export function isFirstLastSpanInSafeZone(numbers: readonly number[]): boolean {
  const span = getFirstLastSpan(numbers)
  return span >= LOTTO_FIRST_LAST_SPAN_MIN && span <= LOTTO_FIRST_LAST_SPAN_MAX
}

export interface LottoPatternContext {
  /** 직전 회차 당첨 번호 (이월수 분석) */
  previousDraw?: readonly number[]
  /** true면 1·6번 간격 안전지대 점수를 적용하지 않음 */
  ignoreFirstLastSpan?: boolean
  /** 선택한 구간에서 학습한 패턴 (있으면 고정 점수와 약한 학습 블렌드) */
  learnedProfile?: LearnedPatternProfile | null
}

export interface LottoPatternScoreBreakdown {
  total: number
  oddEven: number
  lowHigh: number
  sumRange: number
  decadeGap: number
  sameEnding: number
  primes: number
  multiplesOf3: number
  consecutive: number
  carryOver: number
  acValue: number
  firstLastSpan: number
}

function countInRange(nums: readonly number[], min: number, max: number): number {
  return nums.filter((n) => n >= min && n <= max).length
}

/** AC값 = 서로 다른 쌍 차이 개수 − (번호수 − 1) */
export function calculateACValue(numbers: readonly number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b)
  const diffs = new Set<number>()
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      diffs.add(sorted[j]! - sorted[i]!)
    }
  }
  return diffs.size - (sorted.length - 1)
}

function scoreRatioMatch(
  count: number,
  ideal: number,
  secondary: readonly number[],
): number {
  if (count === ideal) return 15
  if (secondary.includes(count)) return 10
  if (count === 0 || count === 6) return -40
  return 3
}

function scoreDecadeGap(numbers: readonly number[]): number {
  const filled = DECADE_RANGES.filter(
    (r) => countInRange(numbers, r.min, r.max) > 0,
  ).length
  const empty = DECADE_RANGES.length - filled
  if (empty >= 1) return 12
  return -20
}

function scoreSameEnding(numbers: readonly number[]): number {
  const endings = new Map<number, number>()
  for (const n of numbers) {
    const e = n % 10
    endings.set(e, (endings.get(e) ?? 0) + 1)
  }
  const hasPair = [...endings.values()].some((c) => c >= 2)
  return hasPair ? 10 : -12
}

function scorePrimes(numbers: readonly number[]): number {
  const pc = numbers.filter((n) => PRIMES.has(n)).length
  if (pc >= 1 && pc <= 2) return 10
  if (pc === 0) return -12
  return 5
}

function scoreMultiplesOf3(numbers: readonly number[]): number {
  const mc = numbers.filter((n) => n % 3 === 0).length
  if (mc >= 1 && mc <= 3) return 10
  if (mc === 0) return -15
  return 5
}

function scoreConsecutive(numbers: readonly number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b)
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1]! - sorted[i]! === 1) return 8
  }
  return -5
}

function scoreCarryOver(
  numbers: readonly number[],
  previousDraw?: readonly number[],
): number {
  if (!previousDraw || previousDraw.length === 0) return 0
  const overlap = numbers.filter((n) => previousDraw.includes(n)).length
  if (overlap === 1) return 15
  if (overlap === 0) return -5
  if (overlap === 2) return 6
  return 2
}

function scoreAC(numbers: readonly number[]): number {
  const ac = calculateACValue(numbers)
  if (ac >= 7 && ac <= 10) return 15
  if (ac >= 5 && ac <= 11) return 8
  return -10
}

function scoreSum(numbers: readonly number[]): number {
  const sum = numbers.reduce((a, b) => a + b, 0)
  if (sum >= 107 && sum <= 169) return 15
  if (sum >= 90 && sum <= 185) return 7
  return -10
}

function scoreFirstLastSpan(
  numbers: readonly number[],
  ignore?: boolean,
): number {
  if (ignore) return 0
  const span = getFirstLastSpan(numbers)
  if (span >= LOTTO_FIRST_LAST_SPAN_MIN && span <= LOTTO_FIRST_LAST_SPAN_MAX) {
    return 15
  }
  if (span >= 26 && span <= 40) return 4
  return -40
}

/** 6개 번호 조합의 통계 패턴 점수 (높을수록 이상적) */
export function scoreLottoPattern(
  numbers: readonly number[],
  context: LottoPatternContext = {},
): LottoPatternScoreBreakdown {
  if (numbers.length !== 6) {
    return {
      total: -999,
      oddEven: 0,
      lowHigh: 0,
      sumRange: 0,
      decadeGap: 0,
      sameEnding: 0,
      primes: 0,
      multiplesOf3: 0,
      consecutive: 0,
      carryOver: 0,
      acValue: 0,
      firstLastSpan: 0,
    }
  }

  const odd = numbers.filter((n) => n % 2 === 1).length
  const low = numbers.filter((n) => n <= 22).length
  const sorted = [...numbers].sort((a, b) => a - b)
  const filled = DECADE_RANGES.filter(
    (r) => countInRange(sorted, r.min, r.max) > 0,
  ).length
  const decadeEmpty = DECADE_RANGES.length - filled
  const endings = new Map<number, number>()
  for (const n of sorted) {
    const e = n % 10
    endings.set(e, (endings.get(e) ?? 0) + 1)
  }
  const hasSameEnding = [...endings.values()].some((c) => c >= 2) ? 1 : 0
  let hasConsecutive = 0
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1]! - sorted[i]! === 1) {
      hasConsecutive = 1
      break
    }
  }
  const primeCount = numbers.filter((n) => PRIMES.has(n)).length
  const multipleOf3Count = numbers.filter((n) => n % 3 === 0).length
  const carryOverlap =
    context.previousDraw && context.previousDraw.length > 0
      ? numbers.filter((n) => context.previousDraw!.includes(n)).length
      : 0
  const sum = numbers.reduce((a, b) => a + b, 0)
  const span = getFirstLastSpan(numbers)
  const ac = calculateACValue(numbers)

  const fixedOddEven = scoreRatioMatch(odd, 3, [2, 4])
  const fixedLowHigh = scoreRatioMatch(low, 3, [2, 4])
  const fixedSum = scoreSum(numbers)
  const fixedDecade = scoreDecadeGap(numbers)
  const fixedSameEnding = scoreSameEnding(numbers)
  const fixedPrimes = scorePrimes(numbers)
  const fixedMultiples = scoreMultiplesOf3(numbers)
  const fixedConsecutive = scoreConsecutive(numbers)
  const fixedCarryOver = scoreCarryOver(numbers, context.previousDraw)
  const fixedAc = scoreAC(numbers)
  const fixedSpan = scoreFirstLastSpan(numbers, context.ignoreFirstLastSpan)

  const profile = context.learnedProfile
  const strength = profile?.learnStrength ?? 0

  const oddEven = profile
    ? blendPatternScores(
        fixedOddEven,
        scoreDiscretePreference(odd, profile.oddCount),
        strength,
      )
    : fixedOddEven
  const lowHigh = profile
    ? blendPatternScores(
        fixedLowHigh,
        scoreDiscretePreference(low, profile.lowCount),
        strength,
      )
    : fixedLowHigh
  const sumRange = profile
    ? blendPatternScores(
        fixedSum,
        scoreContinuousPreference(sum, profile.sum),
        strength,
      )
    : fixedSum
  const decadeGap = profile
    ? blendPatternScores(
        fixedDecade,
        scoreDiscretePreference(decadeEmpty, profile.decadeEmpty),
        strength,
      )
    : fixedDecade
  const sameEnding = profile
    ? blendPatternScores(
        fixedSameEnding,
        scoreDiscretePreference(hasSameEnding, profile.hasSameEnding),
        strength,
      )
    : fixedSameEnding
  const primes = profile
    ? blendPatternScores(
        fixedPrimes,
        scoreDiscretePreference(primeCount, profile.primeCount),
        strength,
      )
    : fixedPrimes
  const multiplesOf3 = profile
    ? blendPatternScores(
        fixedMultiples,
        scoreDiscretePreference(multipleOf3Count, profile.multipleOf3Count),
        strength,
      )
    : fixedMultiples
  const consecutive = profile
    ? blendPatternScores(
        fixedConsecutive,
        scoreDiscretePreference(hasConsecutive, profile.hasConsecutive),
        strength,
      )
    : fixedConsecutive
  const carryOver = profile
    ? blendPatternScores(
        fixedCarryOver,
        scoreDiscretePreference(carryOverlap, profile.carryOver),
        strength,
      )
    : fixedCarryOver
  const acValue = profile
    ? blendPatternScores(
        fixedAc,
        scoreContinuousPreference(ac, profile.ac),
        strength,
      )
    : fixedAc
  const firstLastSpan =
    context.ignoreFirstLastSpan
      ? 0
      : profile
        ? blendPatternScores(
            fixedSpan,
            scoreContinuousPreference(span, profile.span),
            strength,
          )
        : fixedSpan

  const total =
    oddEven +
    lowHigh +
    sumRange +
    decadeGap +
    sameEnding +
    primes +
    multiplesOf3 +
    consecutive +
    carryOver +
    acValue +
    firstLastSpan

  return {
    total,
    oddEven,
    lowHigh,
    sumRange,
    decadeGap,
    sameEnding,
    primes,
    multiplesOf3,
    consecutive,
    carryOver,
    acValue,
    firstLastSpan,
  }
}

export function numbersKey(nums: readonly number[]): string {
  return [...nums].sort((a, b) => a - b).join(',')
}
