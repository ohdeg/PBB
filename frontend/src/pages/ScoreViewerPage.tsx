import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ScoreViewer } from '../features/score/ScoreViewer';
import { ScoreI18nProvider, useTranslation } from '../features/score/i18n/LanguageContext';
import { fetchScoreDetail } from '../features/score/services/scoreRepository';
import type { ScoreDetail } from '../features/score/types';
import { resolveErrorMessage } from '../features/score/utils/resolveErrorMessage';

function ScoreViewerPageInner() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslation();
  const [score, setScore] = useState<ScoreDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const loadScore = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchScoreDetail(id);
        setScore(data);
      } catch (err) {
        setError(resolveErrorMessage(t, err, 'viewer.loadFailed'));
      } finally {
        setIsLoading(false);
      }
    };

    void loadScore();
  }, [id, t]);

  return (
    <main className="score-main viewer-page">
      <Link to="/hobbies/score-viewer" className="back-link">
        {t('viewer.backToLibrary')}
      </Link>
      <p className="page-kicker">음악</p>
      <h1>{score?.title ?? t('viewer.pageTitle')}</h1>
      <p className="score-lead">{score?.artist ?? t('viewer.loadingSubtitle')}</p>

      {isLoading && <p className="score-viewer-status">{t('viewer.loadingScore')}</p>}
      {error && <p className="score-viewer-error">{error}</p>}
      {!isLoading && !error && score && <ScoreViewer scoreId={score.id} />}
    </main>
  );
}

export function ScoreViewerPage() {
  return (
    <ScoreI18nProvider>
      <ScoreViewerPageInner />
    </ScoreI18nProvider>
  );
}
