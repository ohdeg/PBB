import { DietaQuickMeals } from '../components/dieta/DietaQuickMeals';
import { DietaMealDate } from '../components/dieta/DietaMealDate';
import { DietaMealDetails } from '../components/dieta/DietaMealDetails';
import { toast } from '../stores/toastStore';
import { shiftDay, type MealDayDetails } from '../features/dieta/quickEntry';
import { DietaLoadState } from '../components/dieta/DietaLoadState';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, Link, Navigate } from 'react-router-dom';
import { dietaApi } from '../api/dietaApi';
import { DietaRecipeLibraryModal } from '../components/dieta/DietaRecipeLibraryModal';
import type {

  DietaMealQueueDay,
  DietaMealType,
  DietaProfile,
  DietaRecipe,
  DietaRecipeAnalyzeResult,
} from '../features/dieta/types';
import { DIETA_MEAL_LABELS } from '../features/dieta/types';
import { useDietaUserKey } from '../features/dieta/useDietaUserKey';
import { todayIsoDate } from '../features/dieta/utils/dietaMath';
import { useAuthStore } from '../stores/authStore';

import { suggestMeal } from '../features/dieta/suggestMeal';

export function DietaMealsPage() {
  const owner = useDietaUserKey();
  return <MealHistory key={owner} />;
}

type Stage = 'MAIN'|'SUPPLEMENT';
function MealHistory() {
  const userKey = useDietaUserKey();
  const accessToken = useAuthStore(s => s.accessToken);
  const [params,setParams] = useSearchParams();
  const requested = params.get('day');
  const [profile,setProfile] = useState<DietaProfile|null|undefined>(undefined);
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  const [clock,setClock] = useState(()=>new Date());
  const legacyAuto = useRef(requested === null);
  const pendingDays = useRef(new Map<string,Stage>());
  const ownerActive = useRef(true);
  useEffect(()=>{
    ownerActive.current=true;
    return ()=>{ownerActive.current=false;};
  },[]);
  const notified = useRef(new Set<string>());
  const notify = useCallback((day:string,stage:Stage)=>{
    const key = day+stage;
    if (!ownerActive.current || notified.current.has(key)) return;
    notified.current.add(key);
    toast(day+' '+(stage==='SUPPLEMENT'?'추가 분석':'식사 분석')+'이 완료됐어요.', 'analysis');
  },[]);
  const observe = useCallback((result:MealDayDetails)=>{
    const observed = pendingDays.current.get(result.day);
    if (observed && result.completedStage===observed) notify(result.day,observed);
    if (result.queue.status==='pending') pendingDays.current.set(result.day,result.completedStage?'SUPPLEMENT':'MAIN');
    else pendingDays.current.delete(result.day);
  },[notify]);
  useEffect(()=>{
    if (!accessToken) return;
    let active = true;
    setError('');
    dietaApi.getProfile(userKey).then(p=>{if(active)setProfile(p);})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'프로필 조회에 실패했어요.');});
    return ()=>{active=false;};
  },[accessToken,userKey,retry]);
  useEffect(()=>{
    const tick = ()=>setClock(new Date());
    const timer = window.setInterval(tick,30000);
    window.addEventListener('focus',tick);
    return ()=>{window.clearInterval(timer);window.removeEventListener('focus',tick);};
  },[]);
  const zone = profile?.mealSchedule?.enabled ? profile.mealSchedule.zone : undefined;
  const today = todayIsoDate(clock,zone);
  useEffect(()=>{
    let active = true;
    let checking = false;
    const check = async ()=>{
      if (checking || document.visibilityState!=='visible') return;
      checking = true;
      try {
        for (const [day,stage] of Array.from(pendingDays.current)) {
          const selected = requested==='yesterday'?shiftDay(today,-1):requested||today;
          if (day===selected) continue;
          try {
            const result = await dietaApi.mealDay(day);
            if (!active) return;
            if (result.completedStage===stage) notify(day,stage);
            observe(result);
          } catch { /* retry the read on the next visible poll */ }
        }
      } finally { checking=false; }
    };
    const timer=window.setInterval(()=>void check(),5000);
    return ()=>{active=false;window.clearInterval(timer);};
  },[requested,today,notify,observe]);
  if (!accessToken) return <Navigate to="/login" replace state={{from:'/hobbies/dieta/meals'}}/>;
  if (profile===undefined || error) return <DietaLoadState error={error} onRetry={()=>setRetry(n=>n+1)}/>;
  if (!profile?.onboardingComplete) return <Navigate to="/hobbies/dieta/onboarding" replace/>;
  const yesterday = shiftDay(today,-1);
  const parsed = new Date(requested+'T12:00:00Z');
  const validDate = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && Number.isFinite(parsed.getTime())
    && parsed.toISOString().slice(0,10)===requested && requested<=today;
  const day = requested==='yesterday'?yesterday:validDate?requested:today;
  return <>
    <h1>식사</h1>
    <DietaMealDate day={day} today={today} onChange={value=>setParams(prev=>{
      const next=new URLSearchParams(prev);
      if(value===today) next.delete('day'); else next.set('day',value);
      return next;
    })}/>
    <DayPage key={day} day={day} profile={profile} offset={day===today?0:day===yesterday?-1:-2}
      notify={notify} observe={observe} legacyAuto={legacyAuto}/>
  </>;
}

