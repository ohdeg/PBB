import { TemporiStateProvider } from '../features/tempori/services/TemporiStateProvider';
import { scoreHash } from '../features/tempori/services/temporiCloudApi';
import type { StateIdentity } from '../features/tempori/services/temporiStateRepository';
import { useAuthStore } from '../stores/authStore';
import { sourceFromBlob } from '../features/tempori/pages/scoreSource';
import type { ScoreSource } from '../features/tempori/pages/types';
import { PdfTempori } from '../features/tempori/pages/PdfTempori';
import { useEffect, useId, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { TemporiDockSlot } from '../components/TemporiViewerDock';
import { Tempori } from '../features/tempori/Tempori';
import { TemporiI18nProvider, useTranslation } from '../features/tempori/i18n/LanguageContext';
import { fetchTemporiDetail, fetchTemporiContent, temporiStateIdentity } from '../features/tempori/services/temporiRepository';
import type { TemporiDetail } from '../features/tempori/types';
import { resolveErrorMessage } from '../features/tempori/utils/resolveErrorMessage';
import { TemporiDownloadError } from '../features/tempori/services/temporiDownloadError';

function TemporiPageInner() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslation();
  const account = useAuthStore((state) => state.userId);
  const [identity, setIdentity] = useState<StateIdentity | null>(null);
  const [stateError, setStateError] = useState('');
  const [source, setSource] = useState<ScoreSource | null>(null);
  const [tempori, setTempori] = useState<TemporiDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticCode, setDiagnosticCode] = useState<string | null>(null);
  const diagnosticId = useId();
  const [isLoading, setIsLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setTempori(null);
    setSource(null); setIdentity(null); setStateError('');
    setDiagnosticCode(null);
    if (!id) { setIsLoading(false); setError(t('viewer.loadFailed')); return; }

    const loadTempori = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchTemporiDetail(id);
        if (cancelled) return;
        const blob = await fetchTemporiContent(data.id);
        const source = await sourceFromBlob(data.id, blob); const hash = await scoreHash(blob); if (cancelled) return;
        let identity: StateIdentity;
        try { identity = await temporiStateIdentity(data.id, hash); }
        catch (failure) { if (failure instanceof DOMException && failure.name === 'AbortError') throw failure; if (!cancelled) setStateError('기기 연습 상태의 이전을 마치지 못했습니다. 보관함에서 악보를 다시 열어 재시도해 주세요.'); throw failure; }
        if (!cancelled) { setTempori(data); setSource(source); setIdentity(identity); }
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === 'AbortError')) {
          setDiagnosticCode(err instanceof TemporiDownloadError ? err.diagnosticCode : null);
          setError(err instanceof Error && ['저장공간이 부족해 다운로드에 실패했습니다', '오류가 발생하여 다운로드에 실패하였습니다'].includes(err.message) ? err.message : resolveErrorMessage(t, err, 'viewer.loadFailed'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadTempori();
  return () => { cancelled = true; };
  }, [id, t, retryKey, account]);

  return (
    <main className="tempori-main viewer-page">
      <header className="tempori-score-heading">
        <h1>{tempori?.title ?? t('viewer.pageTitle')}</h1>
        {isLoading ? <p className="tempori-lead">{t('viewer.loadingSubtitle')}</p> : tempori?.artist ? <p className="tempori-lead">{tempori.artist}</p> : null}
      </header>
      <TemporiDockSlot slot="title"><div className="tempori-score-info"><strong>{tempori?.title ?? t('viewer.pageTitle')}</strong>{tempori?.artist && <p>{tempori.artist}</p>}</div></TemporiDockSlot>

      {isLoading && <p className="tempori-status" role="status">{t('viewer.loadingTempori')}</p>}
      {stateError && <p role="status">{stateError}</p>}
      {error && <div><p className="tempori-error" role="alert" aria-describedby={diagnosticCode ? diagnosticId : undefined}>{error}</p>{diagnosticCode && <p id={diagnosticId} className="tempori-view-notice"><small>진단 코드: <code>{diagnosticCode}</code></small></p>}<Button onClick={() => setRetryKey((key) => key + 1)}>{t('viewer.retry')}</Button></div>}
      {!isLoading && !error && tempori && source && identity && <TemporiStateProvider identity={identity}>{(source.kind === 'pdf' ? <PdfTempori key={`${account}:${tempori.id}`} source={source} annotationId={tempori.annotationId ?? tempori.id} /> : <Tempori key={`${account}:${tempori.id}`} temporiId={tempori.id} annotationId={tempori.annotationId} suppliedMusicXml={source.xml} />)}</TemporiStateProvider>}
    </main>
  );
}

export function TemporiPage() {
  const account = useAuthStore((state) => state.userId);
  return (
    <TemporiI18nProvider>
      <TemporiPageInner key={account ?? "guest"} />
    </TemporiI18nProvider>
  );
}
