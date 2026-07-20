/** 로또 당첨금 실수령액 세금 기준 (원) */
export const LOTTO_TAX_FREE_LIMIT = 2_000_000
export const LOTTO_HIGH_BRACKET_LIMIT = 300_000_000
export const LOTTO_STANDARD_TAX_RATE = 0.22
export const LOTTO_EXCESS_TAX_RATE = 0.33

export type LottoPayoutTaxBracket = 'tax_free' | 'standard' | 'high'

export interface LottoPayoutTaxBreakdown {
  grossAmount: number
  taxAmount: number
  netAmount: number
  bracket: LottoPayoutTaxBracket
  bracketLabel: string
  standardTaxPortion: number
  excessTaxPortion: number
}

export const LOTTO_PAYOUT_TAX_RULES = [
  {
    range: '200만 원 이하',
    tax: '비과세 (0%)',
    note: '세금 없이 수령',
  },
  {
    range: '200만 원 초과 ~ 3억 원 이하',
    tax: '22%',
    note: '기타소득세 20% + 지방소득세 2%',
  },
  {
    range: '3억 원 초과',
    tax: '3억 원까지 22% + 초과분 33%',
    note: '초과분에만 33% 적용',
  },
] as const

function resolveBracket(grossAmount: number): {
  bracket: LottoPayoutTaxBracket
  bracketLabel: string
} {
  if (grossAmount <= LOTTO_TAX_FREE_LIMIT) {
    return { bracket: 'tax_free', bracketLabel: '200만 원 이하 (비과세)' }
  }
  if (grossAmount <= LOTTO_HIGH_BRACKET_LIMIT) {
    return {
      bracket: 'standard',
      bracketLabel: '200만 원 초과 ~ 3억 원 이하 (22%)',
    }
  }
  return {
    bracket: 'high',
    bracketLabel: '3억 원 초과 (22% + 초과분 33%)',
  }
}

/** 당첨금(세전)에 대한 실수령액 계산 */
export function calculateLottoPayoutTax(
  grossAmount: number,
): LottoPayoutTaxBreakdown | null {
  if (!Number.isFinite(grossAmount) || grossAmount < 0) return null

  const { bracket, bracketLabel } = resolveBracket(grossAmount)

  if (bracket === 'tax_free') {
    return {
      grossAmount,
      taxAmount: 0,
      netAmount: grossAmount,
      bracket,
      bracketLabel,
      standardTaxPortion: 0,
      excessTaxPortion: 0,
    }
  }

  if (bracket === 'standard') {
    const taxAmount = Math.floor(grossAmount * LOTTO_STANDARD_TAX_RATE)
    return {
      grossAmount,
      taxAmount,
      netAmount: grossAmount - taxAmount,
      bracket,
      bracketLabel,
      standardTaxPortion: taxAmount,
      excessTaxPortion: 0,
    }
  }

  const standardTaxPortion = Math.floor(
    LOTTO_HIGH_BRACKET_LIMIT * LOTTO_STANDARD_TAX_RATE,
  )
  const excessTaxPortion = Math.floor(
    (grossAmount - LOTTO_HIGH_BRACKET_LIMIT) * LOTTO_EXCESS_TAX_RATE,
  )
  const taxAmount = standardTaxPortion + excessTaxPortion

  return {
    grossAmount,
    taxAmount,
    netAmount: grossAmount - taxAmount,
    bracket,
    bracketLabel,
    standardTaxPortion,
    excessTaxPortion,
  }
}

export function parseWonAmountInput(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return null
  const parsed = Number(digits)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

export function formatWonAmount(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}
