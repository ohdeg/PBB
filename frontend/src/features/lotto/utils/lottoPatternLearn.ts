import type { HotColdWindowKey } from './lottoDrawStats'
import type {
  LottoContinuousPreferenceDto,
  LottoDiscretePreferenceDto,
  LottoPatternProfileDto,
} from '../../../types/lotto'
import { hotColdWindowToApiKey } from '../../../types/lotto'

/** 구간별 패턴 반영 비율 (최대 70%). 서버와 동일 계약 — UI/폴백 참고용. */
export const PATTERN_LEARN_STRENGTH_BY_WINDOW: Record<
  HotColdWindowKey,
  number
> = {
  all: 0.7,
  52: 0.6,
  12: 0.5,
  8: 0.4,
  4: 0.3,
}

export const MAX_PATTERN_LEARN_STRENGTH = 0.7

export interface DiscreteCountPreference {
  counts: ReadonlyMap<number, number>
  mode: number
  sampleSize: number
}

export interface ContinuousBandPreference {
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  sampleSize: number
}

export interface LearnedPatternProfile {
  window: HotColdWindowKey
  sampleSize: number
  learnStrength: number
  oddCount: DiscreteCountPreference
  lowCount: DiscreteCountPreference
  primeCount: DiscreteCountPreference
  multipleOf3Count: DiscreteCountPreference
  decadeEmpty: DiscreteCountPreference
  carryOver: DiscreteCountPreference
  hasSameEnding: DiscreteCountPreference
  hasConsecutive: DiscreteCountPreference
  sum: ContinuousBandPreference
  span: ContinuousBandPreference
  ac: ContinuousBandPreference
}

function toDiscrete(dto: LottoDiscretePreferenceDto): DiscreteCountPreference {
  const counts = new Map<number, number>()
  for (const [key, value] of Object.entries(dto.counts ?? {})) {
    const n = Number(key)
    if (Number.isFinite(n)) counts.set(n, value)
  }
  return {
    counts,
    mode: dto.mode,
    sampleSize: dto.sampleSize,
  }
}

function toContinuous(
  dto: LottoContinuousPreferenceDto,
): ContinuousBandPreference {
  return {
    p10: dto.p10,
    p25: dto.p25,
    p50: dto.p50,
    p75: dto.p75,
    p90: dto.p90,
    sampleSize: dto.sampleSize,
  }
}

function parseWindowKey(raw: string): HotColdWindowKey | null {
  if (raw === 'all') return 'all'
  const n = Number(raw)
  if (n === 52 || n === 12 || n === 8 || n === 4) return n
  return null
}

/** Spring `GET /pattern-profiles` DTO → FE 채점용 profile */
export function learnedProfileFromDto(
  dto: LottoPatternProfileDto,
): LearnedPatternProfile | null {
  const window = parseWindowKey(dto.window)
  if (window == null) return null
  return {
    window,
    sampleSize: dto.sampleSize,
    learnStrength: dto.learnStrength,
    oddCount: toDiscrete(dto.oddCount),
    lowCount: toDiscrete(dto.lowCount),
    primeCount: toDiscrete(dto.primeCount),
    multipleOf3Count: toDiscrete(dto.multipleOf3Count),
    decadeEmpty: toDiscrete(dto.decadeEmpty),
    carryOver: toDiscrete(dto.carryOver),
    hasSameEnding: toDiscrete(dto.hasSameEnding),
    hasConsecutive: toDiscrete(dto.hasConsecutive),
    sum: toContinuous(dto.sum),
    span: toContinuous(dto.span),
    ac: toContinuous(dto.ac),
  }
}

export function pickProfileForWindow(
  profiles: Record<string, LottoPatternProfileDto> | null | undefined,
  window: HotColdWindowKey,
): LearnedPatternProfile | null {
  if (!profiles) return null
  const dto = profiles[hotColdWindowToApiKey(window)]
  if (!dto) return null
  return learnedProfileFromDto(dto)
}

/** 이산 관측 빈도에 따른 점수 (고정 채점과 비슷한 스케일) */
export function scoreDiscretePreference(
  value: number,
  pref: DiscreteCountPreference,
): number {
  if (pref.sampleSize <= 0) return 0
  const count = pref.counts.get(value) ?? 0
  const freq = count / pref.sampleSize
  if (value === pref.mode) return 15
  if (freq >= 0.2) return 10
  if (freq >= 0.1) return 5
  if (freq > 0) return 2
  return -12
}

/** 연속값 분위수 밴드에 따른 점수 */
export function scoreContinuousPreference(
  value: number,
  pref: ContinuousBandPreference,
): number {
  if (pref.sampleSize <= 0) return 0
  if (value >= pref.p25 && value <= pref.p75) return 15
  if (value >= pref.p10 && value <= pref.p90) return 7
  return -10
}

export function blendPatternScores(
  fixed: number,
  learned: number,
  strength: number,
): number {
  const s = Math.min(1, Math.max(0, strength))
  return (1 - s) * fixed + s * learned
}
