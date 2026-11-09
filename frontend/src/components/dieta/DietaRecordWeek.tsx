import { useDietaUserKey } from '../../features/dieta/useDietaUserKey';
import { useEffect, useState } from 'react';
import { dietaApi } from '../../api/dietaApi';
import type { RecordWeek } from '../../features/dieta/quickEntry';

export function DietaRecordWeek({day}:{day:string}) {
  const owner=useDietaUserKey();
  const [summary,setSummary]=useState<RecordWeek|null>(null);
  const [failed,setFailed]=useState(false);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    setFailed(false);setSummary(null);
    void (async()=>{
      try {const next=await dietaApi.recordWeek(day);if(active)setSummary(next);}
      catch {if(active)setFailed(true);}
    })();
    return ()=>{active=false;};
  },[day,retry,owner]);
  return <section className="dieta-card"><h2>최근 7일 기록</h2>
    {summary?<><p>식사 {summary.mealDays}일 · 활동 {summary.activityDays}일 · 운동 {summary.workouts}회</p>
      {(summary.estimatedMealDays>0 || summary.estimatedActivityDays>0) && <p className="dieta-muted">추정만 있는 날 · 식사 {summary.estimatedMealDays}일 · 활동 {summary.estimatedActivityDays}일</p>}</>:
      failed?<button type="button" onClick={()=>setRetry(n=>n+1)}>주간 기록 다시 불러오기</button>:<p>기록 일수를 불러오는 중…</p>}
  </section>;
}
