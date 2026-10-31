import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { dietaApi } from '../api/dietaApi';
import type { DietaProfile } from '../features/dieta/types';
import { DIETA_STYLE_LABELS } from '../features/dieta/types';
import { useDietaUserKey } from '../features/dieta/useDietaUserKey';
import { useAuthStore } from '../stores/authStore';
import { DietaLoadState } from '../components/dieta/DietaLoadState';

type Draft = { target: string; weekly: string; cut: string; activity: string; ceiling: string; consent: boolean };
let savedDraft: { key: string; value: Partial<Draft> } | null = null;
let sessionGeneration = 0;
function rememberDraft(key: string, value: Draft, baseline: Draft) {
  const changes = Object.fromEntries((Object.keys(value) as Array<keyof Draft>).filter(field => value[field] !== baseline[field]).map(field => [field, value[field]]));
  savedDraft = Object.keys(changes).length ? {key, value: changes} : null;
}
const unsubscribeDraft = useAuthStore.subscribe((state, prev) => {
  if (!state.accessToken || state.userId !== prev.userId || state.email !== prev.email) { savedDraft = null; sessionGeneration++; }
});
// The draft survives route changes, so its reload protection must too.
const warnBeforeUnload = (event: BeforeUnloadEvent) => {
  if (savedDraft) { event.preventDefault(); event.returnValue = ''; }
};
if (typeof window !== 'undefined') window.addEventListener('beforeunload', warnBeforeUnload);
if (import.meta.hot) import.meta.hot.dispose(() => { window.removeEventListener('beforeunload', warnBeforeUnload); unsubscribeDraft(); });
const fromProfile = (p: DietaProfile): Draft => ({ target: p.targetWeightKg == null ? '' : String(p.targetWeightKg), weekly: String(p.weeklyTargetKg), cut: String(p.lossCutKcal), activity: String(p.lossActivityKcal), ceiling: String(p.gainCeilingDeltaKcal), consent: p.geminiMealConsent });

