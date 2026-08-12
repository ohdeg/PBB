import type { FormEvent } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';

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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onConfirm();
  };

  return (
    <Dialog
      open
      title={t('score.uploadDialogLabel')}
      onClose={onCancel}
      closeOnBackdrop={false}
      closeOnEscape={!isUploading}
      backdropClassName="score-upload-confirm-backdrop"
      panelClassName="score-upload-confirm-card"
    >
      {({ titleId }) => (
      <form className="contents" onSubmit={handleSubmit}>
        <p className="score-upload-confirm-kicker">{t('score.uploadKicker')}</p>
        <h3 id={titleId}>{t('score.uploadTitle')}</h3>
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
      )}
    </Dialog>
  );
}
