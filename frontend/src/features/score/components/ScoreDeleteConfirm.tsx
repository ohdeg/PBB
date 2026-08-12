import { useTranslation } from '../i18n/LanguageContext';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';

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

  return (
    <Dialog
      open
      title={t('score.deleteDialogLabel')}
      onClose={onCancel}
      closeOnBackdrop={false}
      closeOnEscape={!isDeleting}
      backdropClassName="score-delete-confirm-backdrop"
      panelClassName="score-delete-confirm-card"
    >
      {({ titleId }) => (
        <>
        <p className="score-delete-confirm-kicker">{t('score.deleteKicker')}</p>
        <h3 id={titleId}>{t('score.deleteTitle')}</h3>
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
        </>
      )}
    </Dialog>
  );
}
