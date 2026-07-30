import { useEffect, useState } from 'react';
import type { DietaRecipeAnalyzeResult } from '../../features/dieta/types';

interface DietaRecipeModalProps {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    ingredients: string[];
    steps: string | null;
    servings: number;
  }) => Promise<DietaRecipeAnalyzeResult | null>;
}

export function DietaRecipeModal({
  open,
  busy,
  onClose,
  onSubmit,
}: DietaRecipeModalProps) {
  const [title, setTitle] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [steps, setSteps] = useState('');
  const [servings, setServings] = useState(1);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DietaRecipeAnalyzeResult | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle('');
    setIngredientsText('');
    setSteps('');
    setServings(1);
    setError('');
    setResult(null);
  }, [open]);

  if (!open) {
    return null;
  }

  const resetAndClose = () => {
    setTitle('');
    setIngredientsText('');
    setSteps('');
    setServings(1);
    setError('');
    setResult(null);
    onClose();
  };

  const submit = async () => {
    const ingredients = ingredientsText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (!title.trim()) {
      setError('레시피 제목을 입력해 주세요.');
      return;
    }
    if (ingredients.length === 0) {
      setError('재료를 한 줄 이상 입력해 주세요.');
      return;
    }
    if (!Number.isFinite(servings) || servings <= 0) {
      setError('인분 수는 0보다 커야 해요.');
      return;
    }
    setError('');
    try {
      const analyzed = await onSubmit({
        title: title.trim(),
        ingredients,
        steps: steps.trim() ? steps.trim() : null,
        servings,
      });
      if (analyzed) {
        setResult(analyzed);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '분석에 실패했어요.');
    }
  };

  return (
    <div className="dieta-modal-backdrop" role="presentation" onClick={resetAndClose}>
      <div
        className="dieta-modal"
        role="dialog"
        aria-modal
        aria-labelledby="dieta-recipe-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dieta-recipe-title">레시피로 추가</h2>
        <p className="dieta-muted">
          제목·재료(분량)·몇 인분을 적으면 1인분당 영양·칼로리를 분석해 오늘 섭취에
          더해요. 끼니(아침/점심/저녁/간식)는 「등록 음식」에서 다시 더할 때 고르세요.
        </p>

        {result ? (
          <>
            <p style={{ marginTop: '0.55rem' }}>
              <strong>{result.kcal}kcal</strong>
              <span className="dieta-muted">
                {' '}
                · 1인분당 · 탄 {result.carbG} · 단 {result.proteinG} · 지 {result.fatG}
              </span>
            </p>
            {result.servings != null ? (
              <p className="dieta-muted" style={{ marginTop: '0.35rem' }}>
                작성 분량 {result.servings}인분
              </p>
            ) : null}
            {result.oneLineReview ? (
              <p className="dieta-muted" style={{ marginTop: '0.45rem' }}>
                {result.oneLineReview}
              </p>
            ) : null}
            {result.intake ? (
              <p className="dieta-muted" style={{ marginTop: '0.45rem' }}>
                오늘 합계 {result.intake.kcal}kcal
              </p>
            ) : null}
            <button
              type="button"
              className="dieta-btn dieta-btn--primary dieta-btn--block"
              style={{ marginTop: '0.75rem' }}
              onClick={resetAndClose}
            >
              확인
            </button>
          </>
        ) : (
          <>
            <div className="dieta-field">
              <label htmlFor="dieta-recipe-name">제목</label>
              <input
                id="dieta-recipe-name"
                value={title}
                disabled={busy}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 된장찌개"
              />
            </div>
            <div className="dieta-field">
              <label htmlFor="dieta-recipe-servings">몇 인분</label>
              <input
                id="dieta-recipe-servings"
                type="number"
                min={0.01}
                step={1}
                value={servings}
                disabled={busy}
                onChange={(e) => setServings(Number(e.target.value))}
                placeholder="예: 2"
              />
            </div>
            <div className="dieta-field">
              <label htmlFor="dieta-recipe-ingredients">재료 (한 줄에 하나 · 위 인분 분량)</label>
              <textarea
                id="dieta-recipe-ingredients"
                rows={5}
                value={ingredientsText}
                disabled={busy}
                onChange={(e) => setIngredientsText(e.target.value)}
                placeholder={'된장 30g\n두부 150g\n애호박 80g'}
              />
            </div>
            <div className="dieta-field">
              <label htmlFor="dieta-recipe-steps">만드는 법 (선택)</label>
              <textarea
                id="dieta-recipe-steps"
                rows={3}
                value={steps}
                disabled={busy}
                onChange={(e) => setSteps(e.target.value)}
                placeholder="짧게 적어도 돼요"
              />
            </div>
            {error ? <p className="dieta-muted">{error}</p> : null}
            <div style={{ display: 'grid', gap: '0.55rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="dieta-btn dieta-btn--primary dieta-btn--block"
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy ? '분석 중…' : '분석 · 오늘 섭취에 더하기'}
              </button>
              <button
                type="button"
                className="dieta-btn dieta-btn--ghost dieta-btn--block"
                disabled={busy}
                onClick={resetAndClose}
              >
                취소
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
