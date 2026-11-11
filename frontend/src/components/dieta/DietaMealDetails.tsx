import type { ReactNode } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import type { MealDayDetails, Nutrition } from '../../features/dieta/quickEntry';
import { DIETA_MEAL_LABELS, type DietaMealType } from '../../features/dieta/types';
import { mealOrder } from '../../features/dieta/suggestMeal';

function macros(n:Nutrition) {
  return `탄수화물 ${Number(n.carbG.toFixed(1))}g · 단백질 ${Number(n.proteinG.toFixed(1))}g · 지방 ${Number(n.fatG.toFixed(1))}g`;
}

interface MealEditor {
  selected: DietaMealType;
  select: (meal:DietaMealType)=>void;
  remove: (id:string)=>void;
  canRemove: (id:string)=>boolean;
  busy: boolean;
  content: ReactNode;
}

export function DietaMealDetails({details,editor,library}:{details:MealDayDetails;editor?:MealEditor;library?:ReactNode}) {
  const {intake,foods,mealTotals,queue} = details;
  const stage = details.completedStage==='SUPPLEMENT'?'추가 분석 완료':details.completedStage==='MAIN'?'기본 분석 완료':'';
  const status = {pending:'분석 중',exhausted:'분석 기회 소진',failed:'분석 실패',open:'',done:''}[queue.status];
  const progress = [stage,status].filter(Boolean).join(' · ');
  return <section className="dieta-journal">
    <div className="dieta-journal-head"><h2>하루 섭취량</h2>{library}</div>
    {intake ? <>
      <div className="dieta-energy"><strong>{intake.kcal.toLocaleString()}</strong> kcal</div>
      <div className="dieta-nutrients">{([['탄수화물',intake.carbG],['단백질',intake.proteinG],['지방',intake.fatG]] as const)
        .map(([label,value])=><div key={label}><span>{label}</span><strong>{Number(value.toFixed(1))} g</strong></div>)}</div>
      {intake.includesEstimate && <p className="dieta-muted">평균 추정 포함</p>}
      {intake.review && <p className="dieta-review">{intake.review}</p>}
      {!foods.length && !queue.items.length && <p className="dieta-muted">음식별 상세 기록 없음</p>}
    </> : <p className="dieta-muted">{foods.length || queue.items.length?'아직 분석된 영양 정보가 없어요.':'이날 기록한 식사가 없어요.'}</p>}
    {progress && <p className="dieta-muted">{progress}</p>}
    <div className="dieta-meal-ledger">
      {[...mealOrder,'OTHER' as const].map(meal=>{
        const group = foods.filter(row=>meal==='OTHER' ? !mealOrder.includes(row.mealType as DietaMealType) : row.mealType===meal);
        const editable = !!editor && meal!=='OTHER';
        const raw = editable ? queue.items.filter(i=>i.mealType===meal && !i.id.startsWith('base:')) : [];
        const rows = editable ? group.filter(r=>r.source!=='unanalysed') : group;
        const totals = mealTotals[meal];
        if (!editable && !group.length && !totals) return null;
        const name = meal==='OTHER'?'끼니 미지정':DIETA_MEAL_LABELS[meal];
        const active = editable && editor.selected===meal;
        const preview = [...rows.map(f=>f.name),...raw.map(i=>i.text)].join(', ');
        const header = <><strong>{name}</strong><span id={'dieta-preview-'+meal} className="dieta-food-preview">{active?'':preview || '기록하기'}</span>
          {totals && <span id={'dieta-subtotal-'+meal} className="dieta-subtotal">{totals.kcal} kcal</span>}
          {editable && !preview ? <Plus size={17} aria-hidden="true"/>:<ChevronDown size={17} aria-hidden="true"/>}</>;
        const body = <>
          {totals && <p className="dieta-muted">{macros(totals)}</p>}
          {rows.map((row,i)=><div key={i} className="dieta-food-detail">
            <strong>{row.name}</strong>{row.portion && <span> · {row.portion}{row.source==='estimatedPortion'?' (추정)':''}</span>}
            <p className="dieta-muted">{row.nutrition?`${row.nutrition.kcal} kcal · ${macros(row.nutrition)}`:
              row.source==='unanalysed'?'분석 미반영':'음식별 상세 기록 없음'}</p>
          </div>)}
          {raw.map(item=><div key={item.id} className="dieta-list-row"><span>{item.text}</span>
            {editor?.canRemove(item.id) && <button type="button" className="dieta-linkish" disabled={editor.busy}
              onClick={()=>editor.remove(item.id)}>빼기</button>}
            <small className="dieta-muted">분석 미반영</small></div>)}
        </>;
        return editable ? <div key={meal} className={'dieta-ledger-row'+(active?' is-selected':'')}>
          <button type="button" className="dieta-ledger-label" aria-label={name+' 기록'} aria-pressed={active}
            aria-expanded={active} aria-describedby={'dieta-preview-'+meal+(totals?' dieta-subtotal-'+meal:'')} onClick={()=>editor.select(meal)}>{header}</button>
          {active && <div className="dieta-ledger-body">{body}{editor.content}</div>}
        </div> : <details key={meal} className="dieta-ledger-row">
          <summary className="dieta-ledger-label">{header}</summary><div className="dieta-ledger-body">{body}</div>
        </details>;
      })}
    </div>
  </section>;
}
