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

  const today = todayIsoDate();

  const refresh = async () => {
    const [p, q, intakes, recipes] = await Promise.all([
      dietaApi.getProfile(userKey),
      dietaApi.getMealQueue(today, userKey),
      dietaApi.listIntakes(undefined, userKey),
      dietaApi.listRecipes(today, userKey),
    ]);
    setProfile(p);
    setQueue(q);
    setTodayRecipes(recipes);
    setTodayIntake(intakes.find((r) => r.loggedOn === today) ?? null);
    setRecent(intakes.filter((r) => r.loggedOn !== today).slice(-7).reverse());
  };

  const loadLibraryRecipes = useCallback(async (): Promise<DietaRecipe[]> => {
    return dietaApi.listRecipes(undefined, userKey);
  }, [userKey]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    void (async () => {
      try {
        const auto = await dietaApi.autoFinalizeYesterday(userKey);
        if (auto) {
          setMsg(
            `어제(${auto.intake.loggedOn}) 큐를 자동 분석했어요 · ${auto.intake.kcal}kcal`,
          );
        }
      } catch {
        // consent missing or empty — ignore
      }
      await refresh();
    })();
  }, [accessToken, userKey, today]);

  if (!accessToken) {
    return (
      <Navigate to="/login" replace state={{ from: '/hobbies/dieta/meals' }} />
    );
  }

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
      setMsg('오늘 마감 분석을 끝냈어요.');
      await refresh();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : '분석에 실패했어요.');
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
      setTodayIntake(analyzed.intake);
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

  return (
    <>
      <div className="dieta-title-row">
        <h1>섭취</h1>
        <div className="dieta-header-actions">
          <button
            type="button"
            className="dieta-btn dieta-btn--ghost dieta-btn--compact"
            disabled={busy}
            onClick={() => setLibraryOpen(true)}
          >
            등록 음식
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
              onClick={() => setMealType(t)}
              disabled={closed}
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
            disabled={closed || busy}
            onChange={(e) => setText(e.target.value)}
            placeholder="예: 닭가슴살 150g"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void addItem();
              }
            }}
          />
        </div>
        <button
          type="button"
          className="dieta-btn dieta-btn--soft dieta-btn--block"
          disabled={closed || busy || !text.trim()}
          onClick={() => void addItem()}
        >
          {DIETA_MEAL_LABELS[mealType]}에 추가
        </button>
        <p className="dieta-muted" style={{ marginTop: '0.55rem' }}>
          한 줄 음식은 큐에만 쌓고 마감 때 분석해요. 등록 레시피는 상단 「등록
          음식」에서 고르거나 「추가하기」로 바로 분석해요.
        </p>
      </section>

      {todayRecipes.length > 0 ? (
        <section className="dieta-card">
          <div className="dieta-title-row">
            <strong>오늘 레시피</strong>
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
          <strong>오늘 큐</strong>
          <span className="dieta-muted">
            {queue?.status === 'done'
              ? '마감됨'
              : queue?.status === 'pending'
                ? '분석 중'
                : `${queue?.items.length ?? 0}개`}
          </span>
        </div>
        {!queue || queue.items.length === 0 ? (
          <p className="dieta-muted">아직 없어요.</p>
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
        {!closed ? (
          <button
            type="button"
            className="dieta-btn dieta-btn--primary dieta-btn--block"
            disabled={busy || !queue?.items.length}
            onClick={() => void finalize()}
          >
            {busy ? '분석 중…' : '오늘 마감 · 분석'}
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
          <strong>오늘 분석 결과</strong>
          <p style={{ marginTop: '0.55rem' }}>
            <strong>{todayIntake.kcal}kcal</strong>
            <span className="dieta-muted">
              {' '}
              · 탄 {todayIntake.carbG} · 단 {todayIntake.proteinG} · 지{' '}
              {todayIntake.fatG}
            </span>
          </p>
          {todayIntake.review ? (
            <p className="dieta-muted" style={{ marginTop: '0.45rem' }}>
              {todayIntake.review}
            </p>
          ) : null}
        </section>
      ) : null}

      {msg ? <p className="dieta-muted">{msg}</p> : null}

      <section className="dieta-card">
        <strong>최근 분석</strong>
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
