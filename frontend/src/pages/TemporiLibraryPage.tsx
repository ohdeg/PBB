import { useAuthStore } from '../stores/authStore';
import { CloudLibraryMigration } from '../features/tempori/components/CloudLibraryMigration';
import { currentAccount } from '../features/tempori/services/temporiCloudApi';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MusicXmlGuideModal } from '../features/tempori/components/MusicXmlGuideModal';
import { TemporiDeleteConfirm } from '../features/tempori/components/TemporiDeleteConfirm';
import { TemporiUploadConfirm } from '../features/tempori/components/TemporiUploadConfirm';
import { TemporiI18nProvider, useTranslation } from '../features/tempori/i18n/LanguageContext';
import {
  deleteLibraryTempori,
  fetchLibraryTemporiItems,
  saveTempori,
  retryTemporiUpload,
} from '../features/tempori/services/temporiRepository';
import type { LibraryTemporiItem } from '../features/tempori/types/library';
import {
  extractTemporiMetadataFromFile,
  getTemporiFileInputAccept,
} from '../features/tempori/utils/musicXmlMetadata';
import { resolveErrorMessage } from '../features/tempori/utils/resolveErrorMessage';
import { filterLibraryTemporiItemsByQuery } from '../features/tempori/utils/temporiSearch';
import { AnnotationCleanupError, cleanupDeletedTemporiAnnotations } from '../features/tempori/utils/temporiAnnotations';
import { Button } from '../components/ui/Button';

