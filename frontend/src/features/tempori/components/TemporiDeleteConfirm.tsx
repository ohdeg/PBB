import { useTranslation } from '../i18n/LanguageContext';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';

interface TemporiDeleteConfirmProps {
  title: string;
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function TemporiDeleteConfirm({
  title,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: TemporiDeleteConfirmProps) {
  const t = useTranslation();

  return (
    <Dialog
      open
      title={t('tempori.deleteDialogLabel')}
      onClose={onCancel}
      closeOnBackdrop={false}
      closeOnEscape={!isDeleting}
      backdropClassName="tempori-delete-confirm-backdrop"
      panelClassName="tempori-delete-confirm-card"
    >
      {({ titleId }) => (
        <>
        <p className="tempori-delete-confirm-kicker">{t('tempori.deleteKicker')}</p>
        <h3 id={titleId}>{t('tempori.deleteTitle')}</h3>
        <p className="tempori-delete-confirm-desc">
          <strong>{title}</strong>
          {t('tempori.deleteDescSuffix')}
        </p>
        {error && <p className="form-error">{error}</p>}
        <div className="tempori-delete-confirm-actions">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isDeleting}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            className="tempori-delete-confirm-submit"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? t('tempori.deleting') : t('common.delete')}
          </Button>
        </div>
        </>
      )}
    </Dialog>
  );
}
