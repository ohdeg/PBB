import { useEffect, useId, useRef, useState } from 'react'
import type { LottoDraw, LottoHistoryItem } from '../../../types/lotto'
import type { ConfirmedTicket, TicketLine } from '../types/ticketImport'
import { TICKET_LINES } from '../types/ticketImport'
import { useLottoTicketImport } from '../hooks/useLottoTicketImport'
import { allocateLottoHistoryIds } from '../utils/lottoHistoryIds'
import { settleLottoHistory, type LottoHistoryTab } from '../utils/lottoHistory'
import { buildTicketHistoryItems, duplicateTicketLines, previewTicketImport, validateTicket } from '../utils/ticketImport'
import { LottoTicketImageEditor } from './LottoTicketImageEditor'
import { LottoTicketReview, type TicketReviewRow } from './LottoTicketReview'

interface Props {
  owner: string | null; draws: LottoDraw[]; latestRound: number; drawsReady: boolean
  ready: boolean; history: LottoHistoryItem[]
  onSave: (items: LottoHistoryItem[], options: { operationId: string; expectedOwner: string | null }) => Promise<'saved' | 'local'>
  onClose: () => void; onComplete: (tab: LottoHistoryTab) => void
}
const emptyRow = (line: TicketLine): TicketReviewRow => ({line,values:Array(6).fill(''),selected:true,confirmed:false})
export function LottoTicketImportDialog(props: Props) {
  const image=useLottoTicketImport()
  const [round,setRound]=useState('')
  const [rows,setRows]=useState<TicketReviewRow[]>([])
  const [message,setMessage]=useState('')
  const [allowDuplicate,setAllowDuplicate]=useState(false)
  const [saving,setSaving]=useState(false)
  const [failed,setFailed]=useState(false)
  const confirmation=useRef('')
  const dialog=useRef<HTMLDialogElement>(null)
  const camera=useRef<HTMLInputElement>(null)
  const album=useRef<HTMLInputElement>(null)
  const committed=useRef<{items:LottoHistoryItem[];operationId:string;tab:LottoHistoryTab}|null>(null)
  const mounted=useRef(true)
  const locked=useRef(false)
  const id=useId()
  const ticket:ConfirmedTicket={targetRound:Number(round),rows:rows.filter(r=>r.selected).map(r=>({line:r.line,numbers:r.values.map(v=>v===''?NaN:Number(v))}))}
  const invalid=validateTicket(ticket,props.latestRound)
  const preview=previewTicketImport(ticket,props.draws)
  const duplicates=invalid?[]:duplicateTicketLines(ticket,props.history)
  const selected=rows.filter(r=>r.selected)
  const allConfirmed=selected.length>0 && selected.every(r=>r.confirmed)
  const frozen=Boolean(committed.current)
  const results:Record<string,string>={}
  if(!invalid) {
    const original=buildTicketHistoryItems(ticket,ticket.rows.map((_,i)=>i+1),'')
    const settled=settleLottoHistory(original,props.draws)
    for(const item of original) {
      const result=settled.find(i=>i.id===item.id)
      results[item.ticketLine!]=!result?'미당첨 · 보관되지 않음':result.status==='won'?`당첨 · ${result.prizeRank}등`:'결과 확인 대기'
    }
  }
  useEffect(()=>{
    mounted.current=true
    const element=dialog.current
    const previous=document.activeElement as HTMLElement|null
    if(element && !element.open) {
      if(typeof element.showModal==='function') element.showModal()
      else element.setAttribute('open','')
    }
    return ()=>{ mounted.current=false; if(element?.open && typeof element.close==='function') element.close();previous?.focus() }
  },[])
  useEffect(()=>{
    if(!rows.length) return
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''}
    window.addEventListener('beforeunload',warn)
    return ()=>window.removeEventListener('beforeunload',warn)
  },[rows.length])
  const changeRows=(next:TicketReviewRow[])=>{
    setRows(next);setMessage('');setAllowDuplicate(false)
    confirmation.current=previewTicketImport({...ticket,rows:next.filter(r=>r.selected).map(r=>({line:r.line,numbers:r.values.map(Number)}))},props.draws).fingerprint
  }
  const direct=()=>{image.cancel();setRows([emptyRow('A')]);setRound('');setMessage('');setAllowDuplicate(false)}
  const selectFile=(file:File|undefined)=>{
    if(file && image.select(file)) {setRows([]);setRound('');setMessage('');setAllowDuplicate(false)}
  }
  const read=async()=>{
    const draft=await image.recognize()
    if(!draft || !mounted.current) return
    setRound(draft.detectedRound?String(draft.detectedRound):'')
    setRows(draft.rows.length?draft.rows.map(r=>({line:r.line,values:r.values.map(n=>n===null?'':String(n)),selected:!r.needsReview,confirmed:false})):[emptyRow('A')])
    setMessage(draft.warnings.join(' '));setAllowDuplicate(false)
  }
  const close=()=>{
    if(saving) return
    if(rows.some(r=>r.values.some(Boolean)) && !window.confirm('용지 등록을 닫으시겠습니까? 확인 중인 사진과 입력은 삭제됩니다. 이미 추가된 미저장 내역은 내 번호에서 재시도할 수 있습니다.')) return
    props.onClose()
  }
  const submit=async()=>{
    if(locked.current) return
    if(!committed.current) {
      if(invalid || !allConfirmed || !props.ready || !props.drawsReady || (duplicates.length>0&&!allowDuplicate)) {setMessage(invalid||'회차와 선택한 줄을 확인해 주세요.');return}
      if(confirmation.current!==preview.fingerprint) {
        setRows(rows.map(r=>({...r,confirmed:false})));setMessage('추첨 결과가 갱신되었습니다. 표시된 결과를 다시 확인해 주세요.');return
      }
      if(preview.waiting+preview.won===0) return
      const ids=allocateLottoHistoryIds(ticket.rows.length,props.history.map(i=>i.id))
      committed.current={items:buildTicketHistoryItems(ticket,ids,new Date().toISOString()),operationId:crypto.randomUUID(),tab:preview.waiting?'pending':'won'}
    }
    const operation=committed.current
    locked.current=true;setSaving(true);setMessage('')
    try {
      await props.onSave(operation.items,{operationId:operation.operationId,expectedOwner:props.owner})
      if(mounted.current) {image.clearImage();props.onComplete(operation.tab)}
    } catch {
      if(mounted.current) {setFailed(true);setMessage('아직 저장되지 않았습니다. 연결 상태를 확인하고 저장을 다시 시도해 주세요. 입력 내용은 유지됩니다.')}
    } finally {locked.current=false;if(mounted.current)setSaving(false)}
  }
  const disabledSave=saving || (!frozen && (Boolean(invalid)||!allConfirmed||!props.ready||!props.drawsReady||preview.waiting+preview.won===0||(duplicates.length>0&&!allowDuplicate)))
  return <dialog ref={dialog} aria-labelledby={`${id}-title`} onCancel={e=>{e.preventDefault();close()}} className="lotto-ticket-dialog w-[calc(100%-1rem)] max-w-4xl rounded-2xl bg-white p-0 text-slate-900 shadow-xl">
    <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
      <div><h2 id={`${id}-title`} className="text-xl font-bold">용지 등록</h2><p className="mt-1 text-sm text-slate-500">사진에서 읽은 회차와 번호를 확인해 저장하세요.</p></div>
      <button type="button" onClick={close} disabled={saving} className="lotto-ticket-secondary shrink-0">닫기</button>
    </div>
    <div className="space-y-4 p-4 sm:p-6">
      <p className="text-sm text-slate-500">사진은 기기에서만 인식하며 서버에 전송하거나 보관하지 않습니다.</p>
      {!props.owner && <p className="lotto-ticket-guest rounded-xl p-3 text-sm">비로그인 번호는 이 화면에서만 유지되며 새로고침하면 사라집니다.</p>}
      <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="용지 사진 촬영" className="hidden" onChange={e=>{selectFile(e.target.files?.[0]);e.target.value=''}} />
      <input ref={album} type="file" accept="image/jpeg,image/png,image/webp" aria-label="용지 사진 선택" className="hidden" onChange={e=>{selectFile(e.target.files?.[0]);e.target.value=''}} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="lotto-ticket-secondary" disabled={saving||frozen||image.busy} onClick={()=>camera.current?.click()}>사진 촬영</button>
        <button type="button" className="lotto-ticket-secondary" disabled={saving||frozen||image.busy} onClick={()=>album.current?.click()}>사진 선택</button>
        <button type="button" className="lotto-ticket-secondary" disabled={saving||frozen||image.busy} onClick={direct}>직접 입력</button>
      </div>
      {!rows.length && !image.previewUrl && <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm leading-7 text-slate-500">회차와 A~E 번호가 모두 보이도록<br/>용지를 펴서 정면에서 촬영해 주세요.<br/>JPEG · PNG · WebP / 최대 15MB</div>}
      <div className={`grid min-w-0 gap-6 ${image.previewUrl&&rows.length?'md:grid-cols-2':''}`}>
        {image.previewUrl && <div className="min-w-0 space-y-3"><LottoTicketImageEditor url={image.previewUrl} rotation={image.rotation} crop={image.crop} disabled={image.busy||frozen} onRotation={image.setRotation} onCrop={image.setCrop}/>
          {!frozen && <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>void read()} disabled={image.busy} className="lotto-ticket-primary">{rows.length?'다시 인식':'번호 인식'}</button>{image.busy&&<button type="button" onClick={image.cancel} className="lotto-ticket-secondary">인식 취소</button>}</div>}
        </div>}
        {rows.length>0 && <div className="min-w-0 space-y-3"><LottoTicketReview round={round} rows={rows} disabled={saving||frozen||image.busy} results={results} onRound={value=>{setRound(value);setRows(rows.map(r=>({...r,confirmed:false})));setAllowDuplicate(false);setMessage('')}} onRows={changeRows}/>
          {rows.length<5&&!frozen&&<button type="button" className="lotto-ticket-secondary" disabled={image.busy} onClick={()=>changeRows([...rows,emptyRow(TICKET_LINES.find(line=>!rows.some(r=>r.line===line))!)])}>번호 줄 추가</button>}
          {Boolean(invalid)&&<p className="text-sm text-slate-500">{invalid}</p>}
        </div>}
      </div>
      {image.busy&&<p role="status" className="text-sm font-bold">{image.progress}</p>}
      {image.error&&<p role="alert" className="text-sm lotto-ticket-error">{image.error}</p>}
      {rows.length>0 && <>
        {preview.won+preview.discarded>0&&<p className="lotto-ticket-info rounded-xl p-3 text-sm">추첨이 끝난 회차입니다. 당첨 번호만 보관되며 미당첨 번호는 저장되지 않습니다.</p>}
        {!invalid&&preview.waiting+preview.won===0&&<p className="text-sm text-slate-500">선택한 번호는 미당첨으로 보관되지 않습니다.</p>}
        {!frozen&&duplicates.length>0&&<label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={allowDuplicate} onChange={e=>setAllowDuplicate(e.target.checked)} className="h-5 w-5 shrink-0"/>같은 번호가 이미 있습니다. 별도 용지로 중복 저장합니다.</label>}
        {(!props.drawsReady||!props.ready)&&<p role="status" className="text-sm text-slate-500">회차와 저장 내역을 불러온 뒤 등록할 수 있습니다. 페이지의 다시 시도를 이용해 주세요.</p>}
        <p role="status" aria-live="polite" className="text-sm lotto-ticket-error">{message}</p>
        <button type="button" onClick={()=>void submit()} disabled={disabledSave} className="lotto-ticket-primary w-full">{saving?'저장 중…':failed?'저장 다시 시도':'확인한 번호 저장'}</button>
      </>}
    </div>
  </dialog>
}
