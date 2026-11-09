import { activityFields, activityLabels, type ActivityField } from '../features/dieta/quickEntry';
import { DietaEntryDate } from '../components/dieta/DietaEntryDate';
import { shiftDay, useEntryOffset } from '../features/dieta/quickEntry';
import { DietaLoadState } from '../components/dieta/DietaLoadState';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { dietaApi } from '../api/dietaApi';
import type { DietaActivityLog, DietaBodyLog, DietaProfile } from '../features/dieta/types';
import { useDietaUserKey } from '../features/dieta/useDietaUserKey';
import {
  activityFromExtraKcal,
  todayIsoDate,
} from '../features/dieta/utils/dietaMath';
import { useAuthStore } from '../stores/authStore';

export function DietaActivityPage() {
  const offset = useEntryOffset();
  const location=useLocation();
  const owner=useDietaUserKey();
  return <DayPage key={owner+":"+location.key+":"+offset} offset={offset} />;
}
function DayPage({offset}:{offset:number}) {
  const [openedAt] = useState(()=>new Date());
  const label = offset ? '어제' : '오늘';
  const accessToken = useAuthStore((s) => s.accessToken);
  const userKey = useDietaUserKey();
  const [profile, setProfile] = useState<DietaProfile | null>(null);
  const [logs, setLogs] = useState<DietaBodyLog[]>([]);
  const [todayLog, setTodayLog] = useState<DietaActivityLog | null>(null);
  const [recent, setRecent] = useState<DietaActivityLog[]>([]);
  const [suggestions,setSuggestions]=useState<Awaited<ReturnType<typeof dietaApi.activitySuggestions>>|null>(null);
  const [sourceRevision,setSourceRevision]=useState<string>();

  const [activityName,setName] = useState('');
  const [estimated,setEstimated] = useState<string[]>([]);
  const [source,setSource] = useState<''|'copy'|'average'>('');
  const [steps, setSteps] = useState('');
  const [mins, setMins] = useState('');
  const [kcal, setKcal] = useState('');
  const [replaceLegacy, setReplaceLegacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const today = shiftDay(todayIsoDate(openedAt, profile?.mealSchedule?.zone), offset);

  const refresh = useCallback(async () => {
    const p = await dietaApi.getProfile(userKey);
    if (!p?.onboardingComplete) {setProfile(p); setLoaded(true); setLoadError(''); return;}
    const [body, acts] = await Promise.all([
      dietaApi.listBodyLogs(userKey),
      dietaApi.listActivities(userKey),
    ]);
    setLoaded(true); setLoadError('');
    setProfile(p);
    setLogs(body);
    const date = shiftDay(todayIsoDate(openedAt, p.mealSchedule?.zone), offset);
    const row = acts.find((a) => a.loggedOn === date) ?? null;
    setTodayLog(row);
    setSourceRevision(undefined);
    setSuggestions(null);
    setName(row?.activityName ?? '');
    setEstimated(row?.estimatedFields ?? []);
    setRecent(acts.slice(-7).reverse());
    if (row) {
      setSteps(row.steps != null ? String(row.steps) : '');
      setMins(row.durationMin != null ? String(row.durationMin) : '');
      setKcal(row.exerciseKcal != null ? String(row.exerciseKcal) : '');
    } else {
      setSteps('');
      setMins('');
      setKcal('');
    }
    setReplaceLegacy(false);
  }, [userKey, offset,openedAt]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    setLoadError(''); setLoaded(false);
    void refresh().catch(e => setLoadError(e instanceof Error ? e.message : '활동을 불러오지 못했어요.'));
  }, [accessToken, userKey, today, retry, refresh]);

  const weightKg =
    [...logs].reverse().find((l) => l.loggedOn <= today && l.weightKg != null && l.weightKg > 0)?.weightKg ?? null;

  const targets = useMemo(() => {
    if (!profile) {
      return null;
    }
    const extra =
      profile.weekActivityExtraKcal > 0
        ? profile.weekActivityExtraKcal
        : profile.lossActivityKcal;
    return activityFromExtraKcal({
      extraKcal: extra,
      weightKg,
      heightCm: profile.heightCm,
    });
  }, [profile, weightKg]);

  if (!accessToken) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: '/hobbies/dieta/activity' }}
      />
    );
  }

  if (!loaded || loadError) return <DietaLoadState error={loadError} onRetry={() => setRetry(n => n + 1)} />;
  if (!profile?.onboardingComplete) return <Navigate to="/hobbies/dieta/onboarding" replace />;

  const legacy = todayLog?.activityKcal != null && !todayLog.splitCalories;
  const count = steps.trim() ? Number(steps) : null;
  const walking = todayLog?.splitCalories && todayLog.steps === count && todayLog.walkingKcal != null
    ? todayLog.walkingKcal
    : count === 0 ? 0 : count != null && Number.isSafeInteger(count) && count > 0 && weightKg && profile.heightCm > 0
      ? Math.round(count * profile.heightCm * 0.415 / 100000 * weightKg * 0.5) : null;

  const prior = suggestions?.previous;
  const means = suggestions?.averages ?? {};
  async function openSource(kind:'copy'|'average') {
    if (source===kind) {setSource('');return;}
    setBusy(true);
    try {
      const latest=await dietaApi.activitySuggestions(today);
      if (sourceRevision && latest.revision!==sourceRevision) {
        setMsg('원본 활동이 변경됐어요. 다시 불러와 주세요.');
        await refresh();
      }
      setSuggestions(latest); setSource(kind);
    } catch {setMsg('간편 입력을 불러오지 못했어요. 다시 시도해 주세요.');}
    finally {setBusy(false);}
  }
  const values = {steps,durationMin:mins,exerciseKcal:kcal};
  const setters = {steps:setSteps,durationMin:setMins,exerciseKcal:setKcal};
  function fill(field:ActivityField,value:number,isEstimate:boolean) {
    setters[field](String(value));
    setEstimated(old=>[...old.filter(k=>k!==field),...(isEstimate?[field]:[])]);
  }
  const save = async () => {
    if (today!==shiftDay(todayIsoDate(new Date(), profile?.mealSchedule?.zone),offset)) {setMsg('날짜가 바뀌었어요. 표시된 날짜를 확인하고 화면을 다시 열어 주세요.');return;}
    const stepsN = steps.trim() ? Number(steps) : null;
    const minsN = mins.trim() ? Number(mins) : null;
    const kcalN = kcal.trim() ? Number(kcal) : null;
    if (
      (stepsN != null && (!Number.isSafeInteger(stepsN) || stepsN < 0))
      || (minsN != null && (!Number.isSafeInteger(minsN) || minsN < 0))
      || (kcalN != null && (!Number.isSafeInteger(kcalN) || kcalN < 0))
    ) {
      setMsg('활동량은 0 이상 정수로 입력해 주세요.');
      return;
    }
    const preserveLegacy = legacy && !replaceLegacy;
    if (stepsN == null && minsN == null && kcalN == null && !preserveLegacy && !activityName.trim()) {
      setMsg('걸음·분·운동 kcal 중 하나 이상 적어 주세요.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await dietaApi.upsertActivity(
        {
          loggedOn: today,
          steps: stepsN,
          durationMin: minsN,
          exerciseKcal: preserveLegacy ? null : kcalN,
          preservedLegacyKcal: preserveLegacy ? todayLog.activityKcal! : undefined,
          expectedLegacyKcal: legacy && replaceLegacy ? todayLog.activityKcal! : undefined,
          note: todayLog?.note,
          activityName:activityName.trim() || null, estimatedFields:estimated,
          revision:todayLog?.revision ?? 'empty', suggestionRevision:sourceRevision,
        },
        userKey,
      );
      setMsg(label+' 활동을 저장했어요.');
      setSource('');
      await refresh();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : '저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="dieta-title-row">
        <h1>활동</h1>
      </div>

      <section className="dieta-card">
        <DietaEntryDate offset={offset} day={today} disabled={busy}/>
        <h2>{label} 활동 기록</h2>
        <div className="dieta-actions">
          <button type="button" disabled={busy} onClick={()=>void openSource('copy')}>{offset?'그제 운동 가져오기':'어제 운동 가져오기'}</button>
          <button type="button" disabled={busy} onClick={()=>void openSource('average')}>평소 수준으로 채우기</button>
        </div>
        {source && <fieldset disabled={busy}><legend>{source==='copy'?shiftDay(today,-1)+' → '+today:'이전 28일 내 기록 평균'}</legend>
          {source==='copy' && prior?.activityName && <button disabled={!!activityName || mins==='0'} onClick={()=>{setName(prior.activityName!);setSourceRevision(suggestions?.revision);}}>{prior.activityName} 가져오기</button>}
          {activityFields.map(f=>{
            const n=source==='copy' ? prior?.estimatedFields?.includes(f)?null:prior?.[f] : means[f]?.value;
            return n==null?null:<button key={f} type="button" disabled={!!values[f] || (f==='exerciseKcal' && legacy && !replaceLegacy) || (f==='durationMin' && n===0 && (!!activityName || Number(kcal)>0))}
              onClick={()=>{fill(f,n,source==='average');setSourceRevision(suggestions?.revision);}}>{activityLabels[f]} {n} {source==='average'?`(${means[f]?.days}일 평균)`:'가져오기'}</button>;
          })}
          <p className="dieta-muted">{source==='copy'?(prior?'전날 기록된 값 중 비어 있는 항목만 선택할 수 있어요.':'가져올 전날 활동 기록이 없어요.'):'기록이 3일 이상인 항목만 표시해요. 선택 후 아래에서 값을 조정하고 저장하세요.'}</p>
        </fieldset>}
        <label className="dieta-field">운동명<input value={activityName} maxLength={100} disabled={busy}
          placeholder="예: 점심 산책" onChange={e=>{setName(e.target.value);if(e.target.value && mins==='0')setMins('');}}/></label>
        <button type="button" disabled={busy} onClick={()=>{setName('');setMins('0');setKcal('');setEstimated(old=>old.filter(f=>f==='steps'));}}>운동 안 함</button>
        {estimated.map(f=><p key={f}>{activityLabels[f as ActivityField]} · 추정
          <button type="button" disabled={busy} onClick={()=>setEstimated(prev=>prev.filter(v=>v!==f))}>직접 기록으로 변경</button></p>)}
        <p className="dieta-muted">걸음을 입력하면 키와 체중으로 걷기 소모 열량을 추정해요.</p>
        <div className="dieta-field">
          <label htmlFor="dieta-activity-steps">걸음</label>
          <input
            inputMode="numeric"
            id="dieta-activity-steps" name="steps" autoComplete="off" disabled={busy}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
          />
        </div>
        {count != null && (!legacy || replaceLegacy) && <p className="dieta-muted" aria-live="polite">
          {walking != null ? `걷기 추정 약 ${walking} kcal` : '걸음 수와 기록일 기준 키·체중이 있어야 걷기 열량을 추정할 수 있어요.'}
        </p>}
        <div className="dieta-field">
          <label htmlFor="dieta-activity-mins">운동 시간 (분)</label>
          <input
            inputMode="numeric"
            id="dieta-activity-mins" name="mins" autoComplete="off" disabled={busy}
            value={mins}
            onChange={(e) => setMins(e.target.value)}
          />
        </div>
        <div className="dieta-field">
          <label htmlFor="dieta-activity-kcal">운동 소모 열량 (kcal)</label>
          <input
            inputMode="numeric"
            aria-describedby="dieta-exercise-help" id="dieta-activity-kcal" name="kcal" autoComplete="off" disabled={busy || (legacy && !replaceLegacy)}
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
          />
        </div>
        <p id="dieta-exercise-help" className="dieta-muted">걷기·달리기의 운동 열량을 입력했다면 그 운동 중 걸음은 위 걸음 수에서 빼 주세요. 운동 시간은 열량에 따로 더하지 않아요.</p>
        {legacy && <label className="dieta-check"><input type="checkbox" checked={replaceLegacy}
          onChange={e => setReplaceLegacy(e.target.checked)} />기존 총 {todayLog.activityKcal} kcal를 걷기 추정과 운동 입력으로 교체</label>}
        <button
          type="button"
          className="dieta-btn dieta-btn--primary dieta-btn--block"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? '저장 중…' : todayLog ? label+' 활동 수정' : label+' 활동 저장'}
        </button>
        {msg ? <p role="status" className="dieta-notice">{msg}</p> : null}
      </section>

      <section className="dieta-card">
        <strong>
          이번 주 추가 활동 목표 ·{' '}
          {(profile?.weekActivityExtraKcal ?? 0) > 0
            ? profile?.weekActivityExtraKcal
            : (profile?.lossActivityKcal ?? '—')}
          kcal
          {(profile?.weekActivityExtraKcal ?? 0) > 0 ? (
            <span className="dieta-badge" style={{ marginLeft: '0.4rem' }}>
              체크인
            </span>
          ) : null}
        </strong>
        {targets ? (
          <div style={{ marginTop: '0.75rem' }}>
            <div className="dieta-list-row">
              <span>걸음</span>
              <strong>약 {targets.steps.toLocaleString()}보</strong>
            </div>
            <div className="dieta-list-row">
              <span>또는 빠른 걷기</span>
              <strong>약 {targets.minutesBrisk}분</strong>
            </div>
            <div className="dieta-list-row">
              <span>또는 중강도 운동</span>
              <strong>약 {targets.minutesMod}분</strong>
            </div>
          </div>
        ) : (
          <p className="dieta-muted">온보딩 후 목표가 표시됩니다.</p>
        )}
      </section>

      <section className="dieta-card">
        <h2>최근 기록</h2>
        {recent.length === 0 ? (
          <p className="dieta-muted">아직 활동 기록이 없어요. 오늘의 움직임을 남겨 보세요.</p>
        ) : (
          recent.map((r) => (
            <div key={r.id} className="dieta-list-row">
              <span>{r.loggedOn}</span>
              <span className="dieta-muted">
                {[
                  r.activityName,
                  r.estimatedFields?.length ? "추정 포함" : null,
                  r.steps != null ? `${r.steps.toLocaleString()}보` : null,
                  r.durationMin != null ? `${r.durationMin}분` : null,
                  r.walkingKcal != null ? `걷기 약 ${r.walkingKcal} kcal` : null,
                  r.exerciseKcal != null ? `운동 ${r.exerciseKcal} kcal` : null,
                  r.activityKcal != null ? `합계 ${r.activityKcal} kcal` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </span>
            </div>
          ))
        )}
      </section>
    </>
  );
}