function TemporiLibraryPageInner() {
  const t = useTranslation();
  const account = useAuthStore((state) => state.userId);
  const accountLabel = useAuthStore((state) => state.email ?? state.nickname ?? '로그인 계정');
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const mounted = useRef(true);
  const loadRevision = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [temporiItems, setTemporiItems] = useState<LibraryTemporiItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmArtist, setConfirmArtist] = useState('');
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isMusicXmlGuideOpen, setIsMusicXmlGuideOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<LibraryTemporiItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cleanupIds, setCleanupIds] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadTemporiItems = useCallback(async () => {
    const revision = ++loadRevision.current;
    setIsLoading(true);
    setError(null);
    try {
      const libraryTemporiItems = await fetchLibraryTemporiItems();
      if (mounted.current && revision === loadRevision.current && currentAccount() === account) setTemporiItems(libraryTemporiItems);
    } catch (err) {
      if (mounted.current && revision === loadRevision.current) setError(resolveErrorMessage(t, err, 'library.loadFailed'));
    } finally {
      if (mounted.current && revision === loadRevision.current) setIsLoading(false);
    }
  }, [account, t]);

  useEffect(() => {
    mounted.current = true; void loadTemporiItems();
    const reload = () => { if (document.visibilityState !== 'hidden') void loadTemporiItems(); };
    window.addEventListener('focus', reload); window.addEventListener('online', reload);
    return () => { mounted.current = false; loadRevision.current += 1; window.removeEventListener('focus', reload); window.removeEventListener('online', reload); };
  }, [loadTemporiItems]);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearPendingUpload = () => {
    setPendingFile(null);
    setConfirmTitle('');
    setConfirmArtist('');
    setSaveError(null);
    resetFileInput();
  };

  const openFilePicker = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setSaveError(null);
    setIsParsingFile(true);

    try {
      const metadata = await extractTemporiMetadataFromFile(file);
      setPendingFile(file);
      setConfirmTitle(metadata.title);
      setConfirmArtist(metadata.artist ?? '');
    } catch (err) {
      setError(resolveErrorMessage(t, err, 'library.parseFailed'));
      resetFileInput();
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!pendingFile) return;

    const title = confirmTitle.trim();
    if (!title) {
      setSaveError(t('library.saveTitleRequired'));
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const saved = await saveTempori(pendingFile, title, confirmArtist.trim() || undefined);
      if (!mounted.current || currentAccount() !== account) return;
      setSyncMessage(saved.syncState === 'failed' ? '이 기기에 원본을 보관했습니다. 서버 저장에 실패하여 재시도가 필요합니다.' : saved.syncState === 'saved' ? '서버에 저장되었습니다.' : '이 기기에만 저장되었습니다.');
      clearPendingUpload();
      await loadTemporiItems();
    } catch (err) {
      setSaveError(resolveErrorMessage(t, err, 'library.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadSubmit = (event: FormEvent) => {
    event.preventDefault();
    openFilePicker();
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteLibraryTempori(pendingDelete);
      setPendingDelete(null);
      await loadTemporiItems();
    } catch (err) {
      if (err instanceof AnnotationCleanupError) {
        setCleanupIds((previous) => [...new Set([...previous, ...err.temporiIds])]);
        setPendingDelete(null);
        await loadTemporiItems();
      } else setDeleteError(resolveErrorMessage(t, err, 'library.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTemporiItems = useMemo(
    () => filterLibraryTemporiItemsByQuery(temporiItems, searchQuery),
    [temporiItems, searchQuery],
  );

  const hasSearchQuery = searchQuery.trim().length > 0;
  const temporiFileAccept = getTemporiFileInputAccept();

  return (
    <main className="tempori-main library-page">
      <Link to="/" className="back-link">
        {t('common.homeBack')}
      </Link>
      <div className="library-page__head">
        <div>
          <p className="page-kicker">음악</p>
          <h1>{t('library.title')}</h1>
        </div>
        <form onSubmit={handleUploadSubmit} className="library-page__import">
          <input
            ref={fileInputRef}
            id="tempori-file-input"
            type="file"
            accept={temporiFileAccept}
            onChange={handleFileChange}
            hidden
          />
          <Button type="submit" disabled={isParsingFile || isSaving}>
            {isParsingFile ? t('library.parsingFile') : t('library.importLocal')}
          </Button>
        </form>
      </div>

      <div className="tempori-cloud-toolbar"><Button variant="secondary" disabled={isLoading} onClick={() => void loadTemporiItems()}>보관함 새로고침</Button>{account && <Button variant="secondary" onClick={() => setMigrationOpen(true)}>이 기기의 악보를 계정에 저장</Button>}</div>
      <p className="tempori-sync-note">{account ? '새 원본은 계정 보관함에 저장합니다. 필기·연습 위치·템포·보기 설정은 이 기기에만 보관합니다.' : '현재 이 기기의 보관함입니다. 로그인하면 원본을 계정에 저장하여 다른 기기에서 열 수 있습니다.'}</p>
      {syncMessage && <p role="status">{syncMessage}</p>}
      {temporiItems.some((item) => item.serverListUnavailable) && <p role="alert">서버 보관함을 새로 확인하지 못했습니다. 기존 목록과 이 기기의 저장 대기 원본을 표시합니다. 연결을 확인하고 새로고침해 주세요.</p>}
      {temporiItems.some((item) => item.offline) && <p role="status">오프라인 보관함입니다. 이미 내려받은 원본만 열 수 있으며 다른 기기의 삭제 여부는 연결 후 확인합니다.</p>}
      {migrationOpen && account && <CloudLibraryMigration account={account} accountLabel={accountLabel} onClose={() => setMigrationOpen(false)} onComplete={() => void loadTemporiItems()} />}
      {!isLoading && temporiItems.length > 0 && (
        <div className="library-search library-search--toolbar">
          <label className="library-search-label" htmlFor="library-search-input">
            {t('library.searchLabel')}
          </label>
          <div className="library-search-field">
            <input
              id="library-search-input"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('library.searchPlaceholder')}
              autoComplete="off"
            />
            {hasSearchQuery && (
              <Button
                type="button"
                variant="secondary"
                className="library-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label={t('library.clearSearchAria')}
              >
                {t('library.clearSearch')}
              </Button>
            )}
          </div>
        </div>
      )}

      {error && <p className="form-error tempori-error" role="alert">{error}</p>}
      {cleanupIds.length > 0 && <div className="tempori-view-notice" role="alert">
        <p>{t('viewer.annotationCleanupFailed')}</p>
        <Button onClick={() => {
          try { cleanupDeletedTemporiAnnotations(cleanupIds); setCleanupIds([]); }
          catch (error) { if (error instanceof AnnotationCleanupError) setCleanupIds(error.temporiIds); }
        }}>{t('viewer.retryAnnotationCleanup')}</Button>
      </div>}

      {pendingFile && (
        <TemporiUploadConfirm
          fileName={pendingFile.name}
          title={confirmTitle}
          artist={confirmArtist}
          isUploading={isSaving}
          cloud={!!account}
          error={saveError}
          onTitleChange={setConfirmTitle}
          onArtistChange={setConfirmArtist}
          onCancel={clearPendingUpload}
          onConfirm={() => void handleConfirmSave()}
        />
      )}

      {pendingDelete && (
        <TemporiDeleteConfirm
          title={pendingDelete.title}
          isDeleting={isDeleting}
          error={deleteError}
          onCancel={() => {
            if (isDeleting) return;
            setPendingDelete(null);
            setDeleteError(null);
          }}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}

      <section className="tempori-list-section surface-card">
        <div className="tempori-list-section-head">
          <h2>{t('library.listTitle')}</h2>
          {!isLoading && temporiItems.length > 0 && (
            <span className="tempori-list-meta">
              {hasSearchQuery
                ? t('library.searchResultMeta', {
                    filtered: filteredTemporiItems.length,
                    total: temporiItems.length,
                  })
                : t('library.totalMeta', { total: temporiItems.length })}
            </span>
          )}
        </div>

        {isLoading && <p>{t('common.loading')}</p>}
        {!isLoading && !error && temporiItems.length === 0 && (
          <div className="library-empty-state">
            <p>{t('library.emptyTitle')}</p>
            <p className="library-empty-state-sub">{t('library.emptySubtitle')}</p>
          </div>
        )}
        {!isLoading && temporiItems.length > 0 && filteredTemporiItems.length === 0 && (
          <p className="library-search-empty">{t('library.searchEmpty')}</p>
        )}
        <ul className="tempori-list">
          {filteredTemporiItems.map((tempori) => (
            <li key={tempori.id} className="tempori-list-row">
              <Link
                to={`/hobbies/tempori/${tempori.id}`}
                className="tempori-list-item tempori-list-item--link"
              >
                <strong>{tempori.title}</strong>
                <span className="tempori-sync-note">{tempori.syncState === 'saved' ? '서버에 저장됨' : tempori.syncState === 'failed' ? '서버 저장 실패 · 기기 원본 보관 중' : '이 기기에만 있음'}</span>
                {tempori.artist && <span className="tempori-artist">{tempori.artist}</span>}
              </Link>
              <div className="tempori-list-actions">
                {tempori.syncState === 'failed' && <Button variant="secondary" disabled={uploadingId !== null} onClick={async () => { setUploadingId(tempori.id); setError(null); try { await retryTemporiUpload(tempori.id); if (mounted.current) await loadTemporiItems(); } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : '서버 저장 실패'); } finally { if (mounted.current) setUploadingId(null); } }}>{uploadingId === tempori.id ? '서버에 저장 중…' : '서버 저장 재시도'}</Button>}
                <Button
                  type="button"
                  variant="secondary"
                  className="tempori-list-delete"
                  aria-label={t('library.deleteTemporiAria', { title: tempori.title })}
                  onClick={() => {
                    setDeleteError(null);
                    setPendingDelete(tempori);
                  }}
                >
                  {t('common.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="upload-section-helper library-page__note">
        {t('library.addHelper')}{' '}
        <button
          type="button"
          className="library-page__guide"
          onClick={() => setIsMusicXmlGuideOpen(true)}
        >
          {t('library.musicXmlGuide')}
        </button>
      </p>

      <MusicXmlGuideModal
        isOpen={isMusicXmlGuideOpen}
        onClose={() => setIsMusicXmlGuideOpen(false)}
      />
    </main>
  );
}

export function TemporiLibraryPage() {
  const account = useAuthStore((state) => state.userId);
  return (
    <TemporiI18nProvider>
      <TemporiLibraryPageInner key={account ?? "guest"} />
    </TemporiI18nProvider>
  );
}
