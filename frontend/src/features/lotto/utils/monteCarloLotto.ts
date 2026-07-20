import {
  type LottoPatternContext,
  isFirstLastSpanInSafeZone,
  numbersKey,
  scoreLottoPattern,
  shouldEnforceFirstLastSpanSafeZone,
} from './lottoPatternScore'

/** 몬테카를로 1회 시뮬레이션당 가중 추첨에 쓰는 모드 */
export type MonteCarloWeightMode = 'NORMAL' | 'HOT' | 'COLD' | 'BOTH'

export interface MonteCarloWeightConfig {
  normal: number
  hot: number
  cold: number
}

export interface MonteCarloPickOptions {
  mode: MonteCarloWeightMode
  hotNumbers: readonly number[]
  coldNumbers: readonly number[]
  hasAnalyzedData: boolean
  weights: MonteCarloWeightConfig
  iterations?: number
  patternContext?: LottoPatternContext
  /** 고정 번호 — 패턴 점수는 고정+생성 합산 6개 기준 */
  fixedNumbers?: readonly number[]
}

export const DEFAULT_MONTE_CARLO_ITERATIONS = 10_000
export const MIN_MONTE_CARLO_ITERATIONS = 1
export const MAX_MONTE_CARLO_ITERATIONS = 9_999_999

export function clampMonteCarloIterations(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MONTE_CARLO_ITERATIONS
  return Math.min(
    MAX_MONTE_CARLO_ITERATIONS,
    Math.max(MIN_MONTE_CARLO_ITERATIONS, Math.round(value)),
  )
}

export function resolveMonteCarloIterations(
  input: string | number,
): number {
  const n =
    typeof input === 'number' ? input : parseInt(String(input).trim(), 10)
  return clampMonteCarloIterations(n)
}

function getNumberWeight(
  num: number,
  mode: MonteCarloWeightMode,
  hotNumbers: readonly number[],
  coldNumbers: readonly number[],
  hasAnalyzedData: boolean,
  weights: MonteCarloWeightConfig,
): number {
  let weight = weights.normal
  if (!hasAnalyzedData) return weight

  const isHot = hotNumbers.includes(num)
  const isCold = coldNumbers.includes(num)

  if (mode === 'HOT') {
    if (isHot) weight = weights.hot
  } else if (mode === 'COLD') {
    if (isCold) weight = weights.cold
  } else if (mode === 'BOTH') {
    if (isHot) weight = weights.hot
    else if (isCold) weight = weights.cold
  }
  return weight
}

/** 가중 룰렛으로 번호 1개 추첨 */
function pickOneWeighted(
  exclude: ReadonlySet<number>,
  mode: MonteCarloWeightMode,
  hotNumbers: readonly number[],
  coldNumbers: readonly number[],
  hasAnalyzedData: boolean,
  weights: MonteCarloWeightConfig,
): number | null {
  let total = 0
  const candidates: { num: number; weight: number }[] = []

  for (let n = 1; n <= 45; n++) {
    if (exclude.has(n)) continue
    const w = getNumberWeight(
      n,
      mode,
      hotNumbers,
      coldNumbers,
      hasAnalyzedData,
      weights,
    )
    candidates.push({ num: n, weight: w })
    total += w
  }

  if (candidates.length === 0 || total <= 0) return null

  let r = Math.random() * total
  for (const { num, weight } of candidates) {
    r -= weight
    if (r <= 0) return num
  }
  return candidates[candidates.length - 1]?.num ?? null
}

/** 시뮬레이션 1회: 가중 무작위로 size개 번호 추첨 */
export function simulateWeightedDraw(
  size: number,
  exclude: readonly number[],
  options: MonteCarloPickOptions,
): number[] {
  const excluded = new Set(exclude)
  const result: number[] = []

  while (result.length < size) {
    const picked = pickOneWeighted(
      excluded,
      options.mode,
      options.hotNumbers,
      options.coldNumbers,
      options.hasAnalyzedData,
      options.weights,
    )
    if (picked === null) break
    excluded.add(picked)
    result.push(picked)
  }

  return result.sort((a, b) => a - b)
}

interface ScoredCombo {
  numbers: number[]
  score: number
}

