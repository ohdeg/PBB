import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { shiftDay } from './quickEntry';
import { todayIsoDate } from './utils/dietaMath';

export function useDietaRecordDate(zone?:string|null) {
  const [params,setParams]=useSearchParams();
  const [clock,setClock]=useState(()=>new Date());
  useEffect(()=>{
    const tick=()=>setClock(new Date());
    const timer=window.setInterval(tick,30000);
    window.addEventListener('focus',tick);
    return ()=>{window.clearInterval(timer);window.removeEventListener('focus',tick);};
  },[]);
  const today=todayIsoDate(clock,zone);
  const yesterday=shiftDay(today,-1);
  const requested=params.get('day');
  const parsed=new Date(requested+'T12:00:00Z');
  const valid=requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && Number.isFinite(parsed.getTime())
    && parsed.toISOString().slice(0,10)===requested && requested<=today;
  const day=requested==='yesterday'?yesterday:valid?requested:today;
  function select(value:string) {
    setParams(prev=>{
      const next=new URLSearchParams(prev);
      if(value===today) next.delete('day'); else next.set('day',value);
      return next;
    });
  }
  // Keep an in-progress activity draft attached to its original date across midnight.
  function pinSelectedDay() {
    if (requested===day) return;
    setParams(prev=>{
      const next=new URLSearchParams(prev);
      next.set('day',day);
      return next;
    },{replace:true});
  }
  return {day,today,yesterday,requested,select,pinSelectedDay};
}
