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

function isValidMainNumbers(nums: number[]): boolean {
  if (nums.length !== 6) return false
  if (nums.some((n) => !Number.isFinite(n) || n < 1 || n > 45)) return false
  return new Set(nums).size === 6
}

interface ColumnLayout {
  roundCol: number
  numberCols: number[]
}

function detectColumnLayout(headerRow: ExcelRow): ColumnLayout | null {
  const headers = headerRow.map(normalizeHeader)

  let roundCol = headers.findIndex(
    (h) => h.includes('회차') || h === 'round',
  )
  if (roundCol === -1) roundCol = 0

  const bonusCol = headers.findIndex(
    (h) => h.includes('보너스') || h.includes('bonus'),
  )
  if (bonusCol >= 6) {
    return {
      roundCol,
      numberCols: Array.from({ length: 6 }, (_, i) => bonusCol - 6 + i),
    }
  }

  const byBallIndex: Array<number | undefined> = []
  headers.forEach((h, idx) => {
    const drwt = h.match(/^drwtno(\d)$/)
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
    return {
      roundCol,
      numberCols: byBallIndex as number[],
    }
  }

  const numericHeaderCols: number[] = []
  headers.forEach((h, idx) => {
    if (/^[1-6]$/.test(h)) numericHeaderCols.push(idx)
  })
  if (numericHeaderCols.length >= 6) {
    numericHeaderCols.sort((a, b) => a - b)
    return {
      roundCol,
      numberCols: numericHeaderCols.slice(0, 6),
    }
  }

  return null
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
  const headerRow = jsonData[headerRowIndex] || []

  let layout =
    detectColumnLayout(headerRow) ??
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

    parsed.push({
      round,
      mainNumbers: [...mainNumbers].sort((a, b) => a - b),
    })
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
        parsed.push({
          round,
          mainNumbers: [...mainNumbers].sort((a, b) => a - b),
        })
      }
    }
  }

  return parsed
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