export interface MonteCarloPatternResult {
  numbers: number[]
  /** index = 번호(1~45), 값 = 시뮬레이션 출현 횟수 */
  appearanceCounts: number[]
  iterationsRun: number
}

function recordAppearance(
  counts: number[],
  numbers: readonly number[],
): void {
  for (const n of numbers) {
    if (n >= 1 && n <= 45) counts[n] = (counts[n] ?? 0) + 1
  }
}

const SPAN_FALLBACK_MAX_ATTEMPTS = 2_000

function pickSpanValidDraw(
  size: number,
  exclude: readonly number[],
  options: MonteCarloPickOptions,
  fixed: readonly number[],
): number[] | null {
  for (let attempt = 0; attempt < SPAN_FALLBACK_MAX_ATTEMPTS; attempt += 1) {
    const draw = simulateWeightedDraw(size, exclude, options)
    if (draw.length !== size) continue
    const full = [...fixed, ...draw].sort((a, b) => a - b)
    if (full.length !== 6) continue
    if (!isFirstLastSpanInSafeZone(full)) continue
    return draw
  }
  return null
}

/**
 * 몬테카를로 + 통계 패턴 점수:
 * iterations회 가중 추첨 후 패턴 점수가 높은 조합을 선택
 */
export function monteCarloPatternPickNumbers(
  size: number,
  exclude: readonly number[],
  options: MonteCarloPickOptions,
): MonteCarloPatternResult {
  if (size <= 0) {
    return { numbers: [], appearanceCounts: new Array<number>(46).fill(0), iterationsRun: 0 }
  }

  const iterations = options.iterations ?? DEFAULT_MONTE_CARLO_ITERATIONS
  const patternContext = options.patternContext ?? {}
  const enforceSpanSafeZone = shouldEnforceFirstLastSpanSafeZone()
  const scoringContext: LottoPatternContext = {
    ...patternContext,
    ignoreFirstLastSpan: !enforceSpanSafeZone,
  }
  const fixed = options.fixedNumbers ?? []
  const appearanceCounts = new Array<number>(46).fill(0)
  const scored = new Map<string, ScoredCombo>()

  for (let i = 0; i < iterations; i++) {
    const draw = simulateWeightedDraw(size, exclude, options)
    if (draw.length !== size) continue

    const full = [...fixed, ...draw].sort((a, b) => a - b)
    if (full.length !== 6) continue
    if (enforceSpanSafeZone && !isFirstLastSpanInSafeZone(full)) continue

    recordAppearance(appearanceCounts, full)

    const { total } = scoreLottoPattern(full, scoringContext)
    if (total < 25) continue

    const key = numbersKey(full)
    const existing = scored.get(key)
    if (!existing || total > existing.score) {
      scored.set(key, { numbers: draw, score: total })
    }
  }

  const candidates = [...scored.values()].sort((a, b) => b.score - a.score)
  if (candidates.length === 0) {
    const fallback = enforceSpanSafeZone
      ? pickSpanValidDraw(size, exclude, options, fixed) ??
        simulateWeightedDraw(size, exclude, options)
      : simulateWeightedDraw(size, exclude, options)
    const fullFallback = [...fixed, ...fallback].sort((a, b) => a - b)
    recordAppearance(appearanceCounts, fullFallback)
    return {
      numbers: fallback,
      appearanceCounts,
      iterationsRun: iterations,
    }
  }

  const topScore = candidates[0]!.score
  const minAccept = Math.max(25, topScore - 12)
  const eligible = candidates.filter((c) => c.score >= minAccept)
  const poolSize = Math.max(1, Math.ceil(eligible.length * 0.05))
  const pool = eligible.slice(0, poolSize)
  const pick = pool[Math.floor(Math.random() * pool.length)]!
  return {
    numbers: pick.numbers,
    appearanceCounts,
    iterationsRun: iterations,
  }
}

/** @deprecated 패턴 미적용 — monteCarloPatternPickNumbers 사용 */
export function monteCarloPickNumbers(
  size: number,
  exclude: readonly number[],
  options: MonteCarloPickOptions,
): number[] {
  return monteCarloPatternPickNumbers(size, exclude, options).numbers
}
