import type { TicketLine } from '../types/ticketImport'
export interface TicketReviewRow { line: TicketLine; values: string[]; selected: boolean; confirmed: boolean }
interface Props {
  round: string; rows: TicketReviewRow[]; disabled: boolean; results: Record<string,string>
  onRound: (value: string) => void; onRows: (rows: TicketReviewRow[]) => void
}
export function LottoTicketReview({round,rows,disabled,results,onRound,onRows}: Props) {
  const update=(line:TicketLine,patch:Partial<TicketReviewRow>)=>onRows(rows.map(row=>row.line===line?{...row,...patch}:row))
  return <section className="space-y-4" aria-label="인식한 번호 확인">
    <label className="block space-y-1 text-sm font-bold">회차
      <input name="ticketRound" aria-label="회차" inputMode="numeric" autoComplete="off" value={round} disabled={disabled} onChange={e=>onRound(e.target.value.replace(/\D/g,''))} className="lotto-ticket-input w-full" />
    </label>
    <p className="text-sm text-slate-500">사진과 비교해 번호를 확인한 뒤 확인 완료를 선택해 주세요. 읽지 못한 번호는 직접 입력할 수 있습니다.</p>
    {rows.map(row=><fieldset key={row.line} disabled={disabled} className="min-w-0 rounded-xl border border-slate-200 p-3">
      <legend className="px-1 text-sm font-bold">{row.line}줄</legend>
      <label className="mb-2 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={row.selected} onChange={e=>update(row.line,{selected:e.target.checked,confirmed:false})} className="h-5 w-5 accent-blue-600" />{row.line}줄 저장</label>
      <div className="grid grid-cols-6 gap-1.5">
        {row.values.map((value,i)=><input key={i} aria-label={`${row.line}줄 ${i+1}번째 번호`} name={`ticket-${row.line}-${i}`} inputMode="numeric" autoComplete="off" maxLength={2} value={value} onChange={e=>update(row.line,{values:row.values.map((v,j)=>i===j?e.target.value.replace(/\D/g,''):v),confirmed:false})} className="lotto-ticket-input w-full min-w-0 px-0 text-center tabular-nums" />)}
      </div>
      {results[row.line] && <p className="mt-2 text-sm font-bold lotto-ticket-result">{results[row.line]}</p>}
      <label className="mt-2 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={row.confirmed} disabled={!row.selected} onChange={e=>update(row.line,{confirmed:e.target.checked})} className="h-5 w-5 accent-blue-600" />{row.line}줄 확인 완료</label>
    </fieldset>)}
  </section>
}
