import { DietaLoadState } from '../components/dieta/DietaLoadState';
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
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
  const [yesterdayFailed, setYesterdayFailed] = useState(false);

  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const today = todayIsoDate();

  const refresh = useCallback(async () => {
    const p = await dietaApi.getProfile(userKey);
    if (!p?.onboardingComplete) {setProfile(p); setLoaded(true); setLoadError(''); return;}
    const [q, intakes, recipes] = await Promise.all([
      dietaApi.getMealQueue(today, userKey),
      dietaApi.listIntakes(undefined, userKey),
      dietaApi.listRecipes(today, userKey),
    ]);
    setLoaded(true); setLoadError('');
    setProfile(p);
    setQueue(q);
    setTodayRecipes(recipes);
    setTodayIntake(intakes.find((r) => r.loggedOn === today) ?? null);
    setRecent(intakes.filter((r) => r.loggedOn !== today).slice(-7).reverse());
  }, [userKey, today]);

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
        const auto = await dietaApi.autoFinalizeYesterday(userKey);
        if (auto) {
          setMsg(
            `어제(${auto.intake.loggedOn}) 큐를 자동 분석했어요 · ${auto.intake.kcal}kcal`,
          );
        }
      } catch (error: unknown) {
        setYesterdayFailed(true);
        setMsg(error instanceof Error ? error.message : '어제 분석에 실패했어요. 다시 시도해 주세요.');
      }
      try { await refresh(); }
      catch (error: unknown) { setLoadError(error instanceof Error ? error.message : '기록을 불러오지 못했어요.'); }
    })();
  }, [accessToken, userKey, today, refresh]);

  useEffect(() => {
    if (retry > 0) void refresh().catch(e => setLoadError(e instanceof Error ? e.message : '기록을 불러오지 못했어요.'));
  }, [retry, refresh]);

  useEffect(() => {
    if (queue?.status !== 'pending') return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => setMsg('분석 상태를 확인하지 못했어요. 새로고침해 주세요.'));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [queue?.status, today, userKey, refresh]);

  if (!accessToken) {
    return (
      <Navigate to="/login" replace state={{ from: '/hobbies/dieta/meals' }} />
    );
  }

  if (!loaded || loadError) return <DietaLoadState error={loadError} onRetry={() => {setLoadError(''); setRetry(n => n + 1);}} />;
  if (!profile?.onboardingComplete) return <Navigate to="/hobbies/dieta/onboarding" replace />;

  const addItem = async () => {
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
      setQueue(next);
      setText('');
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
      const { intake, queue: q } = await dietaApi.finalizeMealDay(today, userKey);
      setQueue(q);
      setTodayIntake(intake);
      setMsg('오늘 식사를 확정하고 영양 정보를 반영했어요.');
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
      setMsg(`레시피를 오늘 섭취에 더했어요 · ${result.kcal}kcal`);
      await refresh();
      return result;
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : '레시피를 오늘 섭취에 더하지 못했어요.';
      setMsg(message);
      throw e instanceof Error ? e : new Error(message);
    } finally {
      setBusy(false);
    }
  };

  const closed = queue?.status === 'done';
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

      <section className="dieta-card">
        <div className="dieta-chip-row" style={{ marginBottom: '0.85rem' }}>
          {MEAL_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              className={`dieta-chip ${mealType === t ? 'is-active' : ''}`}
              aria-pressed={mealType === t}
              onClick={() => setMealType(t)}
              disabled={closed || pending || busy}
            >
              {DIETA_MEAL_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="dieta-field">
          <label htmlFor="dieta-meal-line">오늘 먹은 것</label>
          <input
            id="dieta-meal-line"
            value={text}
            disabled={closed || pending || busy}
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
          disabled={closed || pending || busy || !text.trim()}
          onClick={() => void addItem()}
        >
          {DIETA_MEAL_LABELS[mealType]}에 추가
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
                <span className="dieta-muted"> · 1인분</span>
              </span>
              <span className="dieta-muted">{r.kcal}kcal</span>
            </div>
          ))}
        </section>
      ) : null}

      <section className="dieta-card">
        <div className="dieta-title-row">
          <h2>오늘 식사</h2>
          <span className="dieta-muted">
            {queue?.status === 'done'
              ? '확정 완료'
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
                    <span>{i.text}</span>
                    {!closed ? (
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
        <p className="dieta-muted">{closed ? '오늘 기록을 확정했어요. 한 줄 음식은 더 추가할 수 없어요.' : pending ? '영양 정보를 분석하고 있어요. 완료될 때까지 잠시 기다려 주세요.' : queue?.status === 'failed' ? '분석하지 못했어요. 기록은 남아 있으니 다시 시도해 주세요.' : '확정하면 한 줄 음식을 더 추가할 수 없어요. 오늘 식사를 모두 기록했는지 확인해 주세요.'}</p>
        {!closed ? (
          <button
            type="button"
            className="dieta-btn dieta-btn--primary dieta-btn--block"
            disabled={busy || pending || !queue?.items.length || !profile?.geminiMealConsent}
            onClick={() => void finalize()}
          >
            {busy || pending ? '분석 중…' : queue?.status === 'failed' ? '분석 다시 시도' : '오늘 기록 확정하고 분석'}
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
          <h2>분석된 섭취량</h2>
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
      {yesterdayFailed ? <button type="button" className="dieta-btn dieta-btn--soft" disabled={busy}
        onClick={() => { void (async () => {
          setBusy(true);
          try {
            await dietaApi.autoFinalizeYesterday(userKey);
            setYesterdayFailed(false);
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
                {r.kcal}kcal
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
        defaultMealType={mealType}
        onClose={() => setLibraryOpen(false)}
        onLoadRecipes={loadLibraryRecipes}
        onAddToDay={addLibraryRecipe}
        onAnalyzeRecipe={analyzeRecipe}
      />
    </>
  );
}