export function DietaSettingsPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore(s => s.accessToken);
  const userKey = useDietaUserKey();
  const [profile, setProfile] = useState<DietaProfile | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const currentUser = useRef(userKey);
  const generation = sessionGeneration;
  const isCurrent = () => currentUser.current === userKey && generation === sessionGeneration;
  useEffect(() => {
    let cancelled = false;
    currentUser.current = userKey;
    setLoaded(false); setLoadError('');
    if (accessToken) void dietaApi.getProfile(userKey).then(p => {
      if (cancelled) return;
      setProfile(p);
      if (p) {
        const base = fromProfile(p);
        const next = {...base, ...(savedDraft?.key === userKey ? savedDraft.value : {})};
        setDraft(next); rememberDraft(userKey, next, base);
      } else setDraft(null);
      setLoaded(true);
    }).catch(e => { if (!cancelled) setLoadError(e instanceof Error ? e.message : '설정을 불러오지 못했어요.'); });
    return () => { cancelled = true; currentUser.current = ''; };
  }, [accessToken, userKey, retry]);
  const baseline = profile ? fromProfile(profile) : null;
  const dirty = Boolean(draft && baseline && JSON.stringify(draft) !== JSON.stringify(baseline));
  const edit = (patch: Partial<Draft>) => {
    if (!draft) return;
    const next = {...draft, ...patch}; setDraft(next); if (baseline) rememberDraft(userKey, next, baseline); setMsg(''); setError('');
  };
  if (!accessToken) return <Navigate to="/login" replace state={{from:'/hobbies/dieta/settings'}} />;
  if (!loaded || loadError) return <DietaLoadState error={loadError} onRetry={() => setRetry(n => n + 1)} />;
  if (!profile?.onboardingComplete || !draft || !baseline) return <Navigate to="/hobbies/dieta/onboarding" replace />;
  const maintain = profile.goalType === 'MAINTAIN';
  const targetDirty = draft.target !== baseline.target || draft.weekly !== baseline.weekly;
  const advancedDirty = draft.cut !== baseline.cut || draft.activity !== baseline.activity || draft.ceiling !== baseline.ceiling;
  const consentDirty = draft.consent !== baseline.consent;
  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setMsg('');
    try { await action(); } catch(e) { setError(e instanceof Error ? e.message : '저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const save = (section: 'target' | 'advanced' | 'consent') => void run(async () => {
    let patch: Partial<DietaProfile>;
    let fields: Array<keyof Draft>;
    if (section === 'target') {
      const target = draft.target.trim() === '' ? null : Number(draft.target);
      const weekly = Number(draft.weekly);
      if ((target === null && !maintain) || (target !== null && (!Number.isFinite(target) || target <= 0)) || (!maintain && (!draft.weekly.trim() || !Number.isFinite(weekly) || weekly <= 0))) throw new Error('목표 체중과 주간 목표를 0보다 큰 숫자로 입력해 주세요.');
      const derived = Math.round(weekly * 0.9 * 1000) / 1000;
      patch = {targetWeightKg:target, ...(!maintain ? {weeklyTargetKg:weekly, weeklyBodyFatLossKg:profile.goalType === 'LOSS' ? derived : null, weeklyMuscleGainKg:profile.goalType === 'GAIN' ? derived : null} : {})};
      fields = ['target','weekly'];
    } else if(section === 'advanced') {
      if ([draft.cut,draft.activity,draft.ceiling].some(v => !v.trim() || !Number.isFinite(Number(v)) || Number(v) < 0)) throw new Error('조절량은 0 이상 숫자로 입력해 주세요.');
      patch = {lossCutKcal:Number(draft.cut), lossActivityKcal:Number(draft.activity), gainCeilingDeltaKcal:Number(draft.ceiling)}; fields = ['cut','activity','ceiling'];
    } else { patch = {geminiMealConsent:draft.consent}; fields = ['consent']; }
    const next = await dietaApi.updateProfile(patch,userKey);
    if (!isCurrent()) return;
    const normalized = fromProfile(next);
    const updated = {...draft};
    for (const field of fields) Object.assign(updated, {[field]:normalized[field]});
    setProfile(next); setDraft(updated); rememberDraft(userKey, updated, normalized);
    setMsg(section === 'target' ? '목표를 저장했어요.' : section === 'advanced' ? '조절량을 저장했어요.' : 'AI 분석 동의를 저장했어요.');
  });
  const cancel = (fields: Array<keyof Draft>) => {
    const next = {...draft}; for(const field of fields) Object.assign(next,{[field]:baseline[field]});
    setDraft(next); rememberDraft(userKey, next, baseline); setError(''); setMsg('변경을 취소했어요.');
  };
  const field = (key: keyof Omit<Draft,'consent'>, label: string) => <div className="dieta-field"><label htmlFor={`dieta-setting-${key}`}>{label}</label><input id={`dieta-setting-${key}`} name={key} inputMode="decimal" autoComplete="off" aria-describedby={error ? 'dieta-settings-error' : undefined} value={draft[key]} disabled={busy} onChange={e => edit({[key]:e.target.value})} /></div>;
  return <>
    <div className="dieta-title-row"><div><h1>설정</h1><p className="dieta-muted">내 목표와 식사 리듬을 조절하세요.</p></div></div>
    {dirty && <p className="dieta-notice" role="status">저장하지 않은 변경이 있어요. 각 항목에서 저장하거나 취소해 주세요.</p>}
    {error && <p id="dieta-settings-error" role="alert" className="dieta-notice dieta-notice--error">{error}</p>}
    {msg && <p role="status" className="dieta-notice">{msg}</p>}
    <section className="dieta-card"><h2>현재 목표</h2><div className="dieta-list-row"><span>{maintain ? '유지 중' : profile.goalType === 'LOSS' ? '감량 중' : '증량 중'} · {DIETA_STYLE_LABELS[profile.dietStyle]}</span><strong>{profile.dailyKcal.toLocaleString()} kcal / 일</strong></div>
      <div className="dieta-switch-row"><label id="dieta-maintain-label">유지 모드</label><button type="button" role="switch" aria-labelledby="dieta-maintain-label" aria-checked={maintain} className="dieta-switch" disabled={busy || dirty} onClick={() => void run(async () => { const next = await dietaApi.setMaintainMode(!maintain,userKey); if(!isCurrent()) return; setProfile(next); setDraft(fromProfile(next)); savedDraft=null; setMsg('목표 모드를 변경했어요.'); })} /></div>
      <p className="dieta-muted">목표 체중에 도달하면 자동으로 유지 모드가 됩니다. {dirty ? '모드를 바꾸려면 먼저 변경을 저장하거나 취소해 주세요.' : '끄면 이전 감량·증량 목표로 돌아갑니다.'}</p>
      <details className="dieta-details"><summary>목표 계산 기준</summary><p>하루 예상 소비량 {profile.tdeeKcal} kcal · 기초대사량 {profile.bmrKcal} kcal</p><p>탄수화물 {Math.round(profile.macros.carbPct*100)}% · 단백질 {Math.round(profile.macros.proteinPct*100)}% · 지방 {Math.round(profile.macros.fatPct*100)}%</p></details>
    </section>
    <section className="dieta-card"><h2>목표 편집</h2>{field('target','목표 체중 (kg)')}{!maintain && field('weekly','주간 목표 변화 (kg)')}
      <div className="dieta-actions"><button className="dieta-btn dieta-btn--primary" disabled={busy || !targetDirty} onClick={() => save('target')}>{busy ? '저장 중…' : '목표 저장'}</button><button className="dieta-btn dieta-btn--ghost" disabled={busy || !targetDirty} onClick={() => cancel(['target','weekly'])}>목표 변경 취소</button></div>
    </section>
    <details className="dieta-card dieta-details"><summary>고급 조절</summary><p className="dieta-muted">주간 체크인에서 사용할 조절량입니다.</p>{field('cut','정체 시 식사 감소량 (kcal)')}{field('activity','정체 시 추가 활동량 (kcal)')}{field('ceiling','증량 시 추가 식사량 상한 (kcal)')}<div className="dieta-actions"><button className="dieta-btn dieta-btn--primary" disabled={busy || !advancedDirty} onClick={() => save('advanced')}>조절량 저장</button><button className="dieta-btn dieta-btn--ghost" disabled={busy || !advancedDirty} onClick={() => cancel(['cut','activity','ceiling'])}>조절량 변경 취소</button></div></details>
    <section className="dieta-card"><h2>AI 식사 분석</h2><label className="dieta-check"><input type="checkbox" checked={draft.consent} disabled={busy} onChange={e => edit({consent:e.target.checked})} />식사 내용을 AI로 분석하는 데 동의합니다.</label><p className="dieta-muted">분석을 요청하면 기록한 음식과 레시피를 Gemini로 보내 영양 정보를 추정합니다.</p><div className="dieta-actions"><button className="dieta-btn dieta-btn--primary" disabled={busy || !consentDirty} onClick={() => save('consent')}>동의 설정 저장</button><button className="dieta-btn dieta-btn--ghost" disabled={busy || !consentDirty} onClick={() => cancel(['consent'])}>동의 변경 취소</button></div></section>
    <section className="dieta-card dieta-danger-zone"><h2>데이터 관리</h2><p className="dieta-muted">체중, 식사, 레시피, 활동과 체크인 기록을 모두 삭제하고 처음부터 설정합니다. 삭제한 기록은 복구할 수 없어요.</p><button className="dieta-btn dieta-btn--ghost" disabled={busy} onClick={() => { if(window.confirm('모든 Dieta 기록(체중·식사·레시피·활동·체크인)을 삭제합니다. 복구할 수 없습니다. 삭제 후 다시 시작할까요?')) void run(async () => { await dietaApi.resetAll(userKey); if (!isCurrent()) return; savedDraft=null; void navigate('/hobbies/dieta/onboarding',{replace:true}); }); }}>모든 기록 삭제 후 다시 시작</button></section>
  </>;
}
