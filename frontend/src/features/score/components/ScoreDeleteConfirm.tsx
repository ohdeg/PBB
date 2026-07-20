import { useEffect } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { Button } from '../../../components/ui/Button';

interface ScoreDeleteConfirmProps {
  title: string;
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ScoreDeleteConfirm({
  title,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: ScoreDeleteConfirmProps) {
  const t = useTranslation();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDeleting, onCancel]);

  return (
    <div
      className="score-delete-confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t('score.deleteDialogLabel')}
    >
      <div className="score-delete-confirm-card">
        <p className="score-delete-confirm-kicker">{t('score.deleteKicker')}</p>
        <h3>{t('score.deleteTitle')}</h3>
        <p className="score-delete-confirm-desc">
          <strong>{title}</strong>
          {t('score.deleteDescSuffix')}
        </p>
        {error && <p className="form-error">{error}</p>}
        <div className="score-delete-confirm-actions">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isDeleting}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            className="score-delete-confirm-submit"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? t('score.deleting') : t('common.delete')}
          </Button>
        </div>
      </div>
    </div>
  );
}
