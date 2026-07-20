import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MusicXmlGuideModal } from '../features/score/components/MusicXmlGuideModal';
import { ScoreDeleteConfirm } from '../features/score/components/ScoreDeleteConfirm';
import { ScoreUploadConfirm } from '../features/score/components/ScoreUploadConfirm';
import { ScoreI18nProvider, useTranslation } from '../features/score/i18n/LanguageContext';
import {
  deleteLibraryScore,
  fetchLibraryScores,
  saveScore,
} from '../features/score/services/scoreRepository';
import type { LibraryScoreItem } from '../features/score/types/library';
import {
  extractScoreMetadataFromFile,
  getScoreFileInputAccept,
} from '../features/score/utils/musicXmlMetadata';
import { resolveErrorMessage } from '../features/score/utils/resolveErrorMessage';
import { filterLibraryScoresByQuery } from '../features/score/utils/scoreSearch';
import { Button } from '../components/ui/Button';

function ScoreLibraryPageInner() {
  const t = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scores, setScores] = useState<LibraryScoreItem[]>([]);
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
  const [pendingDelete, setPendingDelete] = useState<LibraryScoreItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadScores = async () => {
    setIsLoading(true);
    setError(null);
    setScores([]);
    try {
      const libraryScores = await fetchLibraryScores();
      setScores(libraryScores);
    } catch (err) {
      setError(resolveErrorMessage(t, err, 'library.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadScores();
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
      const metadata = await extractScoreMetadataFromFile(file);
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
      await saveScore(pendingFile, title, confirmArtist.trim() || undefined);
      clearPendingUpload();
      await loadScores();
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
      await deleteLibraryScore(pendingDelete);
      setPendingDelete(null);
      await loadScores();
    } catch (err) {
      setDeleteError(resolveErrorMessage(t, err, 'library.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredScores = useMemo(
    () => filterLibraryScoresByQuery(scores, searchQuery),
    [scores, searchQuery],
  );

  const hasSearchQuery = searchQuery.trim().length > 0;
  const scoreFileAccept = getScoreFileInputAccept();

  return (
    <main className="score-main library-page">
      <Link to="/" className="back-link">
        {t('common.homeBack')}
      </Link>
      <p className="page-kicker">음악</p>
      <h1>{t('library.title')}</h1>
      <p className="score-lead">{t('library.subtitle')}</p>

      {!isLoading && scores.length > 0 && (
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

      <section className="upload-section surface-card">
        <h2>{t('library.addSectionTitle')}</h2>
        <p className="upload-section-helper">{t('library.addHelper')}</p>
        <form onSubmit={handleUploadSubmit} className="upload-form upload-form--file-only">
          <input
            ref={fileInputRef}
            id="score-file-input"
            type="file"
            accept={scoreFileAccept}
            onChange={handleFileChange}
            hidden
          />
          <div className="upload-form-actions">
            <Button type="submit" disabled={isParsingFile || isSaving}>
              {isParsingFile ? t('library.parsingFile') : t('library.importLocal')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setIsMusicXmlGuideOpen(true)}>
              {t('library.musicXmlGuide')}
            </Button>
          </div>
        </form>
      </section>

      {error && <p className="form-error score-viewer-error">{error}</p>}

      {pendingFile && (
        <ScoreUploadConfirm
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
        <ScoreDeleteConfirm
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

      <section className="score-list-section surface-card">
        <div className="score-list-section-head">
          <h2>{t('library.listTitle')}</h2>
          {!isLoading && scores.length > 0 && (
            <span className="score-list-meta">
              {hasSearchQuery
                ? t('library.searchResultMeta', {
                    filtered: filteredScores.length,
                    total: scores.length,
                  })
                : t('library.totalMeta', { total: scores.length })}
            </span>
          )}
        </div>

        {isLoading && <p>{t('common.loading')}</p>}
        {!isLoading && scores.length === 0 && (
          <div className="library-empty-state">
            <p>{t('library.emptyTitle')}</p>
            <p className="library-empty-state-sub">{t('library.emptySubtitle')}</p>
          </div>
        )}
        {!isLoading && scores.length > 0 && filteredScores.length === 0 && (
          <p className="library-search-empty">{t('library.searchEmpty')}</p>
        )}
        <ul className="score-list">
          {filteredScores.map((score) => (
            <li key={score.id} className="score-list-row">
              <Link
                to={`/hobbies/score-viewer/${score.id}`}
                className="score-list-item score-list-item--link"
              >
                <strong>{score.title}</strong>
                {score.artist && <span className="score-artist">{score.artist}</span>}
              </Link>
              <div className="score-list-actions">
                <Button
                  type="button"
                  variant="secondary"
                  className="score-list-delete"
                  aria-label={t('library.deleteScoreAria', { title: score.title })}
                  onClick={() => {
                    setDeleteError(null);
                    setPendingDelete(score);
                  }}
                >
                  {t('common.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <MusicXmlGuideModal
        isOpen={isMusicXmlGuideOpen}
        onClose={() => setIsMusicXmlGuideOpen(false)}
      />
    </main>
  );
}

export function ScoreLibraryPage() {
  return (
    <ScoreI18nProvider>
      <ScoreLibraryPageInner />
    </ScoreI18nProvider>
  );
}
