import { useRef, useState } from 'react';
import { dietaApi } from '../../api/dietaApi';
import { DIETA_MEAL_LABELS, type DietaMealType } from '../../features/dieta/types';
import type { MenuItem, QuickEdit, QuickPreview } from '../../features/dieta/quickEntry';

const modes = {previous:'전날 식사 가져오기', favorite:'자주 먹는 식사', saveFavorite:'자주 먹는 식사로 저장', estimate:'평소 수준으로 채우기'} as const;
type Mode = keyof typeof modes;
export function DietaQuickMeals({day,mealType,refresh,disabled,offset=0}:{offset?:number;day:string;mealType:DietaMealType;refresh:()=>Promise<void>;disabled:boolean}) {
  const previousLabel=offset?'그제 식사 가져오기':'어제 식사 가져오기';
  const [targetMeal,setTargetMeal]=useState(mealType);
  const [mode,setMode]=useState<Mode>('previous');
  const [preview,setPreview]=useState<QuickPreview|null>(null);
  const [items,setItems]=useState<MenuItem[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [fav,setFav]=useState('');
  const [name,setName]=useState('');
  const [portion,setPortion]=useState('1');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const generation=useRef(0);
  function choose(list:MenuItem[]) {
    setItems(list.map(i=>({...i}))); setSelected(list.map(i=>i.id));
  }
  async function open(next:Mode) {
    const request=++generation.current;
    setBusy(true);setMessage('');setPreview(null);
    try {
      const p=await dietaApi.quickPreview(day);
      if (request!==generation.current) return;
      setPreview(p);setMode(next);setTargetMeal(mealType);setName('');setPortion('1');
      setFav(next==='favorite' ? p.favorites[0]?.id ?? '' : '');
      choose(next==='previous'?p.previous:next==='favorite'?p.favorites[0]?.items ?? []:p.current.filter(i=>i.mealType===mealType));
    } catch (error) {
      if (request === generation.current) setMessage(error instanceof Error ? error.message : '간편 기록을 불러오지 못했어요.');
    }
    finally { if(request===generation.current) setBusy(false); }
  }
  async function apply(action:QuickEdit['action']) {
    if (!preview || busy) return;
    const input={action,revision:preview.revision,mealType:targetMeal,portion:Number(portion),favoriteId:fav||undefined,
      name:name.trim(),picks:items.filter(i=>selected.includes(i.id))};
    setBusy(true);setMessage('');
    try {
      await dietaApi.quickApply(day,{...input,requestId:preview.requestId});
      setPreview(null);setMessage('저장했어요.');await refresh();
    } catch(e) {setMessage(e instanceof Error?e.message:'다시 시도해 주세요.');}
    finally {setBusy(false);}
  }
  function update(id:string, patch:Partial<MenuItem>) {setItems(all=>all.map(i=>i.id===id?{...i,...patch}:i));}
  const avg=preview?.averages.find(a=>a.mealType===targetMeal);
  const already=preview?.current.some(i=>i.mealType===targetMeal);
  return <section className="dieta-card"><h2>간편 식사 기록</h2>
    <div className="dieta-actions">{(Object.keys(modes) as Mode[]).map(k=><button type="button" className="dieta-btn dieta-btn--ghost" key={k}
      disabled={busy || disabled} onClick={()=>void open(k)}>{k==='previous'?previousLabel:modes[k]}</button>)}</div>
    {preview && <fieldset disabled={busy || disabled} className="dieta-field"><legend>{mode==='previous'?previousLabel:modes[mode]}</legend>
      <p>{mode==='previous'?`${preview.previousDay} → ${day}`:day}</p>
      {(mode==='estimate' || mode==='saveFavorite' && !fav) && <label>대상 끼니<select value={targetMeal} onChange={e=>{
        const next=e.target.value as DietaMealType;setTargetMeal(next);
        if(mode==='saveFavorite') choose(preview.current.filter(i=>i.mealType===next));
      }}>{Object.entries(DIETA_MEAL_LABELS).map(([key,title])=><option key={key} value={key}>{title}</option>)}</select></label>}
      {mode==='favorite' && <label>저장한 식사<select value={fav} onChange={e=>{setFav(e.target.value);choose(preview.favorites.find(f=>f.id===e.target.value)?.items ?? []);}}>
        {preview.favorites.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
      {mode==='favorite' && fav && <button type="button" onClick={()=>{
        const f=preview.favorites.find(v=>v.id===fav)!;setMode('saveFavorite');setName(f.name);
        const extra=preview.current.filter(i=>!f.items.some(x=>x.id===i.id));
        choose([...f.items,...extra]);setSelected(f.items.map(i=>i.id));
      }}>이 식사 편집</button>}
      {mode==='saveFavorite' && <label>식사 이름<input value={name} maxLength={80} onChange={e=>setName(e.target.value)}/></label>}
      {mode==='estimate' ? <>
        <p>{already?'이미 기록한 음식이 있는 끼니예요.':avg?`${DIETA_MEAL_LABELS[targetMeal]} · 최근 28일 중 ${avg.days}일 평균 ${avg.totals.kcal} kcal`:'최근 28일에 같은 끼니의 영양 기록이 3일 이상 필요해요.'}</p>
        {avg && !already && <label>평균 대비 분량<input type="number" min=".01" max="10" step=".01" value={portion} onChange={e=>setPortion(e.target.value)}/>추정 {Math.round(avg.totals.kcal*Number(portion))} kcal</label>}
        {preview.estimates[targetMeal] && <button type="button" onClick={()=>void apply('clearEstimate')}>이 끼니 추정 지우기</button>}
      </> : <>
        {!items.length && <p>선택할 음식이 없어요.</p>}
        {items.map(i=><div className="dieta-field" key={i.id}>
          <label className="dieta-check"><input type="checkbox" checked={selected.includes(i.id)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,i.id]:prev.filter(k=>k!==i.id))}/>{i.text}</label>
          {selected.includes(i.id) && <div className="dieta-actions">
            <select aria-label={i.text+' 끼니'} value={i.mealType} onChange={e=>update(i.id,{mealType:e.target.value as DietaMealType})}>
              {Object.entries(DIETA_MEAL_LABELS).map(([v,label])=><option value={v} key={v}>{label}</option>)}</select>
            {(i.recipeId || !!i.legacy)?<label>인분<input type="number" min=".01" max="10" step=".01" value={i.portion} onChange={e=>update(i.id,{portion:Number(e.target.value)})}/></label>
            :<input aria-label="음식과 양" value={i.text} maxLength={1000} onChange={e=>update(i.id,{text:e.target.value})}/>}
          </div>}
        </div>)}
      </>}
      <div className="dieta-actions"><button className="dieta-btn dieta-btn--primary" type="button"
        disabled={mode==='estimate'?already || !avg || !(Number(portion)>0 && Number(portion)<=10):!selected.length || mode==='saveFavorite' && !name.trim()}
        onClick={()=>void apply(mode)}>{mode==='saveFavorite'?'식사 저장':mode==='estimate'?'추정으로 저장':'선택한 음식 추가'}</button>
        <button type="button" onClick={()=>{setPreview(null);setMessage('');}}>취소</button>
        {mode==='saveFavorite' && fav && <button type="button" onClick={()=>{if(window.confirm('저장한 식사를 삭제할까요?')) void apply('deleteFavorite');}}>저장한 식사 삭제</button>}
      </div>
    </fieldset>}
    {message && <p role="status">{message}</p>}
  </section>;
}
