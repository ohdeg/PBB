import { useEffect, useState } from 'react';
import type {
  DietaMealType,
  DietaRecipe,
  DietaRecipeAnalyzeResult,
} from '../../features/dieta/types';
import { DIETA_MEAL_LABELS } from '../../features/dieta/types';
import { DietaRecipeModal } from './DietaRecipeModal';
import { Dialog } from '../ui/Dialog';

const MEAL_ORDER: DietaMealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

function recipeMetaLabel(recipe: DietaRecipe): string {
  const servingsLabel = `${recipe.servings}인분 · 1인분당`;
  if (recipe.mealType) {
    return `${recipe.loggedOn} · ${DIETA_MEAL_LABELS[recipe.mealType]} · ${servingsLabel}`;
  }
  return `${recipe.loggedOn} · ${servingsLabel}`;
}

interface DietaRecipeLibraryModalProps {
  open: boolean;
  busy: boolean;
  canCreate: boolean;
  defaultMealType: DietaMealType;
  onClose: () => void;
  onLoadRecipes: () => Promise<DietaRecipe[]>;
  onAddToDay: (input: {
    recipeId: string;
    mealType: DietaMealType;
  }) => Promise<DietaRecipeAnalyzeResult>;
  onAnalyzeRecipe: (input: {
    title: string;
    ingredients: string[];
    steps: string | null;
    servings: number;
  }) => Promise<DietaRecipeAnalyzeResult | null>;
}

export function DietaRecipeLibraryModal({
  open,
  busy,
  canCreate,
  defaultMealType,
  onClose,
  onLoadRecipes,
  onAddToDay,
  onAnalyzeRecipe,
}: DietaRecipeLibraryModalProps) {
  const [recipes, setRecipes] = useState<DietaRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mealType, setMealType] = useState<DietaMealType>(defaultMealType);
  const [actionError, setActionError] = useState('');
  const [lastAdded, setLastAdded] = useState<DietaRecipeAnalyzeResult | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const reloadRecipes = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const rows = await onLoadRecipes();
      setRecipes(rows);
    } catch (e: unknown) {
      setRecipes([]);
      setLoadError(e instanceof Error ? e.message : '레시피를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setCreateOpen(false);
      return;
    }
    setSelectedId(null);
    setMealType(defaultMealType);
    setActionError('');
    setLastAdded(null);
    setCreateOpen(false);
    setLoading(true);
    setLoadError('');
    void (async () => {
      try {
        const rows = await onLoadRecipes();
        setRecipes(rows);
      } catch (e: unknown) {
        setRecipes([]);
        setLoadError(e instanceof Error ? e.message : '레시피를 불러오지 못했어요.');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, onLoadRecipes, defaultMealType]);

  if (!open) {
    return null;
  }

  const selected = recipes.find((r) => r.id === selectedId) ?? null;

  const selectRecipe = (recipe: DietaRecipe) => {
    setSelectedId(recipe.id);
    setMealType(recipe.mealType ?? defaultMealType);
    setActionError('');
    setLastAdded(null);
  };

  const addSelected = async () => {
    if (!selected) {
      setActionError('레시피를 선택해 주세요.');
      return;
    }
    setActionError('');
    try {
      const result = await onAddToDay({
        recipeId: selected.id,
        mealType,
      });
      setLastAdded(result);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : '오늘 섭취에 더하지 못했어요.');
    }
  };

  const handleAnalyze = async (input: {
    title: string;
    ingredients: string[];
    steps: string | null;
    servings: number;
  }): Promise<DietaRecipeAnalyzeResult | null> => {
    const analyzed = await onAnalyzeRecipe(input);
    await reloadRecipes();
    return analyzed;
  };

  return (
    <>
      <Dialog
        open={open}
        title="등록 음식"
        onClose={onClose}
        closeOnBackdrop={!busy}
        closeOnEscape={!busy && !createOpen}
        backdropClassName="dieta-modal-backdrop"
        panelClassName="dieta-modal"
        description
      >
        {({ titleId, descriptionId }) => (
          <>
          <div className="dieta-title-row">
            <h2 id={titleId}>등록 음식</h2>
            <button
              type="button"
              className="dieta-btn dieta-btn--ghost dieta-btn--compact"
              disabled={busy || !canCreate}
              onClick={() => setCreateOpen(true)}
            >
              추가하기
            </button>
          </div>
          <p id={descriptionId} className="dieta-muted">
            등록해 둔 음식을 골라 끼니를 선택한 뒤 오늘 섭취에 더하거나, 「추가하기」로
            새 레시피를 분석해요. 저장된 영양은 1인분당 값입니다.
          </p>
          {!canCreate ? (
            <p className="dieta-muted">새 레시피 분석에는 AI 동의가 필요해요.</p>
          ) : null}

          {loading ? (
            <p className="dieta-muted">불러오는 중…</p>
          ) : loadError ? (
            <p className="dieta-muted">{loadError}</p>
          ) : recipes.length === 0 ? (
            <p className="dieta-muted">아직 등록한 음식이 없어요.</p>
          ) : (
            <div className="dieta-recipe-library-list">
              {recipes.map((r) => {
                const active = selectedId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`dieta-list-row dieta-list-row--button${active ? ' is-open' : ''}`}
                    onClick={() => selectRecipe(r)}
                    disabled={busy}
                    aria-pressed={active}
                  >
                    <span className="dieta-recipe-row__main">
                      <strong>{r.title}</strong>
                      <span className="dieta-muted">{recipeMetaLabel(r)}</span>
                    </span>
                    <span className="dieta-recipe-row__meta">
                      <strong>{r.kcal}kcal</strong>
                      <span className="dieta-muted">
                        탄 {r.carbG} · 단 {r.proteinG} · 지 {r.fatG}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {selected ? (
            <section style={{ marginTop: '0.85rem' }}>
              <h3>끼니</h3>
              <div className="dieta-chip-row" style={{ marginBottom: '0.75rem' }}>
                {MEAL_ORDER.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`dieta-chip ${mealType === t ? 'is-active' : ''}`}
                    onClick={() => setMealType(t)}
                    disabled={busy}
                  >
                    {DIETA_MEAL_LABELS[t]}
                  </button>
                ))}
              </div>
              {selected.ingredients.length > 0 ? (
                <>
                  <strong>재료</strong>
                  <ul className="dieta-recipe-detail__list">
                    {selected.ingredients.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          ) : null}

          {lastAdded ? (
            <p style={{ marginTop: '0.55rem' }}>
              <strong>추가됨 · {lastAdded.kcal}kcal</strong>
              <span className="dieta-muted">
                {' '}
                · 오늘 합계 {lastAdded.intake.kcal}kcal
              </span>
            </p>
          ) : null}

          {actionError ? <p className="dieta-muted">{actionError}</p> : null}

          <div style={{ display: 'grid', gap: '0.55rem', marginTop: '0.75rem' }}>
            <button
              type="button"
              className="dieta-btn dieta-btn--primary dieta-btn--block"
              disabled={busy || !selected}
              onClick={() => void addSelected()}
            >
              {busy ? '추가 중…' : '오늘 섭취에 더하기'}
            </button>
            <button
              type="button"
              className="dieta-btn dieta-btn--ghost dieta-btn--block"
              disabled={busy}
              onClick={onClose}
            >
              닫기
            </button>
          </div>
          </>
        )}
      </Dialog>

      <DietaRecipeModal
        open={createOpen}
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleAnalyze}
      />
    </>
  );
}
