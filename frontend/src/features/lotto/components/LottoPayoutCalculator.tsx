import { useEffect, useMemo, useRef, useState } from 'react'
import type { LottoDraw } from '../../../types/lotto'
import {
  calculateLottoPayoutTax,
  formatWonAmount,
  LOTTO_PAYOUT_TAX_RULES,
  parseWonAmountInput,
} from '../utils/lottoPayoutTax'

interface LottoPayoutCalculatorProps {
  latestDraw: LottoDraw | null
}

export default function LottoPayoutCalculator({
  latestDraw,
}: LottoPayoutCalculatorProps) {
  const [grossInput, setGrossInput] = useState('')
  const hasUserEditedRef = useRef(false)

  const grossAmount = useMemo(() => parseWonAmountInput(grossInput), [grossInput])

  const breakdown = useMemo(() => {
    if (grossAmount == null || grossAmount === 0) return null
    return calculateLottoPayoutTax(grossAmount)
  }, [grossAmount])

  useEffect(() => {
    const amount = latestDraw?.firstPrizeAmount
    if (amount == null || amount <= 0) return
    if (hasUserEditedRef.current) return
    setGrossInput(amount.toLocaleString('ko-KR'))
  }, [latestDraw?.round, latestDraw?.firstPrizeAmount])

  const handleGrossChange = (value: string) => {
    hasUserEditedRef.current = true
    const parsed = parseWonAmountInput(value)
    if (parsed == null) {
      setGrossInput('')
      return
    }
    setGrossInput(parsed.toLocaleString('ko-KR'))
  }

  const autoFilled =
    latestDraw?.firstPrizeAmount != null &&
    latestDraw.firstPrizeAmount > 0 &&
    grossAmount === latestDraw.firstPrizeAmount

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
          당첨금 실수령 계산기
        </h2>
        <p className="mt-1 text-[11px] font-bold text-slate-500">
          1인당 당첨금(세전)을 입력하면 세후 실수령액을 계산합니다.
        </p>

        {autoFilled && latestDraw && (
          <p className="mt-3 rounded-xl bg-indigo-50 px-3 py-2 text-[11px] font-bold text-indigo-800">
            최신 {latestDraw.round}회 1등 당첨금(
            {formatWonAmount(latestDraw.firstPrizeAmount!)})이 자동 입력되었습니다.
          </p>
        )}

        <label className="mt-5 flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
            당첨금 (세전, 원)
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={grossInput}
            onChange={(e) => handleGrossChange(e.target.value)}
            placeholder="예: 2,000,000,000"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-900 placeholder:font-bold placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </label>
      </div>

      {breakdown && (
        <div className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4 shadow-sm sm:p-6">
          <p className="mb-1 text-center text-[10px] font-black uppercase tracking-wider text-violet-700">
            실수령액
          </p>
          <p className="mb-4 text-center text-3xl font-black text-violet-900">
            {formatWonAmount(breakdown.netAmount)}
          </p>

          <div className="mb-4 rounded-2xl bg-white/70 p-4 ring-1 ring-violet-100">
            <p className="mb-2 text-center text-[10px] font-bold text-slate-500">
              적용 구간
            </p>
            <p className="text-center text-xs font-black text-slate-800">
              {breakdown.bracketLabel}
            </p>
          </div>

          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="font-bold text-slate-600">당첨금 (세전)</dt>
              <dd className="font-black text-slate-900">
                {formatWonAmount(breakdown.grossAmount)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="font-bold text-slate-600">세금</dt>
              <dd className="font-black text-rose-600">
                -{formatWonAmount(breakdown.taxAmount)}
              </dd>
            </div>
            {breakdown.bracket === 'high' && (
              <>
                <div className="flex items-center justify-between gap-3 pl-3 text-[12px]">
                  <dt className="font-bold text-slate-500">
                    3억 원까지 22% 세금
                  </dt>
                  <dd className="font-bold text-slate-600">
                    {formatWonAmount(breakdown.standardTaxPortion)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 pl-3 text-[12px]">
                  <dt className="font-bold text-slate-500">초과분 33% 세금</dt>
                  <dd className="font-bold text-slate-600">
                    {formatWonAmount(breakdown.excessTaxPortion)}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-700">
          로또 실수령액 계산 기준
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[280px] text-left text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-2 pr-3 font-black">당첨금 구간</th>
                <th className="pb-2 pr-3 font-black">세금 적용</th>
                <th className="pb-2 font-black">비고</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {LOTTO_PAYOUT_TAX_RULES.map((rule) => (
                <tr key={rule.range} className="border-b border-slate-100">
                  <td className="py-2.5 pr-3 font-bold">{rule.range}</td>
                  <td className="py-2.5 pr-3 font-bold text-violet-700">
                    {rule.tax}
                  </td>
                  <td className="py-2.5 font-medium text-slate-500">
                    {rule.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[10px] font-bold leading-relaxed text-slate-400">
          참고용 계산기이며, 실제 원천징수·신고 기준과 차이가 있을 수 있습니다.
          정확한 세액은 동행복권·세무 전문가 안내를 확인해 주세요.
        </p>
      </div>
    </section>
  )
}
