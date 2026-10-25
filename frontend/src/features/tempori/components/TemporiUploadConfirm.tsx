import type { FormEvent } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';

interface TemporiUploadConfirmProps {
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

export function TemporiUploadConfirm({
  fileName,
  title,
  artist,
  isUploading,
  error,
  onTitleChange,
  onArtistChange,
  onCancel,
  onConfirm,
}: TemporiUploadConfirmProps) {
  const t = useTranslation();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onConfirm();
  };

  return (
    <Dialog
      open
      initialFocus="panel"
      title={t('tempori.uploadDialogLabel')}
      onClose={onCancel}
      closeOnBackdrop={false}
      closeOnEscape={!isUploading}
      backdropClassName="tempori-upload-confirm-backdrop"
      panelClassName="tempori-upload-confirm-card"
    >
      {({ titleId }) => (
      <form className="contents" onSubmit={handleSubmit}>
        <p className="tempori-upload-confirm-kicker">{t('tempori.uploadKicker')}</p>
        <h3 id={titleId}>{t('tempori.uploadTitle')}</h3>
        <p className="tempori-upload-confirm-desc">{t('tempori.uploadDesc')}</p>
        <p className="tempori-upload-confirm-file">
          {t('tempori.uploadFileLabel')}: <span>{fileName}</span>
        </p>

        <label>
          {t('tempori.uploadTitleLabel')}
          <input
            type="text"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder={t('tempori.uploadTitlePlaceholder')}
            required
            name="title"
            autoComplete="off"
          />
        </label>

        <label>
          {t('tempori.uploadArtistLabel')}
          <input
            type="text"
            name="artist"
            autoComplete="off"
            value={artist}
            onChange={(event) => onArtistChange(event.target.value)}
            placeholder={t('tempori.uploadArtistPlaceholder')}
          />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="tempori-upload-confirm-actions">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isUploading}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isUploading || title.trim().length === 0}>
            {isUploading ? t('tempori.uploading') : t('tempori.upload')}
          </Button>
        </div>
      </form>
      )}
    </Dialog>
  );
}
