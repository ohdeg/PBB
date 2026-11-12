import { useDietaUserKey } from '../../features/dieta/useDietaUserKey';
import { useEffect, useState } from 'react';
import { dietaApi } from '../../api/dietaApi';
import { DIETA_MEAL_LABELS } from '../../features/dieta/types';
import type { RecordWeek, WeekMeal } from '../../features/dieta/quickEntry';

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
  const [expanded,setExpanded]=useState(false);
  const [opened,setOpened]=useState(false);
  return <section className="dieta-card"><h2>최근 7일 기록</h2>
    {summary?<><p>식사 {summary.mealDays}일 · 활동 {summary.activityDays}일 · 운동 {summary.workouts}회</p>
      {(summary.estimatedMealDays>0 || summary.estimatedActivityDays>0) && <p className="dieta-muted">추정만 있는 날 · 식사 {summary.estimatedMealDays}일 · 활동 {summary.estimatedActivityDays}일</p>}</>:
      failed?<button type="button" onClick={()=>setRetry(n=>n+1)}>주간 기록 다시 불러오기</button>:<p>기록 일수를 불러오는 중…</p>}
    <button type="button" className="dieta-link" aria-expanded={expanded}
      onClick={()=>{setOpened(true);setExpanded(v=>!v);}}>끼니별로 돌아보기</button>
    {opened && <div hidden={!expanded}><WeekDetails day={day} key={owner+':'+day}/></div>}
  </section>;
}

function WeekDetails({day}:{day:string}) {
  const [rows,setRows]=useState<WeekMeal[]|null>(null);
  const [failed,setFailed]=useState(false);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    setFailed(false);
    dietaApi.mealWeek(day).then(data=>{if(active)setRows(data);})
      .catch(()=>{if(active)setFailed(true);});
    return ()=>{active=false;};
  },[day,retry]);
  if (failed) return <p role="status">끼니별 기록을 불러오지 못했어요. <button type="button" onClick={()=>setRetry(v=>v+1)}>다시 시도</button></p>;
  if (!rows) return <p role="status">끼니별 기록을 불러오는 중…</p>;
  const recorded=rows.filter(r=>r.directDays+r.estimatedDays+r.mixedDays+r.skippedDays+r.unknownDays>0);
  if (!recorded.length) return <p className="dieta-muted">최근 7일 동안 남긴 끼니 기록이 없어요.</p>;
  return <dl className="dieta-week-meals">{recorded.map(r=>{
    const counts=[[r.directDays,'직접 입력'],[r.estimatedDays,'평균 입력'],[r.mixedDays,'직접·평균 함께'],
      [r.skippedDays,'건너뜀'],[r.unknownDays,'기억 안 남']] as const;
    return <div key={r.mealType}><dt>{DIETA_MEAL_LABELS[r.mealType]}</dt><dd>
      {counts.filter(([n])=>n>0).map(([n,label])=>label+' '+n+'일').join(' · ')}
      {r.trend && <p>분석 당시 평균 · 앞 3일 {r.trend.earlyAverage} kcal ({r.trend.earlyDays}일 기록) → 뒤 3일 {r.trend.lateAverage} kcal ({r.trend.lateDays}일 기록)</p>}
      {r.frequentFood && <p>자주 기록한 음식 · {r.frequentFood} ({r.foodDays}일)</p>}
    </dd></div>;
  })}</dl>;
}
