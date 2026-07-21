import * as XLSX from 'xlsx'
import type { LottoDraw } from '../../../types/lotto'
import { sortDraws } from './lottoDrawStats'

type ExcelCellValue = string | number | boolean | null | undefined
type ExcelRow = ExcelCellValue[]

function normalizeHeader(cell: ExcelCellValue): string {
  if (cell == null) return ''
  return String(cell).replace(/\s+/g, '').toLowerCase()
}

/** "1222", "제1222회", "1222회" 등에서 회차 숫자 추출 */
export function parseRoundCell(value: ExcelCellValue): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.replace(/\s+/g, '').trim()
    const direct = Number(trimmed.replace(/,/g, ''))
    if (Number.isFinite(direct) && direct >= 1 && direct <= 9999) {
      return Math.trunc(direct)
    }
    const match = trimmed.match(/(\d{1,4})/)
    if (match) {
      const n = Number(match[1])
      if (Number.isFinite(n) && n >= 1 && n <= 9999) return n
    }
  }
  return NaN
}

function parseLotteryNumberCell(value: ExcelCellValue): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.replace(/\s+/g, '').trim()
    if (!trimmed) return NaN
    const n = Number(trimmed.replace(/,/g, ''))
    if (Number.isFinite(n)) return Math.trunc(n)
  }
  return NaN
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 다양한 날짜 표기를 ISO "YYYY-MM-DD"로 변환 (실패 시 null) */
function parseDateCell(value: ExcelCellValue): string | null {
  if (value == null) return null

  // 엑셀 시리얼(날짜 서식이 숫자로 들어온 경우): 1899-12-30 기준
  if (typeof value === 'number' && Number.isFinite(value)) {
    const serial = Math.trunc(value)
    if (serial > 20000 && serial < 60000) {
      const ms = Math.round((serial - 25569) * 86400 * 1000)
      const d = new Date(ms)
      if (!Number.isNaN(d.getTime())) {
        return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
      }
    }
    return null
  }

  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null

  const ymd = raw.match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/)
  if (ymd) {
    const y = Number(ymd[1])
    const m = Number(ymd[2])
    const d = Number(ymd[3])
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${pad2(m)}-${pad2(d)}`
    }
  }

  const compact = raw.replace(/\D/g, '')
  if (compact.length === 8) {
    const y = Number(compact.slice(0, 4))
    const m = Number(compact.slice(4, 6))
    const d = Number(compact.slice(6, 8))
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${pad2(m)}-${pad2(d)}`
    }
  }
  return null
}

/** 콤마·"원"·공백 등을 제거하고 양의 정수 반환 (실패 시 null) */
function parsePositiveIntCell(value: ExcelCellValue): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.trunc(value)
    return n > 0 ? n : null
  }
  if (typeof value === 'string') {
    const digits = value.replace(/[^0-9]/g, '')
    if (!digits) return null
    const n = Number(digits)
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
  }
  return null
}

function isValidMainNumbers(nums: number[]): boolean {
  if (nums.length !== 6) return false
  if (nums.some((n) => !Number.isFinite(n) || n < 1 || n > 45)) return false
  return new Set(nums).size === 6
}

interface ColumnLayout {
  roundCol: number
  numberCols: number[]
  bonusCol?: number
  drawDateCol?: number
  firstPrizeAmountCol?: number
  firstPrizeWinnerCountCol?: number
}

/**
 * 동행복권 공식 엑셀은 2줄 병합 헤더(예: 상단 "1등" / 하단 "당첨게임수·당첨금액")이므로
 * 헤더행과 바로 아랫행을 열별로 합쳐 라벨을 인식한다.
 */
function buildCombinedHeaders(jsonData: ExcelRow[], headerRowIndex: number): string[] {
  const rows = [
    jsonData[headerRowIndex] || [],
    jsonData[headerRowIndex + 1] || [],
  ]
  const maxCols = Math.max(0, ...rows.map((r) => r.length))
  const combined: string[] = []
  for (let c = 0; c < maxCols; c++) {
    combined[c] = rows
      .map((r) => normalizeHeader(r[c]))
      .filter(Boolean)
      .join('|')
  }
  return combined
}

function detectExtraColumns(
  headers: string[],
  numberCols: number[],
): Pick<
  ColumnLayout,
  'bonusCol' | 'drawDateCol' | 'firstPrizeAmountCol' | 'firstPrizeWinnerCountCol'
