import { useEffect, type FormEvent } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { Button } from '../../../components/ui/Button';

interface ScoreUploadConfirmProps {
  fileName: string;
  title: string;
  artist: string;
  isUploading: boolean;
  error: string | null;
  onTitleChange: (value: string) => void;
  onArtistChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ScoreUploadConfirm({
  fileName,
  title,
  artist,
  isUploading,
  error,
  onTitleChange,
  onArtistChange,
  onCancel,
  onConfirm,
}: ScoreUploadConfirmProps) {
  const t = useTranslation();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isUploading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUploading, onCancel]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onConfirm();
  };

  return (
    <div
      className="score-upload-confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t('score.uploadDialogLabel')}
    >
      <form className="score-upload-confirm-card" onSubmit={handleSubmit}>
        <p className="score-upload-confirm-kicker">{t('score.uploadKicker')}</p>
        <h3>{t('score.uploadTitle')}</h3>
        <p className="score-upload-confirm-desc">{t('score.uploadDesc')}</p>
        <p className="score-upload-confirm-file">
          {t('score.uploadFileLabel')}: <span>{fileName}</span>
        </p>

        <label>
          {t('score.uploadTitleLabel')}
          <input
            type="text"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder={t('score.uploadTitlePlaceholder')}
            required
            autoFocus
          />
        </label>

        <label>
          {t('score.uploadArtistLabel')}
          <input
            type="text"
            value={artist}
            onChange={(event) => onArtistChange(event.target.value)}
            placeholder={t('score.uploadArtistPlaceholder')}
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="score-upload-confirm-actions">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isUploading}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isUploading || title.trim().length === 0}>
            {isUploading ? t('score.uploading') : t('score.upload')}
          </Button>
        </div>
      </form>
    </div>
  );
}
