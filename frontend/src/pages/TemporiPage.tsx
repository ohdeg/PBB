import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Tempori } from '../features/tempori/Tempori';
import { TemporiI18nProvider, useTranslation } from '../features/tempori/i18n/LanguageContext';
import { fetchTemporiDetail } from '../features/tempori/services/temporiRepository';
import type { TemporiDetail } from '../features/tempori/types';
import { resolveErrorMessage } from '../features/tempori/utils/resolveErrorMessage';

function TemporiPageInner() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslation();
  const [tempori, setTempori] = useState<TemporiDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setTempori(null);
    if (!id) { setIsLoading(false); setError(t('viewer.loadFailed')); return; }

    const loadTempori = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchTemporiDetail(id);
        if (!cancelled) setTempori(data);
      } catch (err) {
        if (!cancelled) setError(resolveErrorMessage(t, err, 'viewer.loadFailed'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadTempori();
  return () => { cancelled = true; };
  }, [id, t, retryKey]);

  return (
    <main className="tempori-main viewer-page">
      <Link to="/hobbies/tempori/library" className="back-link">
        {t('viewer.backToLibrary')}
      </Link>
      <p className="page-kicker">음악</p>
      <h1>{tempori?.title ?? t('viewer.pageTitle')}</h1>
      {isLoading ? <p className="tempori-lead">{t('viewer.loadingSubtitle')}</p> : tempori?.artist ? <p className="tempori-lead">{tempori.artist}</p> : null}

      {isLoading && <p className="tempori-status" role="status">{t('viewer.loadingTempori')}</p>}
      {error && <div><p className="tempori-error" role="alert">{error}</p><Button onClick={() => setRetryKey((key) => key + 1)}>{t('viewer.retry')}</Button></div>}
      {!isLoading && !error && tempori && <Tempori key={tempori.id} temporiId={tempori.id} />}
    </main>
  );
}

export function TemporiPage() {
  return (
    <TemporiI18nProvider>
      <TemporiPageInner />
    </TemporiI18nProvider>
  );
}