> {
  const numberSet = new Set(numberCols)
  const findCol = (predicate: (h: string) => boolean): number | undefined => {
    const idx = headers.findIndex((h, i) => !numberSet.has(i) && predicate(h))
    return idx === -1 ? undefined : idx
  }

  const bonusCol = findCol((h) => h.includes('보너스') || h.includes('bonus'))
  const drawDateCol = findCol((h) => h.includes('추첨일') || h === 'date')
  // 등수별로 반복되는 라벨이라 첫 번째(최좌측)가 1등이다.
  const firstPrizeWinnerCountCol = findCol(
    (h) => h.includes('당첨게임수') || h.includes('당첨자수'),
  )
  const firstPrizeAmountCol = findCol(
    (h) => h.includes('당첨금액') || (h.includes('당첨금') && !h.includes('게임') && !h.includes('자수')),
  )

  return { bonusCol, drawDateCol, firstPrizeAmountCol, firstPrizeWinnerCountCol }
}

function detectColumnLayout(
  jsonData: ExcelRow[],
  headerRowIndex: number,
): ColumnLayout | null {
  const headers = buildCombinedHeaders(jsonData, headerRowIndex)

  let roundCol = headers.findIndex((h) => h.includes('회차') || h === 'round')
  if (roundCol === -1) roundCol = 0

  let numberCols: number[] | null = null

  // 길이 6으로 초기화: 희소 배열이면 every()가 빈 슬롯을 건너뛰어 오탐한다.
  const byBallIndex: Array<number | undefined> = new Array<number | undefined>(6).fill(undefined)
  headers.forEach((h, idx) => {
    const drwt = h.match(/drwtno(\d)/)
    if (drwt) {
      const n = Number(drwt[1])
      if (n >= 1 && n <= 6) byBallIndex[n - 1] = idx
      return
    }
    const ballKo = h.match(/^번호?(\d)$|^(\d)번$/)
    if (ballKo) {
      const n = Number(ballKo[1] ?? ballKo[2])
      if (n >= 1 && n <= 6) byBallIndex[n - 1] = idx
      return
    }
    if (/^[1-6]$/.test(h)) {
      const n = Number(h)
      byBallIndex[n - 1] = idx
    }
  })
  if (byBallIndex.every((c) => c !== undefined)) {
    numberCols = byBallIndex as number[]
  }

  const bonusCol = headers.findIndex(
    (h) => h.includes('보너스') || h.includes('bonus'),
  )
  if (!numberCols && bonusCol >= 6) {
    numberCols = Array.from({ length: 6 }, (_, i) => bonusCol - 6 + i)
  }

  if (!numberCols) {
    const numericHeaderCols: number[] = []
    headers.forEach((h, idx) => {
      if (/^[1-6]$/.test(h)) numericHeaderCols.push(idx)
    })
    if (numericHeaderCols.length >= 6) {
      numericHeaderCols.sort((a, b) => a - b)
      numberCols = numericHeaderCols.slice(0, 6)
    }
  }

  if (!numberCols) return null

  return {
    roundCol,
    numberCols,
    ...detectExtraColumns(headers, numberCols),
  }
}

function inferLayoutFromDataRows(jsonData: ExcelRow[], startRow: number): ColumnLayout | null {
  for (let r = startRow; r < Math.min(startRow + 30, jsonData.length); r++) {
    const row = jsonData[r]
    if (!row) continue
    for (let start = 0; start <= row.length - 7; start++) {
      const round = parseRoundCell(row[start])
      if (!Number.isFinite(round) || round < 1) continue
      const nums = row
        .slice(start + 1, start + 7)
        .map((v) => parseLotteryNumberCell(v))
      if (isValidMainNumbers(nums)) {
        return {
          roundCol: start,
          numberCols: Array.from({ length: 6 }, (_, i) => start + 1 + i),
        }
      }
    }
  }
  return null
}

