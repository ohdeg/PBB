import { DietaQuickMeals } from '../components/dieta/DietaQuickMeals';
import { DietaEntryDate } from '../components/dieta/DietaEntryDate';
import { shiftDay, useEntryOffset } from '../features/dieta/quickEntry';
import { DietaLoadState } from '../components/dieta/DietaLoadState';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, Link, Navigate } from 'react-router-dom';
import { dietaApi } from '../api/dietaApi';
import { DietaRecipeLibraryModal } from '../components/dieta/DietaRecipeLibraryModal';
import type {
  DietaIntakeLog,
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

const MEAL_ORDER: DietaMealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

export function DietaMealsPage() {
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
  const [mealType, setMealType] = useState<DietaMealType>('BREAKFAST');
  const [text, setText] = useState('');
  const [queue, setQueue] = useState<DietaMealQueueDay | null>(null);
  const [todayRecipes, setTodayRecipes] = useState<DietaRecipe[]>([]);
  const [todayIntake, setTodayIntake] = useState<DietaIntakeLog | null>(null);
  const [recent, setRecent] = useState<DietaIntakeLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [yesterdayRetry, setYesterdayRetry] = useState<string | null>(null);

  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const today = shiftDay(todayIsoDate(openedAt, profile?.mealSchedule?.zone), offset);

  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++revision.current;
    const p = await dietaApi.getProfile(userKey);
    if (request !== revision.current) return;
    if (!p?.onboardingComplete) {setProfile(p); setLoaded(true); setLoadError(''); return;}
    const loggedOn = shiftDay(todayIsoDate(openedAt, p.mealSchedule?.zone), offset);
    const [q, intakes, recipes] = await Promise.all([
      dietaApi.getMealQueue(loggedOn, userKey),
      dietaApi.listIntakes(undefined, userKey),
      dietaApi.listRecipes(loggedOn, userKey),
    ]);
    if (request !== revision.current) return;
    setLoaded(true); setLoadError('');
    setProfile(p);
    setQueue(q);
    setYesterdayRetry(q.retryableYesterday ?? null);
    setTodayRecipes(recipes);
    setTodayIntake(intakes.find((r) => r.loggedOn === loggedOn) ?? null);
    setRecent(intakes.filter((r) => r.loggedOn !== loggedOn).slice(-7).reverse());
  }, [userKey, offset,openedAt]);

  const loadLibraryRecipes = useCallback(async (): Promise<DietaRecipe[]> => {
    return dietaApi.listRecipes(undefined, userKey);
  }, [userKey]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    setLoadError('');
    void (async () => {
      try {
        const auto = offset ? null : await dietaApi.autoFinalizeYesterday(userKey);
        if (auto) {
          setMsg(
            `어제(${auto.intake.loggedOn}) 큐를 자동 분석했어요 · ${auto.intake.kcal}kcal`,
          );
        }
      } catch (error: unknown) {
        setMsg(error instanceof Error ? error.message : '어제 분석에 실패했어요. 다시 시도해 주세요.');
      }
      try { await refresh(); }
      catch (error: unknown) { setLoadError(error instanceof Error ? error.message : '기록을 불러오지 못했어요.'); }
    })();
  }, [accessToken, userKey, today, refresh, offset]);

  useEffect(() => {
    if (retry > 0) void refresh().catch(e => setLoadError(e instanceof Error ? e.message : '기록을 불러오지 못했어요.'));
  }, [retry, refresh]);

  useEffect(() => {
    if (!accessToken || !loaded) return;
    const reload = () => { if (document.visibilityState === 'visible') void refresh().catch(() => {}); };
    window.addEventListener('focus', reload);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void refresh().catch(() => setMsg('분석 상태를 확인하지 못했어요. 새로고침해 주세요.'));
    }, queue?.status === 'pending' ? 5000 : 60000);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', reload); };
  }, [accessToken, loaded, queue?.status, today, userKey, refresh]);

  if (!accessToken) {
    return (
      <Navigate to="/login" replace state={{ from: '/hobbies/dieta/meals' }} />
    );
  }

  if (!loaded || loadError) return <DietaLoadState error={loadError} onRetry={() => {setLoadError(''); setRetry(n => n + 1);}} />;
  if (!profile?.onboardingComplete) return <Navigate to="/hobbies/dieta/onboarding" replace />;

  const addItem = async () => {
    if (today!==shiftDay(todayIsoDate(new Date(), profile?.mealSchedule?.zone),offset)) {setMsg('날짜가 바뀌었어요. 표시된 날짜를 확인하고 화면을 다시 열어 주세요.');return;}
    if (!text.trim()) {
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const next = await dietaApi.addMealQueueItem(
        { loggedOn: today, mealType, text },
        userKey,
      );
      revision.current++;
      setQueue(next);
      setText('');
      await refresh();
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
        { loggedOn: today, itemId },
        userKey,
      );
      revision.current++;
      setQueue(next);
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
      const { intake, queue: q } = await dietaApi.finalizeMealDay(today, userKey, queue?.availableStage ?? 'MAIN');
      setQueue(q);
      setTodayIntake(intake);
      setMsg('식사를 확정하고 영양 정보를 반영했어요.');
      await refresh();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : '분석에 실패했어요.');
      try { setQueue(await dietaApi.getMealQueue(today, userKey)); } catch { /* retain current input */ }
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
          loggedOn: today,
          title: input.title,
          ingredients: input.ingredients,
          steps: input.steps,
          servings: input.servings,
        },
        userKey,
      );

      setMsg(
        `레시피 「${input.title}」 분석 · 1인분 ${analyzed.kcal}kcal (${input.servings}인분 분량)`,
      );
      await refresh();
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
          loggedOn: today,
          mealType: input.mealType,
        },
        userKey,
      );
      setTodayIntake(result.intake);
      setMsg(`레시피를 선택한 날 섭취에 더했어요 · ${result.kcal}kcal`);
      await refresh();
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

  return (
    <>
      <div className="dieta-title-row">
        <h1>식사</h1>
        <div className="dieta-header-actions">
          <button
            type="button"
            className="dieta-btn dieta-btn--ghost dieta-btn--compact"
            disabled={busy}
            onClick={() => setLibraryOpen(true)}
          >
            저장한 음식
          </button>
        </div>
      </div>

      <DietaEntryDate offset={offset} day={today} disabled={busy}/>
      <DietaQuickMeals offset={offset} key={today} day={today} mealType={mealType} refresh={refresh} disabled={busy || pending}/>
      <section className="dieta-card">
        <div className="dieta-chip-row" style={{ marginBottom: '0.85rem' }}>
          {MEAL_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              className={`dieta-chip ${mealType === t ? 'is-active' : ''}`}
              aria-pressed={mealType === t}
              onClick={() => setMealType(t)}
              disabled={(closed && queue?.availableStage === undefined) || pending || busy}
            >
              {DIETA_MEAL_LABELS[t]}
            </button>
          ))}
        </div>
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
        <p className="dieta-muted" style={{ marginTop: '0.55rem' }}>
          먹은 음식을 먼저 기록하고, 하루 식사를 마치면 한 번에 분석해요. 저장한 음식은 선택해서 바로 더할 수 있어요.
        </p>
      </section>

      {todayRecipes.length > 0 ? (
        <section className="dieta-card">
          <div className="dieta-title-row">
            <h2>영양이 반영된 음식</h2>
            <span className="dieta-muted">{todayRecipes.length}건</span>
          </div>
          {todayRecipes.map((r) => (
            <div key={r.id} className="dieta-list-row">
              <span>
                {r.mealType ? `${DIETA_MEAL_LABELS[r.mealType]} · ` : ''}
                {r.title}
                <span className="dieta-muted"> · {r.consumedPortion ?? 1}인분</span>
              </span>
              <span className="dieta-muted">{r.kcal}kcal</span>
            </div>
          ))}
        </section>
      ) : null}

      <section className="dieta-card">
        <div className="dieta-title-row">
          <h2>{label} 식사</h2>
          <span className="dieta-muted">
            {queue?.status === 'done'
              ? (supplement ? '메인 분석 완료' : '이날 분석 완료')
              : queue?.status === 'pending'
                ? '분석 중'
                : `${queue?.items.length ?? 0}개`}
          </span>
        </div>
        {!queue || queue.items.length === 0 ? (
          <p className="dieta-muted">아직 기록이 없어요. 위에서 먹은 음식을 추가해 보세요.</p>
        ) : (
          MEAL_ORDER.map((t) => {
            const items = queue.items.filter((i) => i.mealType === t);
            if (items.length === 0) {
              return null;
            }
            return (
              <div key={t} style={{ marginBottom: '0.75rem' }}>
                <p className="dieta-muted" style={{ marginBottom: '0.25rem' }}>
                  {DIETA_MEAL_LABELS[t]}
                </p>
                {items.map((i) => (
                  <div key={i.id} className="dieta-list-row">
                    <span>{i.text}{(i.id.startsWith('note:') || exhausted && !i.id.startsWith('base:')) && ' · 분석 미반영'}</span>
                    {(i.id.startsWith('note:') || !closed && !i.id.startsWith('base:')) ? (
                      <button
                        type="button"
                        className="dieta-linkish"
                        disabled={busy || pending}
                        onClick={() => void removeItem(i.id)}
                      >
                        빼기
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            );
          })
        )}
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

      {todayIntake ? (
        <section className="dieta-card">
          <h2>기록한 음식 합계{todayIntake.includesEstimate ? " · 추정 포함" : ""}</h2>
          {Object.entries(todayIntake.estimatedMealKcal ?? {}).map(([meal,value])=><p key={meal} className="dieta-muted">
            {DIETA_MEAL_LABELS[meal as DietaMealType]} · 내 평균으로 추정 {value} kcal</p>)}
          <p style={{ marginTop: '0.55rem' }}>
            <strong>{todayIntake.kcal}kcal</strong>
            <span className="dieta-muted">
              {' '}
              · 탄수화물 {todayIntake.carbG}g · 단백질 {todayIntake.proteinG}g · 지방{' '}
              {todayIntake.fatG}g
            </span>
          </p>
          {todayIntake.review ? (
            <p className="dieta-muted" style={{ marginTop: '0.45rem' }}>
              {todayIntake.review}
            </p>
          ) : null}
        </section>
      ) : null}

      {msg ? <p role="status" className="dieta-muted">{msg}</p> : null}
      {yesterdayRetry ? <button type="button" className="dieta-btn dieta-btn--soft" disabled={busy}
        onClick={() => { void (async () => {
          setBusy(true);
          try {
            await dietaApi.finalizeMealDay(yesterdayRetry, userKey);
            setYesterdayRetry(null);
            setMsg('어제 기록을 확인했어요.');
            await refresh();
          } catch (error: unknown) {
            setMsg(error instanceof Error ? error.message : '어제 분석에 실패했어요.');
          } finally { setBusy(false); }
        })(); }}>어제 분석 다시 시도</button> : null}

      <section className="dieta-card">
        <h2>최근 식사 기록</h2>
        {recent.length === 0 ? (
          <p className="dieta-muted">아직 없어요.</p>
        ) : (
          recent.map((r) => (
            <div key={r.id} className="dieta-list-row">
              <span>{r.loggedOn}</span>
              <span className="dieta-muted">
                {r.kcal}kcal{r.includesEstimate && " · 추정 포함"}
                {r.review ? ` · ${r.review}` : ''}
              </span>
            </div>
          ))
        )}
      </section>

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
