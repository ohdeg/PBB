import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MusicXmlGuideModal } from '../features/tempori/components/MusicXmlGuideModal';
import { TemporiDeleteConfirm } from '../features/tempori/components/TemporiDeleteConfirm';
import { TemporiUploadConfirm } from '../features/tempori/components/TemporiUploadConfirm';
import { TemporiI18nProvider, useTranslation } from '../features/tempori/i18n/LanguageContext';
import {
  deleteLibraryTempori,
  fetchLibraryTemporiItems,
  saveTempori,
} from '../features/tempori/services/temporiRepository';
import type { LibraryTemporiItem } from '../features/tempori/types/library';
import {
  extractTemporiMetadataFromFile,
  getTemporiFileInputAccept,
} from '../features/tempori/utils/musicXmlMetadata';
import { resolveErrorMessage } from '../features/tempori/utils/resolveErrorMessage';
import { filterLibraryTemporiItemsByQuery } from '../features/tempori/utils/temporiSearch';
import { Button } from '../components/ui/Button';

function TemporiLibraryPageInner() {
  const t = useTranslation();
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
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadTemporiItems = async () => {
    setIsLoading(true);
    setError(null);
    setTemporiItems([]);
    try {
      const libraryTemporiItems = await fetchLibraryTemporiItems();
      setTemporiItems(libraryTemporiItems);
    } catch (err) {
      setError(resolveErrorMessage(t, err, 'library.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTemporiItems();
  }, []);

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
      await saveTempori(pendingFile, title, confirmArtist.trim() || undefined);
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
      setDeleteError(resolveErrorMessage(t, err, 'library.deleteFailed'));
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

      {pendingFile && (
        <TemporiUploadConfirm
          fileName={pendingFile.name}
          title={confirmTitle}
          artist={confirmArtist}
          isUploading={isSaving}
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
        {!isLoading && temporiItems.length === 0 && (
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
                {tempori.artist && <span className="tempori-artist">{tempori.artist}</span>}
              </Link>
              <div className="tempori-list-actions">
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
  return (
    <TemporiI18nProvider>
      <TemporiLibraryPageInner />
    </TemporiI18nProvider>
  );
}