function findHeaderRowIndex(jsonData: ExcelRow[]): number {
  for (let i = 0; i < Math.min(30, jsonData.length); i++) {
    const row = jsonData[i] || []
    const hasRound = row.some(
      (cell) =>
        typeof cell === 'string' &&
        normalizeHeader(cell).includes('회차'),
    )
    const hasBonus = row.some(
      (cell) =>
        typeof cell === 'string' &&
        normalizeHeader(cell).includes('보너스'),
    )
    const hasNumberHeader = row.some((cell) => {
      const h = normalizeHeader(cell)
      return /^[1-6]$/.test(h) || h.includes('drwtno')
    })
    if (hasRound || hasBonus || hasNumberHeader) return i
  }
  return 0
}

function parseSheetRows(jsonData: ExcelRow[]): LottoDraw[] {
  if (jsonData.length === 0) return []

  const headerRowIndex = findHeaderRowIndex(jsonData)

  let layout =
    detectColumnLayout(jsonData, headerRowIndex) ??
    inferLayoutFromDataRows(jsonData, headerRowIndex + 1)

  if (!layout) {
    const bonusColIdx = 8
    layout = {
      roundCol: 1,
      numberCols: Array.from({ length: 6 }, (_, i) => bonusColIdx - 6 + i),
    }
  }

  const parsed: LottoDraw[] = []

  for (let r = headerRowIndex + 1; r < jsonData.length; r++) {
    const row = jsonData[r]
    if (!row) continue

    const round = parseRoundCell(row[layout.roundCol])
    if (!Number.isFinite(round)) continue

    const mainNumbers = layout.numberCols.map((col) =>
      parseLotteryNumberCell(row[col]),
    )
    if (!isValidMainNumbers(mainNumbers)) continue

    parsed.push(buildDraw(row, round, mainNumbers, layout))
  }

  if (parsed.length === 0 && headerRowIndex > 0) {
    const altLayout = inferLayoutFromDataRows(jsonData, 0)
    if (altLayout) {
      for (let r = 0; r < jsonData.length; r++) {
        const row = jsonData[r]
        if (!row) continue
        const round = parseRoundCell(row[altLayout.roundCol])
        if (!Number.isFinite(round)) continue
        const mainNumbers = altLayout.numberCols.map((col) =>
          parseLotteryNumberCell(row[col]),
        )
        if (!isValidMainNumbers(mainNumbers)) continue
        parsed.push(buildDraw(row, round, mainNumbers, altLayout))
      }
    }
  }

  return parsed
}

/** 행에서 회차·본번호와 (있으면) 보너스·추첨일·1등 금액·1등 당첨자수를 조합한다. */
function buildDraw(
  row: ExcelRow,
  round: number,
  mainNumbers: number[],
  layout: ColumnLayout,
): LottoDraw {
  const draw: LottoDraw = {
    round,
    mainNumbers: [...mainNumbers].sort((a, b) => a - b),
  }

  if (layout.bonusCol != null) {
    const bonus = parseLotteryNumberCell(row[layout.bonusCol])
    if (Number.isFinite(bonus) && bonus >= 1 && bonus <= 45) {
      draw.bonusNumber = bonus
    }
  }
  if (layout.drawDateCol != null) {
    const date = parseDateCell(row[layout.drawDateCol])
    if (date) draw.drawDate = date
  }
  if (layout.firstPrizeAmountCol != null) {
    const amount = parsePositiveIntCell(row[layout.firstPrizeAmountCol])
    if (amount != null) draw.firstPrizeAmount = amount
  }
  if (layout.firstPrizeWinnerCountCol != null) {
    const count = parsePositiveIntCell(row[layout.firstPrizeWinnerCountCol])
    if (count != null) draw.firstPrizeWinnerCount = count
  }

  return draw
}

/** 동행복권 형식 엑셀에서 회차·본번호 6개 추출 (가장 많이 인식된 시트 사용) */
export async function parseLottoExcelFile(file: File): Promise<LottoDraw[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })

  let bestSheet: LottoDraw[] = []

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) continue
    const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
      header: 1,
      defval: null,
      raw: false,
    })
    const parsed = parseSheetRows(jsonData)
    if (parsed.length > bestSheet.length) {
      bestSheet = parsed
    }
  }

  const byRound = new Map<number, LottoDraw>()
  for (const draw of bestSheet) {
    byRound.set(draw.round, draw)
  }
  return sortDraws(Array.from(byRound.values()))
}

export function getMaxRoundFromDraws(draws: LottoDraw[]): number | null {
  if (draws.length === 0) return null
  return Math.max(...draws.map((d) => d.round))
}
