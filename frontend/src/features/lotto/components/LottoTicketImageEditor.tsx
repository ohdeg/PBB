import { useEffect, useRef, useState } from 'react'
import type { TicketCrop } from '../utils/prepareTicketImage'
interface Props {
  url: string; rotation: number; crop: TicketCrop; disabled: boolean
  onRotation: (value: number) => void; onCrop: (value: TicketCrop) => void
}
export function LottoTicketImageEditor({url,rotation,crop,disabled,onRotation,onCrop}: Props) {
  const canvas=useRef<HTMLCanvasElement>(null)
  const [error,setError]=useState('')
  useEffect(()=>{
    const target=canvas.current
    if(!target) return
    let disposed=false
    const image=new Image()
    image.onload=()=>{
      if(disposed) return
      const rotatedWidth=rotation%180?image.naturalHeight:image.naturalWidth
      const rotatedHeight=rotation%180?image.naturalWidth:image.naturalHeight
      const scale=Math.min(1,720/Math.max(rotatedWidth,rotatedHeight))
      target.width=Math.max(1,Math.round(rotatedWidth*scale));target.height=Math.max(1,Math.round(rotatedHeight*scale))
      const ctx=target.getContext('2d');if(!ctx)return
      ctx.translate(target.width/2,target.height/2);ctx.rotate(rotation*Math.PI/180)
      ctx.drawImage(image,-image.naturalWidth*scale/2,-image.naturalHeight*scale/2,image.naturalWidth*scale,image.naturalHeight*scale)
      setError('')
    }
    image.onerror=()=>{if(!disposed)setError('미리보기를 열지 못했습니다. 다른 사진을 선택해 주세요.')}
    image.src=url
    return ()=>{disposed=true;image.onload=null;image.onerror=null;target.width=0;target.height=0}
  },[url,rotation])
  return <section className="space-y-3" aria-label="용지 사진 편집">
    <div className="rounded-xl bg-slate-100 p-3">
      <div className="relative mx-auto w-fit max-w-full overflow-hidden">
        <canvas ref={canvas} role="img" aria-label="회전한 용지 사진과 인식 영역" className="block h-auto max-h-[28rem] max-w-full object-contain" />
        <div aria-hidden="true" className="pointer-events-none absolute border-2 border-blue-500" style={{left:`${crop.left}%`,top:`${crop.top}%`,right:`${100-crop.right}%`,bottom:`${100-crop.bottom}%`,boxShadow:'0 0 0 1000px rgb(15 23 42 / 35%)'}}/>
      </div>
    </div>
    {error&&<p role="alert" className="text-sm lotto-ticket-error">{error}</p>}
    <button type="button" className="lotto-ticket-secondary" disabled={disabled} onClick={()=>onRotation((rotation+90)%360)}>사진 90도 회전</button>
    <details>
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold">인식 영역 조정</summary>
      <p className="mb-2 text-xs text-slate-500">회차와 번호를 포함해 파란 영역을 조정해 주세요. 슬라이더는 키보드로도 조정할 수 있습니다.</p>
      {(Object.keys(crop) as (keyof TicketCrop)[]).map(key=><label key={key} className="grid grid-cols-[4rem_1fr_3rem] items-center gap-2 text-sm">
        <span>{{left:'왼쪽',top:'위쪽',right:'오른쪽',bottom:'아래쪽'}[key]}</span>
        <input type="range" min="0" max="100" value={crop[key]} disabled={disabled} onChange={e=>onCrop({...crop,[key]:Number(e.target.value)})} className="min-h-11 min-w-0 accent-blue-600" />
        <span className="tabular-nums">{crop[key]}%</span>
      </label>)}
      <button type="button" className="lotto-ticket-secondary mt-2" disabled={disabled} onClick={()=>onCrop({left:0,top:0,right:100,bottom:100})}>전체 사진 사용</button>
    </details>
  </section>
}
