import { useEffect, useRef, useState } from 'react';
import { shiftDay } from '../../features/dieta/quickEntry';

const pretty = new Intl.DateTimeFormat('ko-KR', {year:'numeric',month:'long',day:'numeric',weekday:'short',timeZone:'UTC'});
const weekdays = ['일','월','화','수','목','금','토'];

export function DietaMealDate({day,today,onChange}:{day:string;today:string;onChange:(day:string)=>void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [month,setMonth] = useState(day.slice(0,7));
  const first = new Date(month+'-01T12:00:00Z');
  const days = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  function changeMonth(amount:number) {
    const next = new Date(first);
    next.setUTCMonth(next.getUTCMonth()+amount);
    setMonth(next.toISOString().slice(0,7));
  }
  function select(value:string) {
    dialog.current?.close();
    onChange(value);
  }
  useEffect(() => {
    if (dialog.current?.open) dialog.current.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  },[month]);
  return <>
    <nav aria-label="식사 기록 날짜" className="dieta-day-nav">
      <button type="button" aria-label="이전 날짜" onClick={()=>onChange(shiftDay(day,-1))}>‹</button>
      <button type="button" aria-haspopup="dialog" aria-label={day+' 날짜 선택'} onClick={()=>{
        setMonth(day.slice(0,7)); dialog.current?.showModal();
        dialog.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
      }}>{pretty.format(new Date(day+'T12:00:00Z'))} ▾</button>
      <button type="button" aria-label="다음 날짜" disabled={day>=today} onClick={()=>onChange(shiftDay(day,1))}>›</button>
    </nav>
    {day!==today && <button type="button" className="dieta-back-today dieta-link" onClick={()=>onChange(today)}>오늘로 돌아가기</button>}
    <dialog className="dieta-calendar dieta-card" ref={dialog} aria-label="식사 날짜 선택">
      <div className="dieta-day-nav">
        <button aria-label="이전 달" onClick={()=>changeMonth(-1)}>‹</button>
        <strong aria-live="polite">{first.getUTCFullYear()}년 {first.getUTCMonth()+1}월</strong>
        <button aria-label="다음 달" disabled={month>=today.slice(0,7)} onClick={()=>changeMonth(1)}>›</button>
      </div>
      <div className="dieta-calendar-grid">
        {weekdays.map(d=><span key={d}>{d}</span>)}
        {Array.from({length:first.getUTCDay()},(_,index)=><span key={'blank'+index}/>)}
        {Array.from({length:days},(_,i)=>{
          const value = month+'-'+String(i+1).padStart(2,'0');
          return <button key={value} aria-label={value} aria-current={value===today?'date':undefined}
            aria-pressed={value===day} disabled={value>today} onClick={()=>select(value)}>{i+1}</button>;
        })}
      </div>
      <div className="dieta-title-row">
        <button className="dieta-btn dieta-btn--soft" onClick={()=>select(today)}>오늘로</button>
        <button className="dieta-btn dieta-btn--ghost" onClick={()=>dialog.current?.close()}>닫기</button>
      </div>
    </dialog>
  </>;
}
