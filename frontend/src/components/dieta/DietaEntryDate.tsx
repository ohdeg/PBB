import { useSearchParams } from 'react-router-dom';

export function DietaEntryDate({offset,day,disabled}:{offset:number;day:string;disabled:boolean}) {
  const [,setParams] = useSearchParams();
  return <div className="dieta-chip-row" aria-label="기록 날짜">
    {[0,-1].map(value=><button type="button" key={value} disabled={disabled}
      className={'dieta-chip'+(offset===value?' is-active':'')} aria-pressed={offset===value}
      onClick={()=>setParams(prev=>{const next=new URLSearchParams(prev); if(value) next.set('day','yesterday'); else next.delete('day'); return next;})}>
      {value?'어제':'오늘'}</button>)}
    <time dateTime={day}>{day}</time>
  </div>;
}
