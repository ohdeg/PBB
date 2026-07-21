import {
  Fragment,
  Suspense,
  lazy,
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type ChangeEvent,
  type MouseEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { toPng } from 'html-to-image';
import { lottoApi } from '../api/lottoApi';
import { LottoButton as Button } from '../features/lotto/components/LottoButton';
import { SixPickSplashScreen } from '../features/lotto/components/SixPickSplashScreen';
import {
  DEFAULT_HOT_COLD_WINDOW,
  getDrawsForHotColdWindow,
  getHotColdWindowLabel,
  getLatestDraw,
  getNextSuggestedRoundFromLatest,
  hotColdFromDraws,
  HOT_COLD_WINDOW_OPTIONS,
  type HotColdWindowKey,
  validateDrawInput,
} from '../features/lotto/utils/lottoDrawStats';
import {
  DEFAULT_MONTE_CARLO_ITERATIONS,
  MAX_MONTE_CARLO_ITERATIONS,
  MIN_MONTE_CARLO_ITERATIONS,
  monteCarloPatternPickNumbers,
  resolveMonteCarloIterations,
  simulateWeightedDraw,
  type MonteCarloWeightMode,
} from '../features/lotto/utils/monteCarloLotto';
import { formatLottoDrawnDateTime } from '../features/lotto/utils/lottoDateFormat';
import { parseLottoExcelFile } from '../features/lotto/utils/parseLottoExcel';
import { formatWonAmount } from '../features/lotto/utils/lottoPayoutTax';
import { useAuthStore } from '../stores/authStore';
import type { LottoDraw, LottoHistoryItem } from '../types/lotto';
import { getErrorMessage } from '../utils/error';

const SIX_PICK_LOGO_SRC = '/6pick/logo.svg';

type LottoMainTab = 'draw' | 'payout';

/** 번호 생성 방식: 몬테카를로 패턴 반복 vs 단순 무작위 1회 */
type LottoGenerationMode = 'montecarlo' | 'random';

/** 실제 로또 공 색상 규칙(구간별)의 HEX 값 */
function getLottoBallHex(n: number): string {
  if (n <= 10) return '#fbc400'
  if (n <= 20) return '#69c8f2'
  if (n <= 30) return '#ff7272'
  if (n <= 40) return '#aaaaaa'
  return '#b0d840'
}

const LottoPayoutCalculator = lazy(() =>
  import('../features/lotto/components/LottoPayoutCalculator').then((m) => ({
    default: m.default,
  })),
);


/** Hot/Cold 풀 비중 (정수 스케일 1.5배) */
const HOT_COLD_UPWEIGHT = 1.5
const WEIGHT_SCALE = 10
const WEIGHTS = {
  normal: WEIGHT_SCALE,
  hot: Math.round(WEIGHT_SCALE * HOT_COLD_UPWEIGHT),
  cold: Math.round(WEIGHT_SCALE * HOT_COLD_UPWEIGHT),
} as const

const MONTE_CARLO_ITERATION_PRESETS = [5_000, 10_000, 20_000, 50_000] as const
const NON_ADMIN_MONTE_CARLO_ITERATIONS = 10_000

const DRAW_COUNT_PRESETS = [1, 3, 5, 10] as const
const MIN_DRAW_COUNT = 1
const MAX_DRAW_COUNT = 20
const DEFAULT_DRAW_COUNT = 1
const LOTTO_NUMBER_MAX = 45
/** 이 개수 이하로 남으면 추첨 풀을 자동 초기화 */
const MIN_REMAINING_BEFORE_POOL_RESET = 7

function resolveDrawCount(raw: string): number {
  const parsed = parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return DEFAULT_DRAW_COUNT
  return Math.min(MAX_DRAW_COUNT, Math.max(MIN_DRAW_COUNT, parsed))
}

function countAvailableDrawNumbers(
  preferred: readonly number[],
  used: ReadonlySet<number>,
): number {
  const preferredSet = new Set(preferred)
  let count = 0
  for (let n = 1; n <= LOTTO_NUMBER_MAX; n++) {
    if (!preferredSet.has(n) && !used.has(n)) count++
  }
  return count
}

function shouldAutoResetDrawNumberPool(
  preferred: readonly number[],
  used: ReadonlySet<number>,
  variablePickCount: number,
): boolean {
  const remaining = countAvailableDrawNumbers(preferred, used)
  return (
    remaining <= MIN_REMAINING_BEFORE_POOL_RESET ||
    remaining < variablePickCount
  )
}

function getMonteCarloStrategyMeta(
  iterations: number,
  useHotCold: boolean,
  hotColdWindow?: HotColdWindowKey,
) {
  const weightLabel = useHotCold
    ? `Hot/Cold ${hotColdWindow ? getHotColdWindowLabel(hotColdWindow) : '반영'}`
    : '균등 가중'
  return {
    category: `🎲 몬테카를로 패턴 (${iterations.toLocaleString()}회 · ${weightLabel})`,
    icon: '🎲',
    color: 'bg-amber-50 text-amber-700',
  } as const
}

function getRandomStrategyMeta(useHotCold: boolean, hotColdWindow?: HotColdWindowKey) {
  const weightLabel = useHotCold
    ? `Hot/Cold ${hotColdWindow ? getHotColdWindowLabel(hotColdWindow) : '반영'}`
    : '균등 가중'
  return {
    category: `🎰 단순 무작위 (${weightLabel})`,
    icon: '🎰',
    color: 'bg-sky-50 text-sky-700',
  } as const
}

function getHotColdBadgeLabel(item: LottoHistoryItem): string | null {
  if (item.hotColdApplied == null) return null
  if (!item.hotColdApplied) return 'Hot/Cold 미적용'
  if (item.hotColdWindow != null) {
    return `Hot/Cold 적용 · ${getHotColdWindowLabel(item.hotColdWindow)}`
  }
  return 'Hot/Cold 적용'
}

function getHistoryDateLabel(item: LottoHistoryItem): string {
  if (item.drawnAt) return formatLottoDrawnDateTime(item.drawnAt)
  return item.reviews
}

function LottoHistoryMetaBadges({ item }: { item: LottoHistoryItem }) {
  const hotColdLabel = getHotColdBadgeLabel(item)

  return (
    <div className="mb-1 flex flex-wrap items-center gap-1.5">
      {item.sixSetOrdinal != null && item.sixSetGameIndex != null && (
        <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-700 ring-1 ring-indigo-100">
          세트 {item.sixSetOrdinal} · {item.sixSetGameIndex}/6
        </span>
      )}
      {item.isSixSetComplementGame && (
        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-800 ring-1 ring-emerald-100">
          미출현 번호 (비중복)
        </span>
      )}
      {hotColdLabel && (
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-black ring-1 ${
            item.hotColdApplied
              ? 'bg-orange-50 text-orange-800 ring-orange-100'
              : 'bg-slate-100 text-slate-600 ring-slate-200'
          }`}
        >
          {hotColdLabel}
        </span>
      )}
    </div>
  )
}

const Icons = {
  Settings: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 7h-9" />
      <path d="M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </svg>
  ),
  Back: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  Upload: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  ),
  Skip: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 19 22 12 13 5 13 19" />
      <polygon points="2 19 11 12 2 5 2 19" />
    </svg>
  ),
  Empty: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto mb-3 opacity-50"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  Check: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Download: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  ),
  Trash: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  ),
  History: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  ),
  LogOut: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  ),
  Reset: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  ),
}

const LottoBall = ({
  number,
  isSelected,
  onClick,
  isHot,
  isCold,
  isPoolUsed,
  displayOnly,
  complementHighlight,
  size = 'md',
}: {
  number: number
  isSelected?: boolean
  onClick?: () => void
  isHot?: boolean
  isCold?: boolean
  /** 추첨 풀에서 이미 사용된 번호 */
  isPoolUsed?: boolean
  /** 읽기 전용(히스토리 등), 클릭·호버 축소 없음 */
  displayOnly?: boolean
  /** 1세트6게임 6번째 줄: 앞 5게임 미출현 번호 강조 */
  complementHighlight?: boolean
  size?: 'md' | 'sm'
}) => {
  const getBallColor = (n: number) => {
    if (n <= 10) return 'bg-[#fbc400] text-yellow-900'
    if (n <= 20) return 'bg-[#69c8f2] text-blue-900'
    if (n <= 30) return 'bg-[#ff7272] text-red-900'
    if (n <= 40) return 'bg-[#aaa] text-gray-900'
    return 'bg-[#b0d840] text-green-900'
  }

  const dim =
    size === 'sm'
      ? 'w-8 h-8 text-[11px] sm:w-9 sm:h-9 sm:text-sm'
      : 'w-9 h-9 text-xs sm:w-10 sm:h-10 sm:text-sm md:w-12 md:h-12 md:text-lg'

  const borderRing = isSelected
    ? 'border-gray-900 scale-110 ring-4 ring-blue-500/30 shadow-md'
    : complementHighlight
      ? 'border-emerald-500 ring-2 ring-emerald-500 ring-offset-2 ring-offset-white'
      : isPoolUsed
        ? 'border-white/40 opacity-35 saturate-50'
        : 'border-white/50 opacity-90'

  const interactive = displayOnly
    ? ''
    : 'transition-all duration-300 transform hover:scale-110 active:scale-95'

  const className = `relative ${dim} rounded-full inline-flex items-center justify-center font-black shadow-sm ${interactive} ${getBallColor(number)} border-2 ${borderRing}`

  const inner = (
    <>
      {number}
      {!displayOnly && isHot && !isSelected && (
        <div
          className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white animate-pulse"
          title="자주 나오는 번호"
        />
      )}
      {!displayOnly && isCold && !isSelected && (
        <div
          className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white"
          title="희귀 번호"
        />
      )}
    </>
  )

  if (displayOnly) {
    return (
      <span
        className={className}
        title={
          complementHighlight
            ? '앞 5게임에 나오지 않은 번호(미출현·비중복)'
            : undefined
        }
      >
        {inner}
      </span>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  )
}

interface MonteCarloAppearanceSnapshot {
  counts: number[]
  iterations: number
  pickedNumbers: number[]
}

function DrawHotColdNumbersDisplay({
  hotNumbers,
  coldNumbers,
}: {
  hotNumbers: readonly number[]
  coldNumbers: readonly number[]
}) {
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black text-red-600">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Hot (빈출) · {hotNumbers.length}개
        </p>
        <div className="flex flex-wrap gap-1">
          {hotNumbers.map((n) => (
            <LottoBall key={`draw-hot-${n}`} number={n} displayOnly size="sm" />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black text-blue-600">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          Cold (미출) · {coldNumbers.length}개
        </p>
        <div className="flex flex-wrap gap-1">
          {coldNumbers.map((n) => (
            <LottoBall key={`draw-cold-${n}`} number={n} displayOnly size="sm" />
          ))}
        </div>
      </div>
    </div>
  )
}

function DrawNumbersCard({
  draw,
  showAsLatest,
}: {
  draw: LottoDraw
  showAsLatest: boolean
}) {
  return (
    <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
      <p className="mb-3 text-center text-xs font-black text-indigo-800">
        {showAsLatest ? `최신 ${draw.round}회` : `${draw.round}회`}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {draw.mainNumbers.map((n) => (
          <LottoBall
            key={`draw-view-${draw.round}-${n}`}
            number={n}
            displayOnly
            size="sm"
          />
        ))}
      </div>
      {showAsLatest && draw.firstPrizeAmount != null && draw.firstPrizeAmount > 0 && (
        <p className="mt-3 text-center text-[11px] font-bold text-indigo-700">
          1등 1인당 {formatWonAmount(draw.firstPrizeAmount)}
          {draw.firstPrizeWinnerCount != null && draw.firstPrizeWinnerCount > 0 && (
            <span className="font-medium text-indigo-600">
              {' '}
              · 당첨 {draw.firstPrizeWinnerCount}명
            </span>
          )}
        </p>
      )}
    </div>
  )
}

function MonteCarloFrequencyChart({
  snapshot,
}: {
  snapshot: MonteCarloAppearanceSnapshot
}) {
  const maxCount = Math.max(
    ...snapshot.counts.slice(1, 46).map((c) => c ?? 0),
    1,
  )

  return (
    <section className="mb-6 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-amber-900">
          시뮬레이션 번호별 출현
        </p>
        <p className="text-[10px] font-bold text-slate-500">
          {snapshot.iterations.toLocaleString()}회 · 최다{' '}
          {maxCount.toLocaleString()}회
        </p>
      </div>
      <div className="overflow-x-auto pb-1">
        <div
          className="flex items-end gap-0.5"
          style={{ minWidth: 'min(100%, 45 * 18px)' }}
        >
          {Array.from({ length: 45 }, (_, i) => i + 1).map((num) => {
            const count = snapshot.counts[num] ?? 0
            const heightPct = Math.round((count / maxCount) * 100)
            const isPicked = snapshot.pickedNumbers.includes(num)
            return (
              <div
                key={`mc-bar-${num}`}
                className="flex min-w-[14px] flex-1 flex-col items-center"
                title={`${num}번 · ${count.toLocaleString()}회 출현`}
              >
                <span className="mb-0.5 text-[7px] font-bold tabular-nums text-slate-400">
                  {count > 0 ? count : ''}
                </span>
                <div className="flex h-24 w-full items-end justify-center">
                  <div
                    className={`w-full max-w-[12px] rounded-t transition-all ${
                      isPicked
                        ? 'bg-amber-500 ring-1 ring-amber-600'
                        : 'bg-amber-200'
                    }`}
                    style={{
                      height: count > 0 ? `${Math.max(heightPct, 4)}%` : '0%',
                    }}
                  />
                </div>
                <span
                  className={`mt-1 text-[8px] font-black ${
                    isPicked ? 'text-amber-700' : 'text-slate-500'
                  }`}
                >
                  {num}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <p className="mt-2 text-[10px] font-bold text-amber-800">
        진한 막대는 이번 추첨에 선택된 번호입니다.
      </p>
    </section>
  )
}

interface DrawMachinePoolBall {
  id: number
  number: number
  left: number
  bottom: number
  durationSec: number
  delaySec: number
  sizePx: number
  color: string
}

const DRAW_MACHINE_POOL_BALLS: DrawMachinePoolBall[] = Array.from(
  { length: 16 },
  (_, index) => {
    const seed = index + 1
    const number = ((seed * 9 + 5) % 45) + 1
    return {
      id: seed,
      number,
      left: 14 + ((seed * 11) % 72),
      bottom: 4 + ((seed * 7) % 22),
      durationSec: 1.8 + (seed % 4) * 0.24,
      delaySec: (seed % 8) * 0.12,
      sizePx: 30 - (seed % 3) * 2,
      color: getLottoBallHex(number),
    }
  },
)

function LottoDrawMachine({
  currentBalls,
  isRolling,
}: {
  currentBalls: number[]
  isRolling: boolean
}) {
  const machineRef = useRef<HTMLDivElement>(null)
  const outletRef = useRef<HTMLDivElement>(null)
  const slotRefs = useRef<Array<HTMLDivElement | null>>([])
  const prevBallCountRef = useRef(currentBalls.length)
  const [ejectAnim, setEjectAnim] = useState<{
    id: number
    number: number
    startX: number
    startY: number
    deltaX: number
    deltaY: number
  } | null>(null)
  const [ejectStage, setEjectStage] = useState<0 | 1 | 2>(0)
  const [isEjecting, setIsEjecting] = useState(false)
  const [isPreparingEject, setIsPreparingEject] = useState(false)
  const [landingSlotIndex, setLandingSlotIndex] = useState<number | null>(null)

  useEffect(() => {
    const prevCount = prevBallCountRef.current
    const nextCount = currentBalls.length

    if (nextCount <= prevCount) {
      prevBallCountRef.current = nextCount
      if (nextCount === 0) {
        setEjectAnim(null)
        setEjectStage(0)
        setIsEjecting(false)
        setIsPreparingEject(false)
        setLandingSlotIndex(null)
      }
      return
    }

    const machine = machineRef.current
    const outlet = outletRef.current
    const targetSlot = slotRefs.current[nextCount - 1]
    const nextBall = currentBalls[nextCount - 1]

    if (!machine || !outlet || !targetSlot || nextBall == null) {
      prevBallCountRef.current = nextCount
      return
    }

    const machineRect = machine.getBoundingClientRect()
    const outletRect = outlet.getBoundingClientRect()
    const targetRect = targetSlot.getBoundingClientRect()

    const startX = outletRect.left + outletRect.width / 2 - machineRect.left
    const startY = outletRect.top + outletRect.height / 2 - machineRect.top
    const endX = targetRect.left + targetRect.width / 2 - machineRect.left
    const endY = targetRect.top + targetRect.height / 2 - machineRect.top

    const animId = Date.now()
    setEjectAnim({
      id: animId,
      number: nextBall,
      startX,
      startY,
      deltaX: endX - startX,
      deltaY: endY - startY,
    })
    setLandingSlotIndex(null)
    setIsPreparingEject(true)
    setIsEjecting(false)
    setEjectStage(0)

    const prepId = window.setTimeout(() => {
      setIsPreparingEject(false)
      setIsEjecting(true)
      setEjectStage(1)
    }, 140)
    const arcId = window.setTimeout(() => {
      setEjectStage(2)
    }, 300)
    const timeoutId = window.setTimeout(() => {
      setLandingSlotIndex(nextCount - 1)
      setEjectAnim((prev) => (prev?.id === animId ? null : prev))
      setIsEjecting(false)
      const landingClearId = window.setTimeout(
        () => setLandingSlotIndex((prev) => (prev === nextCount - 1 ? null : prev)),
        420,
      )
      void landingClearId
    }, 650)

    prevBallCountRef.current = nextCount

    return () => {
      window.clearTimeout(prepId)
      window.clearTimeout(arcId)
      window.clearTimeout(timeoutId)
    }
  }, [currentBalls])

  const visibleCount = ejectAnim ? Math.max(currentBalls.length - 1, 0) : currentBalls.length
  const isShutterOpen = isPreparingEject || isEjecting
  const pullFocusX = 50
  const pullFocusBottom = 6

  return (
    <div
      ref={machineRef}
      className="relative mb-6 w-full max-w-full overflow-hidden rounded-[2rem] border border-violet-100 bg-gradient-to-b from-violet-50 via-white to-slate-50 px-3 pb-5 pt-5 shadow-sm sm:px-4"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,_rgba(196,181,253,0.28),_rgba(255,255,255,0)_58%)]" />

      <div className="relative mx-auto flex min-h-[22rem] w-full max-w-full flex-col items-center">
        <div className="relative aspect-square h-auto w-[min(16rem,78vw)] max-w-full rounded-full border-[10px] border-white/80 bg-gradient-to-br from-white/80 to-violet-100/40 shadow-[inset_0_16px_36px_rgba(139,92,246,0.18),0_10px_30px_-12px_rgba(139,92,246,0.35)] ring-1 ring-violet-200/60">
          <div className="absolute left-7 top-5 h-9 w-24 -rotate-12 rounded-full bg-white/80 blur-[1px]" />
          <div className="absolute left-10 top-16 h-4 w-4 rounded-full bg-white/70" />

          <div className="absolute inset-[8%] overflow-hidden rounded-full border border-white/70 bg-[radial-gradient(circle_at_50%_35%,_rgba(255,255,255,0.7),_rgba(237,233,254,0.35))]">
            <div className="absolute left-1/2 top-5 h-24 w-2 -translate-x-1/2 rounded-full bg-slate-300/65" />
            <div className="absolute left-1/2 top-24 h-10 w-10 -translate-x-1/2 rounded-full bg-slate-300/85" />
            {DRAW_MACHINE_POOL_BALLS.map((ball) => {
              const pullX = (pullFocusX - ball.left) * 0.24
              const pullY = (pullFocusBottom - ball.bottom) * 0.2
              return (
                <span
                  key={`pool-shell-${ball.id}`}
                  className="draw-machine-pool-ball-shell absolute"
                  style={{
                    left: `${ball.left}%`,
                    bottom: `${ball.bottom}%`,
                    width: `${ball.sizePx}px`,
                    height: `${ball.sizePx}px`,
                    marginLeft: `-${Math.round(ball.sizePx / 2)}px`,
                    transform: isShutterOpen
                      ? `translate(${pullX}px, ${pullY}px)`
                      : 'translate(0px, 0px)',
                    transition: 'transform 180ms cubic-bezier(0.18, 0.8, 0.3, 1)',
                  }}
                >
                  <span
                    className={`draw-machine-pool-ball inline-flex h-full w-full items-center justify-center rounded-full text-[10px] font-black text-slate-800/80 shadow-[inset_-2px_-3px_5px_rgba(0,0,0,0.12),inset_2px_2px_4px_rgba(255,255,255,0.55)] ${
                      isRolling ? 'opacity-100' : 'opacity-90'
                    }`}
                    style={{
                      animationDuration: `${ball.durationSec}s`,
                      animationDelay: `${ball.delaySec}s`,
                      background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,0.75), ${ball.color} 62%)`,
                    }}
                  >
                    {ball.number}
                  </span>
                </span>
              )
            })}
            {isPreparingEject && ejectAnim && (
              <span
                className="draw-machine-staged-ball absolute inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-100/90 bg-amber-300 text-[11px] font-black text-slate-700 shadow"
                style={{
                  left: '50%',
                  bottom: '8%',
                  marginLeft: '-16px',
                }}
              >
                {ejectAnim.number}
              </span>
            )}
          </div>
        </div>

        <div className="pointer-events-none absolute top-[15.6rem] h-20 w-14 rounded-b-xl bg-slate-400/75" />
        <div className="pointer-events-none absolute top-[18.3rem] h-3 w-[min(100%,18rem)] max-w-full rounded-full bg-slate-300/95" />
        <div className="pointer-events-none absolute top-[18.95rem] h-8 w-[min(100%,20rem)] max-w-full rounded-2xl bg-slate-300" />

        <div
          className={`pointer-events-none absolute left-1/2 top-[17.2rem] z-10 flex h-4 w-8 -translate-x-1/2 items-center justify-center ${
            isShutterOpen ? 'draw-machine-shutter-open' : ''
          }`}
        >
          <span
            className="h-1.5 w-3 origin-right rounded-l bg-slate-600/90 transition-transform duration-150"
            style={{
              transform: isShutterOpen ? 'rotate(-38deg)' : 'rotate(0deg)',
            }}
          />
          <span
            className="h-1.5 w-3 origin-left rounded-r bg-slate-600/90 transition-transform duration-150"
            style={{
              transform: isShutterOpen ? 'rotate(38deg)' : 'rotate(0deg)',
            }}
          />
        </div>

        <div
          ref={outletRef}
          className={`absolute left-1/2 top-[17.65rem] h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-500 bg-amber-300 shadow ${
            isRolling ? 'ring-2 ring-amber-300/70' : ''
          } ${isShutterOpen ? 'draw-machine-outlet-active' : ''}`}
        />

        <div className="mt-[4.9rem] w-full rounded-2xl border border-violet-100 bg-white/95 px-4 py-3 shadow-[0_8px_24px_-16px_rgba(139,92,246,0.5)] sm:w-72">
          <p className="mb-2 text-center text-[10px] font-black uppercase tracking-widest text-violet-500">
            추첨 결과
          </p>
          <div className="flex min-h-[2.5rem] flex-wrap justify-center gap-1.5">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={`slot-${idx}`}
                ref={(el) => {
                  slotRefs.current[idx] = el
                }}
                className={`flex h-8 w-8 items-center justify-center ${
                  landingSlotIndex === idx ? 'draw-machine-slot-landing' : ''
                }`}
              >
                {idx < visibleCount ? (
                  <div className="draw-machine-picked">
                    <LottoBall number={currentBalls[idx] as number} displayOnly size="sm" />
                  </div>
                ) : (
                  <span
                    className="h-8 w-8 rounded-full border border-dashed border-slate-300 bg-slate-50"
                    aria-hidden
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {ejectAnim && (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: `${ejectAnim.startX - 16}px`,
            top: `${ejectAnim.startY - 16}px`,
            transform: isEjecting
              ? ejectStage === 1
                ? `translate(${Math.round(ejectAnim.deltaX * 0.42)}px, ${Math.round(
                    ejectAnim.deltaY * 0.28 - 18,
                  )}px) scale(1.03)`
                : `translate(${ejectAnim.deltaX}px, ${ejectAnim.deltaY}px) scale(1)`
              : 'translate(0px, 0px) scale(0.92)',
            opacity: isEjecting ? 1 : 0.9,
            transition:
              ejectStage === 1
                ? 'transform 170ms ease-out, opacity 220ms ease-out'
                : 'transform 340ms cubic-bezier(0.12, 0.8, 0.22, 1), opacity 340ms ease-out',
          }}
        >
          <LottoBall number={ejectAnim.number} displayOnly size="sm" />
        </div>
      )}

      <style>{`
        @keyframes drawMachinePoolBall {
          0% { transform: translate(0px, 0px) scale(0.98); }
          25% { transform: translate(2px, -4px) scale(1); }
          50% { transform: translate(-2px, -2px) scale(0.97); }
          75% { transform: translate(1px, 1px) scale(1.01); }
          100% { transform: translate(0px, 0px) scale(0.98); }
        }
        .draw-machine-pool-ball {
          animation-name: drawMachinePoolBall;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        .draw-machine-outlet-active {
          animation: drawMachineOutletPulse 140ms ease-in-out infinite alternate;
        }
        @keyframes drawMachineOutletPulse {
          0% { transform: translate(-50%, -50%) scale(1); }
          100% { transform: translate(-50%, -50%) scale(1.08); }
        }
        .draw-machine-shutter-open {
          filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.35));
        }
        @keyframes drawMachineStaged {
          0% { transform: translateY(0px) scale(0.92); opacity: 0.85; }
          50% { transform: translateY(-4px) scale(1.03); opacity: 1; }
          100% { transform: translateY(0px) scale(0.92); opacity: 0.85; }
        }
        .draw-machine-staged-ball {
          animation: drawMachineStaged 220ms ease-in-out infinite;
        }
        @keyframes drawMachinePick {
          0% { opacity: 0; transform: translateY(-16px) scale(0.7); }
          60% { opacity: 1; transform: translateY(3px) scale(1.06); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .draw-machine-picked {
          animation: drawMachinePick 360ms ease-out;
        }
        @keyframes drawMachineSlotLanding {
          0% { transform: scale(1); box-shadow: 0 0 0 rgba(251,191,36,0.0); }
          45% { transform: scale(1.14); box-shadow: 0 0 0 7px rgba(251,191,36,0.22); }
          100% { transform: scale(1); box-shadow: 0 0 0 rgba(251,191,36,0.0); }
        }
        .draw-machine-slot-landing {
          border-radius: 999px;
          animation: drawMachineSlotLanding 380ms ease-out;
        }
      `}</style>
    </div>
  )
}