function DayPage({day,profile,offset,notify,observe,legacyAuto}:{
  day:string;profile:DietaProfile;offset:number;notify:(day:string,stage:Stage)=>void;observe:(result:MealDayDetails)=>void;legacyAuto:{current:boolean};
}) {
  const label = offset===0?'오늘':'어제';
  const editable = offset>=-1;
  const userKey = useDietaUserKey();
  const [selection,setSelection] = useState<DietaMealType|null>(null);
  const [drafts,setDrafts] = useState<Partial<Record<DietaMealType,string>>>({});
  const [details,setDetails] = useState<MealDayDetails|null>(null);
  const queue = details?.queue;
  const [needsRefresh,setNeedsRefresh] = useState(false);
  const lastStage = useRef<Stage|null|undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [yesterdayRetry, setYesterdayRetry] = useState<string | null>(null);

  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);
  useEffect(()=>{
    mounted.current=true;
    return ()=>{mounted.current=false;};
  },[]);
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    if (!mounted.current) return;
    const request = ++revision.current;
    const result = await dietaApi.mealDay(day);
    if (!mounted.current || request !== revision.current) return;
    if (lastStage.current!==undefined && result.completedStage && result.completedStage!==lastStage.current)
      notify(day,result.completedStage);
    observe(result);
    lastStage.current = result.completedStage;
    const recorded = [...result.queue.items.map(i=>i.mealType),...result.foods.map(f=>f.mealType ?? ''),...Object.keys(result.mealTotals)];
    const zone = profile.mealSchedule?.enabled ? profile.mealSchedule.zone : undefined;
    setSelection(current=>current ?? suggestMeal(new Date(),zone ?? undefined,offset===0,recorded));
    setDetails(result);
    setNeedsRefresh(false);
    setYesterdayRetry(result.queue.retryableYesterday ?? null);
    setLoaded(true);
    setLoadError('');
  },[day,notify,observe,profile,offset]);

  const loadLibraryRecipes = useCallback(async (): Promise<DietaRecipe[]> => {
    return dietaApi.listRecipes(undefined, userKey);
  }, [userKey]);

  useEffect(()=>{
    let active = true;
    const load = ()=>refresh().catch(e=>{if(active)setLoadError(e instanceof Error?e.message:'기록을 불러오지 못했어요.');});
    void load();
    if (offset===0 && legacyAuto.current) {
      legacyAuto.current=false;
      void dietaApi.autoFinalizeYesterday(userKey).then(result=>{
        if (result) { notify(result.intake.loggedOn,'MAIN'); if(active) void load(); }
      }).catch(e=>{if(active)setMsg(e instanceof Error?e.message:'어제 분석에 실패했어요.');});
    }
    return ()=>{active=false;};
  },[day,offset,userKey,refresh,retry,legacyAuto,notify]);

  useEffect(()=>{
    if (!editable || !loaded) return;
    let active = true;
    const reload = ()=>{
      if (document.visibilityState==='visible') void refresh().catch(()=>{
        if(active)setMsg('분석 상태를 확인하지 못했어요. 새로고침해 주세요.');
      });
    };
    window.addEventListener('focus',reload);
    const timer=window.setInterval(reload,queue?.status==='pending'?5000:60000);
    return ()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',reload);};
  },[editable,loaded,queue?.status,refresh]);

  if (!loaded || loadError || !details || !selection) return <DietaLoadState error={loadError} onRetry={()=>setRetry(n=>n+1)} />;
  if (!editable) return <DietaMealDetails details={details}/>;

  const mealType = selection;
  const text = drafts[mealType] ?? '';
  const setText = (value:string)=>setDrafts(prev=>({...prev,[mealType]:value}));
  const applyQueue = (next:DietaMealQueueDay) => {
    revision.current++;
    setDetails(prev=>prev ? {...prev,queue:next} : prev);
  };
  const refreshSaved = async () => {
    try { await refresh(); }
    catch { if (mounted.current) setNeedsRefresh(true); }
  };
  const addItem = async () => {
    if (day < shiftDay(todayIsoDate(new Date(),profile.mealSchedule?.enabled?profile.mealSchedule.zone:undefined),-1)) {setMsg('날짜가 바뀌었어요. 표시된 날짜를 확인하고 화면을 다시 열어 주세요.');return;}
    if (!text.trim()) {
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const next = await dietaApi.addMealQueueItem(
        { loggedOn: day, mealType, text },
        userKey,
      );
      applyQueue(next);
      setText('');
      await refreshSaved();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : '추가에 실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    setBusy(true);
    try {
      const next = await dietaApi.removeMealQueueItem(
        { loggedOn: day, itemId },
        userKey,
      );
      applyQueue(next);
      await refreshSaved();
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : '삭제하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const finalize = async () => {
    setBusy(true);
    setMsg('');
    try {
      const { queue: q } = await dietaApi.finalizeMealDay(day, userKey, queue?.availableStage ?? 'MAIN');
      applyQueue(q);
      notify(day,queue?.availableStage==='SUPPLEMENT'?'SUPPLEMENT':'MAIN');
      await refreshSaved();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : '분석에 실패했어요.');
      try { if (mounted.current) await refresh(); } catch { /* retain current input */ }
    } finally {
      setBusy(false);
    }
  };

  const analyzeRecipe = async (input: {
    title: string;
    ingredients: string[];
    steps: string | null;
    servings: number;
  }): Promise<DietaRecipeAnalyzeResult | null> => {
    setBusy(true);
    setMsg('');
    try {
      const analyzed = await dietaApi.analyzeRecipe(
        {
          loggedOn: day,
          title: input.title,
          ingredients: input.ingredients,
          steps: input.steps,
          servings: input.servings,
        },
        userKey,
      );

      if (mounted.current) toast(
        `레시피 「${input.title}」 분석 · 1인분 ${analyzed.kcal}kcal (${input.servings}인분 분량)`, 'analysis',
      );
      await refreshSaved();
      return analyzed;
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : '레시피 분석에 실패했어요.');
      throw e instanceof Error ? e : new Error('레시피 분석에 실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  const addLibraryRecipe = async (input: {
    recipeId: string;
    mealType: DietaMealType;
  }): Promise<DietaRecipeAnalyzeResult> => {
    setBusy(true);
    setMsg('');
    try {
      const result = await dietaApi.addRecipeToDay(
        {
          recipeId: input.recipeId,
          loggedOn: day,
          mealType: input.mealType,
        },
        userKey,
      );

      setMsg(`레시피를 선택한 날 섭취에 더했어요 · ${result.kcal}kcal`);
      await refreshSaved();
      return result;
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : '레시피를 선택한 날 섭취에 더하지 못했어요.';
      setMsg(message);
      throw e instanceof Error ? e : new Error(message);
    } finally {
      setBusy(false);
    }
  };

  const supplement = queue?.availableStage === 'SUPPLEMENT';
  const exhausted = queue?.status === 'exhausted';
  const closed = exhausted || (queue?.status === 'done' && !supplement);
  const pending = queue?.status === 'pending';

  const editor = <>
        <div className="dieta-field">
          <label htmlFor="dieta-meal-line">{label} 먹은 것</label>
          <input
            id="dieta-meal-line"
            value={text}
            disabled={(closed && queue?.availableStage === undefined) || pending || busy}
            onChange={(e) => setText(e.target.value)}
            name="meal" autoComplete="off" placeholder="예: 닭가슴살 150g…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                void addItem();
              }
            }}
          />
        </div>
        <button
          type="button"
          className="dieta-btn dieta-btn--soft dieta-btn--block"
          disabled={(closed && queue?.availableStage === undefined) || pending || busy || !text.trim()}
          onClick={() => void addItem()}
        >
          {closed ? "분석 없이 기록만 저장" : DIETA_MEAL_LABELS[mealType]+"에 추가"}
        </button>
        <details className="dieta-import"><summary>불러오기 · 식사 저장</summary>
          <DietaQuickMeals key={mealType} offset={offset} day={day} mealType={mealType} refresh={refreshSaved}
            canSave={details.foods.some(row=>row.mealType===mealType && row.source!=='average') || !!queue?.items.some(i=>i.mealType===mealType)}
            disabled={busy || pending}/>
        </details>
      </>;
  return (
    <>
      <DietaMealDetails details={details} library={<button type="button" className="dieta-link" disabled={busy}
        onClick={()=>setLibraryOpen(true)}>저장한 음식</button>} editor={{
        selected:mealType,select:setSelection,remove:id=>void removeItem(id),busy:busy || pending,
        canRemove:id=>id.startsWith('note:') || !closed && !id.startsWith('base:'),content:editor
      }}/>
      {needsRefresh && <p role="status" className="dieta-notice">기록은 저장됐어요. 최신 합계를 다시 불러와 주세요.{' '}
        <button type="button" className="dieta-link" onClick={()=>void refreshSaved()}>다시 조회</button></p>}
      <section className="dieta-analysis-footer">
        <p className="dieta-muted">{exhausted ? '전송한 분석이 완료되지 않았어요. 이날의 분석 기회를 사용했어요.' : closed ? '이날 분석이 끝났어요.' : pending ? '영양 정보를 분석하고 있어요.' : supplement ? '새로 먹은 음식을 모두 추가한 뒤 한 번 더 분석할 수 있어요.' : '하루 한 번 분석하고, 음식을 더 기록하면 한 번 더 분석할 수 있어요.'}</p>
        {profile.mealSchedule?.enabled && !closed && !pending && <p className="dieta-muted">
          {supplement ? '메인 분석이 끝났어요. 추가 분석은 직접 실행해 주세요.' : `매일 ${profile.mealSchedule.time} (${profile.mealSchedule.zone})에 분석해요.`}
        </p>}
        {!closed ? (
          <button
            type="button"
            className="dieta-btn dieta-btn--primary dieta-btn--block"
            disabled={busy || pending || !queue?.items.length || (supplement && !queue.newItemCount) || !profile?.geminiMealConsent}
            onClick={() => void finalize()}
          >
            {busy || pending ? '분석 중…' : supplement ? '추가 음식 포함해 다시 분석 (마지막 1회)' : queue?.status === 'failed' ? '분석 다시 시도' : `${label} 기록 확정하고 분석`}
          </button>
        ) : null}
        {!profile?.geminiMealConsent ? (
          <p className="dieta-muted" style={{ marginTop: '0.55rem' }}>
            분석에는 AI 동의가 필요해요.{' '}
            <Link className="dieta-link" to="/hobbies/dieta/settings">
              설정
            </Link>
          </p>
        ) : null}
      </section>

      {msg ? <p role="status" className="dieta-muted">{msg}</p> : null}
      {yesterdayRetry ? <button type="button" className="dieta-btn dieta-btn--soft" disabled={busy}
        onClick={() => { void (async () => {
          setBusy(true);
          try {
            await dietaApi.finalizeMealDay(yesterdayRetry, userKey);
            setYesterdayRetry(null);
            notify(yesterdayRetry,'MAIN');
            await refresh();
          } catch (error: unknown) {
            setMsg(error instanceof Error ? error.message : '어제 분석에 실패했어요.');
          } finally { setBusy(false); }
        })(); }}>어제 분석 다시 시도</button> : null}

      <DietaRecipeLibraryModal
        open={libraryOpen}
        busy={busy}
        canCreate={Boolean(profile?.geminiMealConsent)}
        dateLabel={label}
        defaultMealType={mealType}
        onClose={() => setLibraryOpen(false)}
        onLoadRecipes={loadLibraryRecipes}
        onAddToDay={addLibraryRecipe}
        onAnalyzeRecipe={analyzeRecipe}
      />
    </>
  );
}