export function LottoPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const userClass = useAuthStore((s) => s.userClass);
  const isLottoAdmin = userClass === 'dev';
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = '6PICK';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const [history, setHistory] = useState<LottoHistoryItem[]>([])
  const [historyTargetRound, setHistoryTargetRound] = useState<number | null>(
    null,
  )
  const [activeTab, setActiveTab] = useState<LottoMainTab>('draw')
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [preferredNumbers, setPreferredNumbers] = useState<number[]>([])
  const [usedDrawNumbers, setUsedDrawNumbers] = useState<Set<number>>(
    () => new Set(),
  )
  const [currentBalls, setCurrentBalls] = useState<number[]>([])
  const [isRolling, setIsRolling] = useState(false)
  const [monteCarloAppearance, setMonteCarloAppearance] =
    useState<MonteCarloAppearanceSnapshot | null>(null)
  const [monteCarloIterationsInput, setMonteCarloIterationsInput] =
    useState(String(DEFAULT_MONTE_CARLO_ITERATIONS))
  const [drawCountInput, setDrawCountInput] = useState(String(DEFAULT_DRAW_COUNT))
  const resolvedDrawCount = useMemo(
    () => resolveDrawCount(drawCountInput),
    [drawCountInput],
  )
  /** 세부 추첨 설정 카드 펼침 여부 (기본 접힘 → 추첨기를 히어로로) */
  const [showSettings, setShowSettings] = useState(false)
  /** 번호 생성 방식 (몬테카를로 반복 vs 단순 무작위 1회) */
  const [generationMode, setGenerationMode] =
    useState<LottoGenerationMode>('random')
  /** 추첨 번호 풀 유지 여부 (이전 추첨 번호 제외 + 자동 리셋) */
  const [keepDrawPool, setKeepDrawPool] = useState(false)
  /** 몬테카를로 시뮬레이션에 Hot/Cold 가중치 사용 여부 */
  const [monteCarloUseHotCold, setMonteCarloUseHotCold] = useState(false)
  const [monteCarloHotColdWindow, setMonteCarloHotColdWindow] =
    useState<HotColdWindowKey>(DEFAULT_HOT_COLD_WINDOW)
  const [hasAnalyzedData, setHasAnalyzedData] = useState(false)

  const [hotColdWindow, setHotColdWindow] =
    useState<HotColdWindowKey>(DEFAULT_HOT_COLD_WINDOW)

  const [drawHistory, setDrawHistory] = useState<LottoDraw[]>([])
  const [drawsLoading, setDrawsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isSavingDraw, setIsSavingDraw] = useState(false)
  const [newDrawRound, setNewDrawRound] = useState('')
  const [newDrawNumbers, setNewDrawNumbers] = useState<number[]>([])
  const [newDrawBonus, setNewDrawBonus] = useState<number | null>(null)
  const [newDrawDate, setNewDrawDate] = useState('')
  const [newDrawFirstPrizeAmount, setNewDrawFirstPrizeAmount] = useState<
    number | null
  >(null)
  const [newDrawFirstPrizeWinnerCount, setNewDrawFirstPrizeWinnerCount] =
    useState<number | null>(null)
  const [searchRoundInput, setSearchRoundInput] = useState('')
  /** null이면 최신 회차 표시, 숫자면 해당 회차 표시 */
  const [displayRoundOverride, setDisplayRoundOverride] = useState<
    number | null
  >(null)
  /** true일 때만 번호 선택·저장 가능 (오클릭 방지) */
  const [isDrawEditMode, setIsDrawEditMode] = useState(false)
  /** true면 기존 회차 수정이 아닌 새 회차 추가 모드 */
  const [isAddingNewDraw, setIsAddingNewDraw] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const skipRef = useRef(false)
  const isHydratingPicksRef = useRef(false)
  const prevAccessTokenRef = useRef<string | null>(accessToken)
  const [exportItems, setExportItems] = useState<LottoHistoryItem[]>([])

  const isSelecting = selectedItems.length > 0

  const resolvedMonteCarloIterations = useMemo(
    () =>
      isLottoAdmin
        ? resolveMonteCarloIterations(monteCarloIterationsInput)
        : NON_ADMIN_MONTE_CARLO_ITERATIONS,
    [isLottoAdmin, monteCarloIterationsInput],
  )

  const remainingDrawPoolCount = useMemo(
    () => countAvailableDrawNumbers(preferredNumbers, usedDrawNumbers),
    [preferredNumbers, usedDrawNumbers],
  )

  /** 비로그인: Hot/Cold 구간 + 최신 회차만 표시 */
  const isGuestDrawViewer = !accessToken

  const applyHotColdFromDraws = (
    draws: LottoDraw[],
    _window: HotColdWindowKey,
  ) => {
    setHasAnalyzedData(draws.length > 0)
  }

  const latestStoredDraw = useMemo(
    () => getLatestDraw(drawHistory),
    [drawHistory],
  )

  const displayedDraw = useMemo(() => {
    if (displayRoundOverride !== null) {
      return (
        drawHistory.find((d) => d.round === displayRoundOverride) ?? null
      )
    }
    return latestStoredDraw
  }, [drawHistory, displayRoundOverride, latestStoredDraw])

  const isViewingLatest =
    displayedDraw !== null &&
    latestStoredDraw !== null &&
    displayedDraw.round === latestStoredDraw.round

  const hotColdAppliedDraws = useMemo(
    () => getDrawsForHotColdWindow(drawHistory, hotColdWindow),
    [drawHistory, hotColdWindow],
  )

  const drawHotColdStats = useMemo(() => {
    if (drawHistory.length === 0) {
      return { hotNumbers: [] as number[], coldNumbers: [] as number[] }
    }
    const { hotNumbers, coldNumbers } = hotColdFromDraws(
      drawHistory,
      hotColdWindow,
    )
    return { hotNumbers, coldNumbers }
  }, [drawHistory, hotColdWindow])

  const monteCarloHotColdStats = useMemo(() => {
    const appliedDraws = getDrawsForHotColdWindow(
      drawHistory,
      monteCarloHotColdWindow,
    )
    if (appliedDraws.length === 0) {
      return {
        hotNumbers: [] as number[],
        coldNumbers: [] as number[],
        appliedDrawCount: 0,
      }
    }
    const { hotNumbers, coldNumbers } = hotColdFromDraws(
      drawHistory,
      monteCarloHotColdWindow,
    )
    return {
      hotNumbers,
      coldNumbers,
      appliedDrawCount: appliedDraws.length,
    }
  }, [drawHistory, monteCarloHotColdWindow])

  const applyStoredDraws = (draws: LottoDraw[]) => {
    setDrawHistory(draws)
  }

  useEffect(() => {
    applyHotColdFromDraws(drawHistory, hotColdWindow)
  }, [drawHistory, hotColdWindow])

  const clearHistoryIfTargetRoundPublished = useCallback(
    (draws: LottoDraw[]) => {
      if (historyTargetRound == null) return

      const isPublished = draws.some(
        (draw) =>
          draw.round === historyTargetRound &&
          draw.mainNumbers.length === 6,
      )
      if (!isPublished) return

      setHistory([])
      setHistoryTargetRound(null)
      setSelectedItems([])
      setMonteCarloAppearance(null)
      if (useAuthStore.getState().accessToken) {
        void lottoApi.clearPicks().catch(console.error)
      }
    },
    [historyTargetRound],
  )

  const syncSuggestedRound = (draws: LottoDraw[]) => {
    setNewDrawRound(
      String(getNextSuggestedRoundFromLatest(getLatestDraw(draws))),
    )
  }

  // 회차 목록 로드 (로그인 여부와 무관하게 조회)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setDrawsLoading(true)
      try {
        const { data } = await lottoApi.listDraws()
        if (cancelled) return
        applyStoredDraws(data)
        syncSuggestedRound(data)
        clearHistoryIfTargetRoundPublished(data)
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setDrawsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [accessToken, clearHistoryIfTargetRoundPublished])

  // 로그인 시 저장된 추첨 내역 불러오기
  useEffect(() => {
    if (!accessToken) return

    let cancelled = false
    isHydratingPicksRef.current = true

    void (async () => {
      try {
        const { targetRound, items } = await lottoApi.getPicks()
        if (cancelled) return
        if (items.length > 0) {
          setHistory(items)
          setHistoryTargetRound(targetRound)
        }
      } catch (error) {
        console.error('추첨 내역 불러오기 실패', error)
      } finally {
        if (!cancelled) isHydratingPicksRef.current = false
      }
    })()

    return () => {
      cancelled = true
      isHydratingPicksRef.current = false
    }
  }, [accessToken])

  // 로그인 상태에서 추첨 내역 변경 시 서버에 저장(디바운스)
  useEffect(() => {
    if (!accessToken) return
    if (isHydratingPicksRef.current) return

    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          if (history.length === 0) {
            await lottoApi.clearPicks()
            return
          }
          await lottoApi.savePicks(historyTargetRound, history)
        } catch (error) {
          console.error('추첨 내역 저장 실패', error)
        }
      })()
    }, 600)

    return () => window.clearTimeout(handle)
  }, [history, historyTargetRound, accessToken])

  // 로그아웃 시 세션 추첨 내역 정리
  useEffect(() => {
    const prev = prevAccessTokenRef.current
    if (prev && !accessToken) {
      setHistory([])
      setHistoryTargetRound(null)
      setSelectedItems([])
      setMonteCarloAppearance(null)
    }
    prevAccessTokenRef.current = accessToken
  }, [accessToken])

  useEffect(() => {
    if (history.length === 0 && historyTargetRound != null) {
      setHistoryTargetRound(null)
    }
  }, [history.length, historyTargetRound])

  useEffect(() => {
    if (history.length === 0) return
    clearHistoryIfTargetRoundPublished(drawHistory)
  }, [drawHistory, history.length, clearHistoryIfTargetRoundPublished])

  // 창 포커스 복귀 시 회차 목록 새로고침
  useEffect(() => {
    const refreshDraws = () => {
      void lottoApi
        .listDraws()
        .then(({ data }) => {
          applyStoredDraws(data)
          clearHistoryIfTargetRoundPublished(data)
        })
        .catch(console.error)
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshDraws()
      }
    }

    window.addEventListener('focus', refreshDraws)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', refreshDraws)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [clearHistoryIfTargetRoundPublished])

  const loadDrawIntoEditor = (draw: LottoDraw) => {
    setNewDrawRound(String(draw.round))
    setNewDrawNumbers([...draw.mainNumbers])
    setNewDrawBonus(draw.bonusNumber ?? null)
    setNewDrawDate(draw.drawDate ?? '')
    setNewDrawFirstPrizeAmount(draw.firstPrizeAmount ?? null)
    setNewDrawFirstPrizeWinnerCount(draw.firstPrizeWinnerCount ?? null)
  }

  const clearDrawEditorMetadata = () => {
    setNewDrawBonus(null)
    setNewDrawDate('')
    setNewDrawFirstPrizeAmount(null)
    setNewDrawFirstPrizeWinnerCount(null)
  }

  const exitDrawEditMode = () => {
    setIsDrawEditMode(false)
    setIsAddingNewDraw(false)
    setNewDrawRound('')
    setNewDrawNumbers([])
    clearDrawEditorMetadata()
  }

  const startDrawEdit = () => {
    if (!displayedDraw) {
      alert('먼저 회차를 검색하거나 최신 보기를 선택해 주세요.')
      return
    }
    loadDrawIntoEditor(displayedDraw)
    setIsAddingNewDraw(false)
    setIsDrawEditMode(true)
  }

  const startNewDrawAdd = () => {
    const suggestedRound = getNextSuggestedRoundFromLatest(
      getLatestDraw(drawHistory),
    )
    setNewDrawRound(String(suggestedRound))
    setNewDrawNumbers([])
    clearDrawEditorMetadata()
    setIsAddingNewDraw(true)
    setIsDrawEditMode(true)
  }

  const showLatestDraw = () => {
    setDisplayRoundOverride(null)
    setSearchRoundInput('')
    exitDrawEditMode()
  }

  const handleSearchRound = () => {
    const round = parseInt(searchRoundInput, 10)
    if (!Number.isFinite(round) || round < 1) {
      alert('회차 번호를 입력해 주세요.')
      return
    }
    const found = drawHistory.find((d) => d.round === round)
    if (!found) {
      alert(`${round}회차 데이터를 찾을 수 없습니다.`)
      return
    }
    setDisplayRoundOverride(round)
    exitDrawEditMode()
  }

  const handleExcelUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }
    if (!isLottoAdmin) {
      alert('엑셀 가져오기는 DEV 회원만 사용할 수 있습니다.')
      e.target.value = ''
      return
    }
    if (
      !window.confirm(
        `'${file.name}'의 전체 회차를 저장합니다.\n기존 당첨 번호 데이터는 파일 내용으로 대체됩니다. Hot/Cold는 선택한 구간(${getHotColdWindowLabel(hotColdWindow)}) 기준으로 계산됩니다. 계속할까요?`,
      )
    ) {
      e.target.value = ''
      return
    }

    setIsUploading(true)
    try {
      const draws = await parseLottoExcelFile(file)
      if (draws.length === 0) {
        alert(
          '❌ 엑셀에서 유효한 회차 데이터를 찾지 못했습니다.\n\n· 동행복권 당첨번호 엑셀(.xlsx)인지 확인해 주세요.\n· 회차·본번호 6개 열이 있는 시트인지 확인해 주세요.',
        )
        return
      }
      const latest = getLatestDraw(draws)
      if (!latest) {
        return
      }

      const { data: next } = await lottoApi.replaceDraws(
        draws.map((draw) => ({
          round: draw.round,
          mainNumbers: draw.mainNumbers,
          bonusNumber: draw.bonusNumber ?? null,
          drawDate: draw.drawDate ?? null,
          firstPrizeAmount: draw.firstPrizeAmount ?? null,
          firstPrizeWinnerCount: draw.firstPrizeWinnerCount ?? null,
        })),
      )
      applyStoredDraws(next)
      setDisplayRoundOverride(null)
      exitDrawEditMode()
      syncSuggestedRound(next)
      alert(
        `✅ ${next.length}개 회차를 저장했습니다. (최신 ${latest.round}회) Hot/Cold가 반영되었습니다.`,
      )
    } catch (error: unknown) {
      alert(
        `❌ 엑셀 처리에 실패했습니다.\n\n${getErrorMessage(error, '알 수 없는 오류')}`,
      )
      console.error(error)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const toggleNewDrawNumber = (num: number) => {
    if (!isDrawEditMode) return
    if (newDrawNumbers.includes(num)) {
      setNewDrawNumbers((prev) => prev.filter((n) => n !== num))
    } else if (newDrawNumbers.length < 6) {
      setNewDrawNumbers((prev) => [...prev, num].sort((a, b) => a - b))
    }
  }

  const handleSaveDraw = async () => {
    if (!isDrawEditMode) return
    if (!isLottoAdmin) {
      alert('회차 수정은 관리자만 사용할 수 있습니다.')
      return
    }
    const round = parseInt(newDrawRound, 10)
    const err = validateDrawInput(round, newDrawNumbers)
    if (err) {
      alert(err)
      return
    }
    const mainNumbers = [...newDrawNumbers].sort((a, b) => a - b)
    if (
      newDrawBonus != null &&
      (newDrawBonus < 1 ||
        newDrawBonus > 45 ||
        mainNumbers.includes(newDrawBonus))
    ) {
      alert('보너스 번호는 1~45이며 본번호와 겹칠 수 없습니다.')
      return
    }
    const existing = drawHistory.find((d) => d.round === round)
    if (
      existing &&
      !window.confirm(`${round}회차 번호를 수정해 저장할까요?`)
    ) {
      return
    }
    if (
      !existing &&
      !window.confirm(`${round}회차를 새로 추가해 저장할까요?`)
    ) {
      return
    }

    setIsSavingDraw(true)
    try {
      await lottoApi.upsertDraw({
        round,
        mainNumbers,
        bonusNumber: newDrawBonus,
        drawDate: newDrawDate || null,
        firstPrizeAmount: newDrawFirstPrizeAmount,
        firstPrizeWinnerCount: newDrawFirstPrizeWinnerCount,
      })
      const { data: next } = await lottoApi.listDraws()
      applyStoredDraws(next)
      const savedLatest = getLatestDraw(next)
      if (savedLatest && savedLatest.round === round) {
        setDisplayRoundOverride(null)
      } else {
        setDisplayRoundOverride(round)
      }
      syncSuggestedRound(next)
      exitDrawEditMode()
      alert(`✅ ${round}회차를 저장했습니다. (전체 ${next.length}개 회차)`)
    } catch (error) {
      alert('❌ 회차 저장에 실패했습니다.')
      console.error(error)
    } finally {
      setIsSavingDraw(false)
    }
  }

  const togglePreferredNumber = (num: number) => {
    if (preferredNumbers.includes(num)) {
      setPreferredNumbers((prev) => prev.filter((n) => n !== num))
    } else if (preferredNumbers.length < 5) {
      setPreferredNumbers((prev) => [...prev, num].sort((a, b) => a - b))
    }
  }

  const resetDrawNumberPool = useCallback(() => {
    setUsedDrawNumbers(new Set())
  }, [])

  const getMonteCarloSimulationMode = (): MonteCarloWeightMode => {
    if (monteCarloUseHotCold && hasAnalyzedData) return 'BOTH'
    return 'NORMAL'
  }

  const monteCarloAppliesHotCold =
    monteCarloUseHotCold &&
    hasAnalyzedData &&
    monteCarloHotColdStats.appliedDrawCount > 0

  const pickPatternNumbers = (size: number, exclude: number[]) => {
    return monteCarloPatternPickNumbers(size, exclude, {
      mode: getMonteCarloSimulationMode(),
      hotNumbers: monteCarloHotColdStats.hotNumbers,
      coldNumbers: monteCarloHotColdStats.coldNumbers,
      hasAnalyzedData: monteCarloAppliesHotCold,
      weights: WEIGHTS,
      iterations: resolvedMonteCarloIterations,
      fixedNumbers: exclude,
      patternContext: {
        previousDraw: latestStoredDraw?.mainNumbers,
      },
    })
  }

  /** 단순 무작위 1회 추첨 (몬테카를로 반복·패턴 점수 없음, Hot/Cold 가중만 반영) */
  const pickRandomNumbers = (size: number, exclude: number[]): number[] => {
    return simulateWeightedDraw(size, exclude, {
      mode: getMonteCarloSimulationMode(),
      hotNumbers: monteCarloHotColdStats.hotNumbers,
      coldNumbers: monteCarloHotColdStats.coldNumbers,
      hasAnalyzedData: monteCarloAppliesHotCold,
      weights: WEIGHTS,
    })
  }

  const generateLottoNumbers = async () => {
    if (isRolling) return
    if (preferredNumbers.length >= 6) {
      alert('고정 번호는 최대 5개까지 선택할 수 있습니다.')
      return
    }

    const gameCount = resolvedDrawCount
    const isMonteCarlo = generationMode === 'montecarlo'
    setIsRolling(true)
    skipRef.current = false
    setMonteCarloAppearance(null)

    const modeMeta = isMonteCarlo
      ? getMonteCarloStrategyMeta(
          resolvedMonteCarloIterations,
          monteCarloAppliesHotCold,
          monteCarloAppliesHotCold ? monteCarloHotColdWindow : undefined,
        )
      : getRandomStrategyMeta(
          monteCarloAppliesHotCold,
          monteCarloAppliesHotCold ? monteCarloHotColdWindow : undefined,
        )

    const variablePickCount = 6 - preferredNumbers.length
    const newEntries: LottoHistoryItem[] = []
    const batchBaseId = Date.now()
    const targetRound = getNextSuggestedRoundFromLatest(latestStoredDraw)
    setHistoryTargetRound(targetRound)
    const drawnAt = new Date().toISOString()
    const drawnLabel = formatLottoDrawnDateTime(drawnAt)
    let usedPool = new Set(usedDrawNumbers)

    for (let gameIndex = 0; gameIndex < gameCount; gameIndex++) {
      const mustResetPool =
        keepDrawPool &&
        usedPool.size > 0 &&
        shouldAutoResetDrawNumberPool(
          preferredNumbers,
          usedPool,
          variablePickCount,
        )

      if (mustResetPool) {
        usedPool = new Set()
      }

      const excludeForPick = keepDrawPool
        ? [...preferredNumbers, ...usedPool]
        : [...preferredNumbers]

      let generatedNumbers: number[]
      if (isMonteCarlo) {
        const patternResult = pickPatternNumbers(
          variablePickCount,
          excludeForPick,
        )
        generatedNumbers = patternResult.numbers
        if (gameIndex === gameCount - 1) {
          setMonteCarloAppearance({
            counts: patternResult.appearanceCounts,
            iterations: patternResult.iterationsRun,
            pickedNumbers: [...preferredNumbers, ...patternResult.numbers].sort(
              (a, b) => a - b,
            ),
          })
        }
      } else {
        generatedNumbers = pickRandomNumbers(variablePickCount, excludeForPick)
      }

      const finalNumbers = [...preferredNumbers, ...generatedNumbers].sort(
        (a, b) => a - b,
      )

      if (keepDrawPool) {
        generatedNumbers.forEach((num) => {
          usedPool.add(num)
        })
      }

      const poolResetSuffix = mustResetPool ? ' · 번호 풀 초기화' : ''

      newEntries.push({
        id: batchBaseId + gameIndex,
        name: finalNumbers.join(', '),
        numbers: finalNumbers,
        category: `${modeMeta.category}${poolResetSuffix}`,
        reviews: drawnLabel,
        icon: modeMeta.icon,
        color: modeMeta.color,
        hotColdApplied: monteCarloAppliesHotCold,
        hotColdWindow: monteCarloAppliesHotCold
          ? monteCarloHotColdWindow
          : undefined,
        drawnAt,
        isNumberPoolResetStart: mustResetPool,
      })

      if (!skipRef.current) {
        setCurrentBalls([])
        for (let i = 0; i < finalNumbers.length; i++) {
          if (skipRef.current) break
          await new Promise((r) => setTimeout(r, 400))
          setCurrentBalls((prev) => [...prev, finalNumbers[i] as number])
        }
        if (!skipRef.current && gameIndex < gameCount - 1) {
          await new Promise((r) => setTimeout(r, 400))
        } else if (!skipRef.current) {
          await new Promise((r) => setTimeout(r, 600))
        }
      }
    }

    setHistory((prev) => [...newEntries.reverse(), ...prev])
    setUsedDrawNumbers(usedPool)
    setIsRolling(false)
    setCurrentBalls([])
    skipRef.current = false
  }

  const toggleItemSelection = (id: number) =>
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
    )

  const toggleSelectAll = () =>
    setSelectedItems(
      selectedItems.length === history.length
        ? []
        : history.map((item) => item.id),
    )

  const handleDeleteAction = () => {
    if (selectedItems.length > 0) {
      if (
        window.confirm(
          `선택한 ${selectedItems.length}개의 내역을 삭제하시겠습니까?`,
        )
      ) {
        setHistory((prev) => prev.filter((item) => !selectedItems.includes(item.id)))
        setSelectedItems([])
      }
    } else {
      if (window.confirm('추첨된 모든 번호 내역을 삭제하시겠습니까?')) {
        setHistory([])
        setSelectedItems([])
      }
    }
  }

  const handleDeleteIndividual = (e: MouseEvent, id: number) => {
    e.stopPropagation()
    setHistory((prev) => prev.filter((item) => item.id !== id))
    setSelectedItems((prev) => prev.filter((itemId) => itemId !== id))
  }

  const executeImageCapture = async (
    itemsToExport: LottoHistoryItem[],
    filename: string,
  ) => {
    setExportItems(itemsToExport)
    setTimeout(async () => {
      const element = document.getElementById('lotto-hidden-export-container')
      if (!element) return
      try {
        const dataUrl = await toPng(element, {
          backgroundColor: '#f8fafc',
          pixelRatio: 3,
        })
        const link = document.createElement('a')
        link.download = filename
        link.href = dataUrl
        link.click()
      } catch (error) {
        console.error('이미지 저장 실패:', error)
        alert('이미지 저장에 실패했습니다.')
      }
    }, 150)
  }

  const handleDownloadAction = () => {
    if (history.length === 0) return
    const targetData =
      selectedItems.length > 0
        ? history.filter((item) => selectedItems.includes(item.id))
        : history
    executeImageCapture(
      targetData,
      `로또_${selectedItems.length > 0 ? '선택저장' : '전체저장'}_${new Date().getTime()}.png`,
    )
  }

  const handleDownloadIndividual = (e: MouseEvent, item: LottoHistoryItem) => {
    e.stopPropagation()
    executeImageCapture(
      [item],
      `로또번호_${item.name.replace(/, /g, '_')}.png`,
    )
  }

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-clip bg-slate-50 pb-20 font-sans">
      {showSplash ? (
        <SixPickSplashScreen onFinish={handleSplashFinish} />
      ) : null}
      <div className="fixed -left-[9999px] -top-[9999px]">
        <div
          id="lotto-hidden-export-container"
          className="w-[420px] bg-slate-50 p-6 space-y-4"
        >
          <div className="mb-4 pb-4 border-b border-slate-200 flex justify-between items-end">
            <div>
              <span className="inline-block px-2.5 py-1 bg-blue-100 text-blue-600 rounded-md text-[10px] font-black tracking-widest mb-2">
                STRATEGIC DRAW
              </span>
              <h2 className="text-xl font-black text-slate-900">로또 추첨 결과</h2>
            </div>
            <p className="text-xs font-bold text-slate-400">
              {new Date().toLocaleDateString()}
            </p>
          </div>
          <div className="space-y-3">
            {exportItems.map((item) => (
              <div
                key={`export-${item.id}`}
                className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center shadow-sm"
              >
                <div
                  className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-xl shadow-inner ${item.color}`}
                >
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1 ml-4">
                  <LottoHistoryMetaBadges item={item} />
                  <p className="mb-1 text-[10px] font-bold text-slate-500">
                    {getHistoryDateLabel(item)}
                  </p>
                  <p className="mb-1 text-[10px] font-black text-slate-400">
                    {item.category}
                  </p>
                  {item.numbers && item.numbers.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {item.numbers.map((n) => (
                        <LottoBall
                          key={`export-${item.id}-${n}`}
                          number={n}
                          displayOnly
                          size="sm"
                          complementHighlight={Boolean(
                            item.isSixSetComplementGame,
                          )}
                        />
                      ))}
                    </div>
                  ) : (
                    <h4 className="text-lg font-black tracking-widest text-gray-900">
                      {item.name}
                    </h4>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-4 text-center">
            <p className="text-[10px] font-bold text-slate-300">행운을 빕니다!</p>
          </div>
        </div>
      </div>

      <header className="page-x sticky top-0 z-10 border-b border-gray-200/50 bg-slate-50/80 py-4 backdrop-blur-md">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="-ml-1 shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 sm:-ml-2"
            >
              <Icons.Back />
            </button>
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <img
                src={SIX_PICK_LOGO_SRC}
                alt="6PICK"
                width={40}
                height={40}
                className="h-9 w-9 shrink-0 rounded-xl shadow-sm sm:h-10 sm:w-10"
                draggable={false}
              />
              <div className="min-w-0">
              <h1 className="text-xl font-extrabold leading-tight tracking-wide text-gray-900 sm:text-2xl">
                6PICK
              </h1>
              <p className="truncate text-[10px] font-bold text-slate-500 sm:text-[11px] sm:whitespace-normal">
                {activeTab === 'draw'
                  ? '번호를 추첨합니다.'
                  : '당첨금 세금을 반영한 실수령액을 계산합니다.'}
              </p>
            </div>
            </div>
          </div>

          {isLottoAdmin ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  void handleExcelUpload(e)
                }}
                className="hidden"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-600 shadow-sm transition-all hover:bg-emerald-100 disabled:opacity-50"
              >
                {isUploading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
                ) : (
                  <Icons.Upload />
                )}
                <span className="hidden sm:inline">
                  {isUploading ? '가져오는 중…' : '엑셀 가져오기'}
                </span>
              </button>
            </div>
          ) : null}

          </div>

          <nav
            className="mt-4 flex rounded-xl bg-slate-100 p-1"
            aria-label="로또 메인 탭"
          >
            <button
              type="button"
              onClick={() => setActiveTab('draw')}
              className={`min-w-0 flex-1 rounded-lg px-2 py-2.5 text-[11px] font-black transition-all sm:px-4 sm:text-xs ${
                activeTab === 'draw'
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              추첨
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('payout')}
              className={`min-w-0 flex-1 rounded-lg px-2 py-2.5 text-[11px] font-black transition-all sm:px-4 sm:text-xs ${
                activeTab === 'payout'
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              실수령
            </button>
          </nav>
        </div>
      </header>

      <main className="page-x mx-auto w-full max-w-3xl py-4 sm:py-6">
        {activeTab === 'payout' ? (
          <Suspense
            fallback={
              <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-500 shadow-sm">
                실수령 계산기를 불러오는 중...
              </section>
            }
          >
            <LottoPayoutCalculator
              key={latestStoredDraw?.round ?? 'no-draw'}
              latestDraw={latestStoredDraw}
            />
          </Suspense>
        ) : (
          <>
          <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                  {isGuestDrawViewer ? '당첨 번호' : '당첨 번호 데이터'}
                </h2>
                <p className="mt-1 text-[11px] font-bold text-slate-500">
                  {isGuestDrawViewer
                    ? '최신 회차와 Hot/Cold 분석 구간을 조회할 수 있습니다.'
                    : isLottoAdmin
                      ? '회차 검색·수정·추가와 엑셀 가져오기를 사용할 수 있습니다.'
                      : '최신 회차를 확인하고 회차 검색으로 번호를 조회할 수 있습니다.'}
                </p>
              </div>
              {drawsLoading && (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
              )}
            </div>

            {!drawsLoading && isGuestDrawViewer && (
              <>
                {displayedDraw ? (
                  <DrawNumbersCard
                    draw={displayedDraw}
                    showAsLatest={isViewingLatest}
                  />
                ) : (
                  <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-center text-[11px] font-bold text-amber-800">
                    저장된 당첨 번호가 없습니다.
                  </p>
                )}

                {drawHistory.length > 0 && (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-600">
                      Hot/Cold 분석 구간
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {HOT_COLD_WINDOW_OPTIONS.map((opt) => (
                        <button
                          key={`guest-${opt.key}`}
                          type="button"
                          onClick={() => setHotColdWindow(opt.key)}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                            hotColdWindow === opt.key
                              ? 'bg-violet-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {hasAnalyzedData && (
                      <>
                        <p className="mt-2 text-[10px] font-bold text-violet-700">
                          {getHotColdWindowLabel(hotColdWindow)} ·{' '}
                          {hotColdAppliedDraws.length}회차 기준 적용
                        </p>
                        <DrawHotColdNumbersDisplay
                          hotNumbers={drawHotColdStats.hotNumbers}
                          coldNumbers={drawHotColdStats.coldNumbers}
                        />
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {!drawsLoading && !isGuestDrawViewer && (
              <>
                <span className="mb-3 inline-block rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                  전체 {drawHistory.length}회차 저장됨
                </span>

                {displayedDraw ? (
                  <DrawNumbersCard
                    draw={displayedDraw}
                    showAsLatest={isViewingLatest}
                  />
                ) : (
                  <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-center text-[11px] font-bold text-amber-800">
                    저장된 당첨 번호가 없습니다. 회차를 추가해 주세요.
                  </p>
                )}

                {drawHistory.length > 0 && (
                  <div className="mb-4 border-t border-slate-100 pt-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-600">
                      Hot/Cold 분석 구간
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {HOT_COLD_WINDOW_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setHotColdWindow(opt.key)}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                            hotColdWindow === opt.key
                              ? 'bg-violet-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {hasAnalyzedData && (
                      <>
                        <p className="mt-2 text-[10px] font-bold text-violet-700">
                          {getHotColdWindowLabel(hotColdWindow)} ·{' '}
                          {hotColdAppliedDraws.length}회차 기준 적용
                        </p>
                        <DrawHotColdNumbersDisplay
                          hotNumbers={drawHotColdStats.hotNumbers}
                          coldNumbers={drawHotColdStats.coldNumbers}
                        />
                      </>
                    )}
                  </div>
                )}

                {drawHistory.length > 0 && (
                  <div className="mb-4 border-t border-slate-100 pt-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-600">
                      회차 검색
                    </p>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-500">
                          회차 번호
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={searchRoundInput}
                          onChange={(e) => setSearchRoundInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSearchRound()
                          }}
                          placeholder="예: 1200"
                          className="w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleSearchRound}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        검색
                      </button>
                      <button
                        type="button"
                        onClick={showLatestDraw}
                        disabled={isViewingLatest}
                        className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        최신 보기
                      </button>
                    </div>
                  </div>
                )}

                {isLottoAdmin && (
                  <div className="border-t border-slate-100 pt-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                        회차 번호 수정 · 추가
                      </h3>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <Icons.Upload />
                        {isUploading ? '가져오는 중…' : '엑셀 가져오기'}
                      </button>
                    </div>
                    {!isDrawEditMode ? (
                      <>
                        <p className="mb-3 text-[10px] font-bold text-slate-500">
                          {displayedDraw
                            ? `${displayedDraw.round}회를 조회 중입니다. 수정하거나 새 회차를 추가할 수 있습니다.`
                            : '회차를 검색하거나 최신 보기를 선택한 뒤 수정하거나, 추가하기로 새 회차를 만들 수 있습니다.'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={startDrawEdit}
                            disabled={!displayedDraw}
                            className="flex-1 rounded-xl bg-violet-600 py-2.5 text-xs font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            수정하기
                          </Button>
                          <Button
                            type="button"
                            onClick={startNewDrawAdd}
                            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            추가하기
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="mb-3 text-[10px] font-bold text-slate-500">
                          {isAddingNewDraw
                            ? `새 회차 추가 · ${newDrawRound || '-'}회`
                            : `${newDrawRound}회 수정 · 번호 ${newDrawNumbers.length}/6`}
                        </p>
                        <div className="mb-4 grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-2">
                          <p className="sm:col-span-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                            추가 정보 (선택 · 직접 입력 가능)
                          </p>
                          <label className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-500">
                              추첨일
                            </span>
                            <input
                              type="date"
                              value={newDrawDate}
                              onChange={(e) => setNewDrawDate(e.target.value)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-500">
                              보너스 번호
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={45}
                              value={newDrawBonus ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value
                                if (raw === '') {
                                  setNewDrawBonus(null)
                                  return
                                }
                                const parsed = parseInt(raw, 10)
                                setNewDrawBonus(
                                  Number.isFinite(parsed) ? parsed : null,
                                )
                              }}
                              placeholder="1–45"
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                          </label>
                          <label className="flex flex-col gap-1 sm:col-span-2">
                            <span className="text-[10px] font-bold text-slate-500">
                              1등 1인당 당첨금 (원)
                            </span>
                            <input
                              type="number"
                              min={1}
                              value={newDrawFirstPrizeAmount ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value
                                if (raw === '') {
                                  setNewDrawFirstPrizeAmount(null)
                                  return
                                }
                                const parsed = parseInt(raw, 10)
                                setNewDrawFirstPrizeAmount(
                                  Number.isFinite(parsed) && parsed > 0
                                    ? parsed
                                    : null,
                                )
                              }}
                              placeholder="예: 3519759000"
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-500">
                              1등 당첨자 수
                            </span>
                            <input
                              type="number"
                              min={1}
                              value={newDrawFirstPrizeWinnerCount ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value
                                if (raw === '') {
                                  setNewDrawFirstPrizeWinnerCount(null)
                                  return
                                }
                                const parsed = parseInt(raw, 10)
                                setNewDrawFirstPrizeWinnerCount(
                                  Number.isFinite(parsed) && parsed > 0
                                    ? parsed
                                    : null,
                                )
                              }}
                              placeholder="명"
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                          </label>
                        </div>
                        <label className="mb-3 flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-slate-500">
                            회차 번호
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              value={newDrawRound}
                              onChange={(e) => setNewDrawRound(e.target.value)}
                              disabled={!isAddingNewDraw}
                              className="w-full max-w-[9rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            />
                          </div>
                        </label>
                        <div className="mb-4 flex flex-wrap justify-center gap-2">
                          {Array.from({ length: 45 }, (_, i) => i + 1).map(
                            (num) => (
                              <LottoBall
                                key={`new-draw-${num}`}
                                number={num}
                                isSelected={newDrawNumbers.includes(num)}
                                onClick={() => toggleNewDrawNumber(num)}
                              />
                            ),
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (isAddingNewDraw) {
                                void startNewDrawAdd()
                                return
                              }
                              if (displayedDraw) loadDrawIntoEditor(displayedDraw)
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50"
                          >
                            {isAddingNewDraw ? '초기화' : '되돌리기'}
                          </button>
                          <button
                            type="button"
                            onClick={exitDrawEditMode}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50"
                          >
                            취소
                          </button>
                          <Button
                            type="button"
                            disabled={
                              isSavingDraw ||
                              newDrawNumbers.length !== 6 ||
                              newDrawRound === ''
                            }
                            onClick={() => void handleSaveDraw()}
                            className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSavingDraw
                              ? '저장 중…'
                              : isAddingNewDraw
                                ? '추가 저장'
                                : '수정 저장'}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

        {showSettings && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/10"
            onClick={() => setShowSettings(false)}
            aria-hidden
          />
        )}
        <div className="fixed bottom-5 right-4 z-40 flex flex-col items-end gap-3 sm:right-5">
          {showSettings && (
            <div
              role="dialog"
              aria-label="추첨 설정"
              className="w-[min(360px,calc(100vw-2rem))] max-h-[72vh] space-y-4 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                    <Icons.Settings />
                  </span>
                  추첨 설정
                </span>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  aria-label="설정 닫기"
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex justify-between items-center mb-5">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                고정 번호 선택 ({preferredNumbers.length}/5)
              </span>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-red-500 rounded-full shadow-sm" />{' '}
                  Hot (빈출)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-blue-500 rounded-full shadow-sm" />{' '}
                  Cold (미출)
                </span>
                {hasAnalyzedData && (
                  <span className="text-violet-600">
                    · {getHotColdWindowLabel(hotColdWindow)} (
                    {hotColdAppliedDraws.length}회차)
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPreferredNumbers([])}
              className="text-[11px] font-bold px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"
            >
              초기화
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5">
            {Array.from({ length: 45 }, (_, i) => i + 1).map((num) => (
              <LottoBall
                key={num}
                number={num}
                isSelected={preferredNumbers.includes(num)}
                isPoolUsed={
                  usedDrawNumbers.has(num) && !preferredNumbers.includes(num)
                }
                isHot={
                  monteCarloUseHotCold &&
                  monteCarloHotColdStats.hotNumbers.includes(num)
                }
                isCold={
                  monteCarloUseHotCold &&
                  monteCarloHotColdStats.coldNumbers.includes(num)
                }
                onClick={() => togglePreferredNumber(num)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-700">
            생성 방식
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(
              [
                { key: 'montecarlo', label: '🎲 몬테카를로' },
                { key: 'random', label: '🎰 단순 무작위' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setGenerationMode(opt.key)}
                disabled={isRolling}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${
                  generationMode === opt.key
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mb-4 text-[10px] font-bold text-slate-500">
            {generationMode === 'montecarlo'
              ? '수천~수만 회 반복 시뮬레이션 후 패턴 점수가 높은 조합을 선별합니다.'
              : '반복·패턴 점수 없이 무작위로 한 번에 추첨합니다. (빠름)'}
          </p>

          <div className="mb-4 border-t border-slate-100 pt-3">
            <p className="mb-2 text-[11px] font-black text-slate-700">
              Hot/Cold 가중치
            </p>
            <button
              type="button"
              onClick={() => setMonteCarloUseHotCold((prev) => !prev)}
              disabled={!hasAnalyzedData}
              className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                !hasAnalyzedData
                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                  : monteCarloUseHotCold
                    ? 'border-violet-300 bg-violet-50 text-violet-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {monteCarloUseHotCold ? 'Hot/Cold 적용' : 'Hot/Cold 미적용 (균등)'}
            </button>
            {monteCarloUseHotCold && hasAnalyzedData && (
              <div className="mt-3">
                <p className="mb-2 text-[10px] font-bold text-slate-500">
                  HOT/COLD 분석 구간
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {HOT_COLD_WINDOW_OPTIONS.map((opt) => (
                    <button
                      key={`mc-${opt.key}`}
                      type="button"
                      onClick={() => setMonteCarloHotColdWindow(opt.key)}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                        monteCarloHotColdWindow === opt.key
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'bg-white text-slate-600 hover:bg-violet-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] font-bold text-violet-700">
                  {getHotColdWindowLabel(monteCarloHotColdWindow)} ·{' '}
                  {monteCarloHotColdStats.appliedDrawCount}회차 기준 Hot/Cold
                </p>
              </div>
            )}
            <p className="mt-2 text-[10px] font-bold text-slate-500">
              {!hasAnalyzedData
                ? '당첨 번호 데이터가 있어야 Hot/Cold를 적용할 수 있습니다.'
                : monteCarloUseHotCold
                  ? '선택한 구간의 Hot/Cold를 가중해 번호를 뽑습니다.'
                  : '1~45 균등 가중으로 번호를 뽑습니다.'}
            </p>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-black text-slate-700">
                  추첨 번호 풀 유지
                </p>
                <p className="text-[10px] font-bold text-slate-500">
                  {keepDrawPool
                    ? '이전에 나온 번호를 제외하고, 남은 번호가 적으면 자동 리셋합니다.'
                    : '매 게임 1~45 전체에서 추첨합니다. (게임 간 번호 중복 허용)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKeepDrawPool((prev) => !prev)}
                disabled={isRolling}
                aria-pressed={keepDrawPool}
                className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${
                  keepDrawPool
                    ? 'border-violet-300 bg-violet-600 text-white'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {keepDrawPool ? '유지 ON' : '유지 OFF'}
              </button>
            </div>
          </div>
        </section>

        {isLottoAdmin && generationMode === 'montecarlo' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-700">
                  몬테카를로 반복 횟수
                </p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {MONTE_CARLO_ITERATION_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setMonteCarloIterationsInput(String(preset))
                      }
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                        resolvedMonteCarloIterations === preset
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {preset.toLocaleString()}회
                    </button>
                  ))}
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-500">
                    직접 입력 (
                    {MIN_MONTE_CARLO_ITERATIONS.toLocaleString()}~
                    {MAX_MONTE_CARLO_ITERATIONS.toLocaleString()}회)
                  </span>
                  <input
                    type="number"
                    min={MIN_MONTE_CARLO_ITERATIONS}
                    max={MAX_MONTE_CARLO_ITERATIONS}
                    step={1}
                    value={monteCarloIterationsInput}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === '') {
                        setMonteCarloIterationsInput('')
                        return
                      }
                      const v = parseInt(raw, 10)
                      if (!Number.isFinite(v)) return
                      setMonteCarloIterationsInput(
                        String(
                          Math.min(
                            MAX_MONTE_CARLO_ITERATIONS,
                            Math.max(MIN_MONTE_CARLO_ITERATIONS, v),
                          ),
                        ),
                      )
                    }}
                    onBlur={() => {
                      if (monteCarloIterationsInput.trim() === '') {
                        setMonteCarloIterationsInput(
                          String(DEFAULT_MONTE_CARLO_ITERATIONS),
                        )
                      }
                    }}
                    className="w-full max-w-[12rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </label>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-700">
            추첨 게임 수
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {DRAW_COUNT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDrawCountInput(String(preset))}
                disabled={isRolling}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${
                  resolvedDrawCount === preset
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {preset}게임
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-500">
              직접 입력 ({MIN_DRAW_COUNT}~{MAX_DRAW_COUNT}게임)
            </span>
            <input
              type="number"
              min={MIN_DRAW_COUNT}
              max={MAX_DRAW_COUNT}
              step={1}
              value={drawCountInput}
              disabled={isRolling}
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') {
                  setDrawCountInput('')
                  return
                }
                const v = parseInt(raw, 10)
                if (!Number.isFinite(v)) return
                setDrawCountInput(
                  String(Math.min(MAX_DRAW_COUNT, Math.max(MIN_DRAW_COUNT, v))),
                )
              }}
              onBlur={() => {
                if (drawCountInput.trim() === '') {
                  setDrawCountInput(String(DEFAULT_DRAW_COUNT))
                }
              }}
              className="w-full max-w-[12rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
            />
          </label>
        </section>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            aria-expanded={showSettings}
            className="flex items-center gap-2 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 px-5 py-3.5 font-black text-white shadow-[0_14px_30px_-8px_rgba(139,92,246,0.75)] transition-transform hover:from-violet-600 hover:to-fuchsia-700 active:scale-95"
          >
            <Icons.Settings />
            <span className="text-xs">{showSettings ? '닫기' : '추첨 설정'}</span>
          </button>
        </div>

        <div className="relative">
          {isRolling && (
            <button
              type="button"
              onClick={() => {
                skipRef.current = true
              }}
              className="absolute right-5 top-4 z-10 flex items-center justify-center rounded-full border border-violet-100 bg-white p-2 text-violet-600 shadow-sm transition-colors hover:bg-violet-50 sm:gap-1 sm:px-3 sm:py-1.5"
              title="건너뛰기"
              aria-label="건너뛰기"
            >
              <Icons.Skip />
              <span className="hidden text-[11px] font-bold sm:inline">건너뛰기</span>
            </button>
          )}
          <LottoDrawMachine currentBalls={currentBalls} isRolling={isRolling} />
        </div>

        <div className="mb-4">
          <Button
            disabled={isRolling}
            onClick={() => void generateLottoNumbers()}
            className={`w-full rounded-2xl py-4 text-lg font-black transition-all ${
              isRolling
                ? 'cursor-not-allowed bg-slate-200 text-slate-400 shadow-none'
                : 'bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-[0_12px_28px_-10px_rgba(139,92,246,0.7)] hover:from-violet-600 hover:to-fuchsia-700 active:scale-[0.98]'
            }`}
          >
            {isRolling ? (
              <>
                <span className="sm:hidden">추첨 중…</span>
                <span className="hidden sm:inline">
                  {`추첨 중… (${resolvedDrawCount}게임)`}
                </span>
              </>
            ) : (
              <>
                <span className="sm:hidden">{`${resolvedDrawCount}게임 추첨`}</span>
                <span className="hidden sm:inline">
                  {`${resolvedDrawCount}게임 추첨하기`}
                </span>
              </>
            )}
          </Button>
        </div>

        <div
          className={`mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm ${
            keepDrawPool ? '' : 'opacity-60'
          }`}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-black text-slate-700">추첨 번호 풀</p>
            <p className="text-[10px] font-bold text-slate-500">
              {!keepDrawPool ? (
                '유지 꺼짐 · 매 게임 1~45 전체에서 추첨'
              ) : (
                <>
                  남은 번호 {remainingDrawPoolCount}개
                  {usedDrawNumbers.size > 0 &&
                    ` · 사용됨 ${usedDrawNumbers.size}개`}
                  {remainingDrawPoolCount <= MIN_REMAINING_BEFORE_POOL_RESET &&
                    usedDrawNumbers.size > 0 &&
                    ' · 다음 추첨 시 자동 리셋'}
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={resetDrawNumberPool}
            disabled={isRolling || !keepDrawPool || usedDrawNumbers.size === 0}
            title="사용된 번호 기록 초기화"
            aria-label="추첨 번호 풀 리셋"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icons.Reset />
            <span>풀 리셋</span>
          </button>
        </div>

        {monteCarloAppearance && !isRolling && (
          <MonteCarloFrequencyChart snapshot={monteCarloAppearance} />
        )}

        <div className="space-y-4">
          <div className="mb-2 space-y-2 px-1">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <h3 className="flex min-w-0 items-center gap-2 text-sm font-black text-slate-800">
                <span className="h-4 w-1.5 shrink-0 rounded-full bg-blue-500" />
                <span
                  className="flex shrink-0 items-center text-blue-600 sm:hidden"
                  title="최근 생성 결과"
                  aria-label="최근 생성 결과"
                >
                  <Icons.History />
                </span>
                <span className="hidden whitespace-nowrap sm:inline">최근 생성 결과</span>
                {accessToken && historyTargetRound != null && history.length > 0 && (
                  <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                    {historyTargetRound}회
                  </span>
                )}
              </h3>
              {accessToken && (
                <p className="hidden text-right text-[10px] font-bold text-slate-400 sm:block">
                  로그인 시 다른 기기에서도 동일하게 보입니다
                </p>
              )}
            </div>

            {history.length > 0 && (
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  title="전체 선택"
                  aria-label="전체 선택"
                  className="flex shrink-0 items-center gap-1.5 rounded-lg p-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 sm:px-0 sm:py-0 sm:hover:bg-transparent"
                >
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${selectedItems.length === history.length ? 'border-blue-500 bg-blue-500' : 'border-slate-300 bg-white'}`}
                  >
                    {selectedItems.length === history.length && <Icons.Check />}
                  </div>
                  <span className="hidden whitespace-nowrap sm:inline">전체 선택</span>
                </button>

                <div className="flex shrink-0 gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadAction}
                    title={
                      isSelecting
                        ? `${selectedItems.length}개 선택 저장`
                        : '전체 저장'
                    }
                    aria-label={
                      isSelecting
                        ? `${selectedItems.length}개 선택 저장`
                        : '전체 저장'
                    }
                    className="flex items-center justify-center gap-1 rounded-lg bg-blue-50 p-2 text-blue-600 transition-colors hover:bg-blue-100 sm:px-3 sm:py-1.5"
                  >
                    <Icons.Download />
                    <span className="hidden whitespace-nowrap text-[11px] font-bold sm:inline">
                      {isSelecting
                        ? `${selectedItems.length}개 선택 저장`
                        : '전체 저장'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAction}
                    title={
                      isSelecting
                        ? `${selectedItems.length}개 선택 삭제`
                        : '전체 삭제'
                    }
                    aria-label={
                      isSelecting
                        ? `${selectedItems.length}개 선택 삭제`
                        : '전체 삭제'
                    }
                    className="flex items-center justify-center gap-1 rounded-lg bg-red-50 p-2 text-red-500 transition-colors hover:bg-red-100 sm:px-3 sm:py-1.5"
                  >
                    <Icons.Trash />
                    <span className="hidden whitespace-nowrap text-[11px] font-bold sm:inline">
                      {isSelecting
                        ? `${selectedItems.length}개 선택 삭제`
                        : '전체 삭제'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 pb-2 pt-1 -mx-2 px-2">
            {history.length > 0 ? (
              history.map((item) => (
                <Fragment key={item.id}>
                  {item.isNumberPoolResetStart && (
                    <div
                      className="flex items-center gap-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-800"
                      aria-hidden
                    >
                      <span className="h-px min-w-[1rem] flex-1 bg-amber-200" />
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[9px] ring-1 ring-amber-200">
                        번호 풀 초기화 지점
                      </span>
                      <span className="h-px min-w-[1rem] flex-1 bg-amber-200" />
                    </div>
                  )}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleItemSelection(item.id)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault()
                        toggleItemSelection(item.id)
                      }
                    }}
                    className={`bg-white p-4 sm:p-5 rounded-2xl border shadow-sm flex items-center transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${selectedItems.includes(item.id) ? 'border-blue-300 ring-2 ring-blue-50' : 'border-slate-100'} ${item.isNumberPoolResetStart ? 'ring-1 ring-amber-200/80 border-amber-100' : ''} ${item.isSetBlockStart ? 'ring-1 ring-indigo-200/80 border-indigo-100' : ''}`}
                  >
                  <div className="mr-3 sm:mr-4">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedItems.includes(item.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-200 bg-slate-50'}`}
                    >
                      {selectedItems.includes(item.id) && <Icons.Check />}
                    </div>
                  </div>
                  <div
                    className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-xl shadow-inner ${item.color}`}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 ml-3 sm:ml-4 min-w-0">
                    <LottoHistoryMetaBadges item={item} />
                    <p className="mb-1 text-[10px] font-bold text-slate-500">
                      {getHistoryDateLabel(item)}
                    </p>
                    {item.numbers && item.numbers.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {item.numbers.map((n) => (
                          <LottoBall
                            key={`${item.id}-ball-${n}`}
                            number={n}
                            displayOnly
                            size="sm"
                            complementHighlight={Boolean(
                              item.isSixSetComplementGame,
                            )}
                          />
                        ))}
                      </div>
                    ) : (
                      <h4 className="text-base sm:text-lg font-black tracking-wider text-gray-900">
                        {item.name}
                      </h4>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 pl-2 sm:pl-3 border-l border-slate-100 ml-2">
                    <button
                      type="button"
                      onClick={(e) => handleDownloadIndividual(e, item)}
                      className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-500 transition-colors"
                      title="이 번호만 저장"
                    >
                      <Icons.Download />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteIndividual(e, item.id)}
                      className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="기록 삭제"
                    >
                      <Icons.Trash />
                    </button>
                  </div>
                </div>
                  {item.isSetBlockStart && (
                    <div
                      className="flex items-center gap-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-800"
                      aria-hidden
                    >
                      <span className="h-px min-w-[1rem] flex-1 bg-indigo-200" />
                      <span className="shrink-0 rounded-full bg-indigo-100 px-2.5 py-1 text-[9px] ring-1 ring-indigo-200">
                        {item.sixSetOrdinal != null
                          ? `세트 ${item.sixSetOrdinal}(6게임) 시작`
                          : '1세트(6게임) 세트 시작'}
                      </span>
                      <span className="h-px min-w-[1rem] flex-1 bg-indigo-200" />
                    </div>
                  )}
                </Fragment>
              ))
            ) : (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
                <Icons.Empty />
                <p className="text-sm font-bold">아직 생성된 번호가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
          </>
        )}
      </main>
    </div>
  )
}
