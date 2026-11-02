import { useTranslation } from '../i18n/LanguageContext';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';

interface TemporiDeleteConfirmProps {
  title: string;
  scope?: 'account' | 'device';
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function TemporiDeleteConfirm({
  title,
  scope,
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
        {scope && <p>{scope === 'account' ? '계정 원본과 동기화된 필기·연습 상태가 삭제됩니다. 별도로 가져온 기기 원본은 유지됩니다.' : '이 기기의 원본과 해당 기기 필기를 삭제합니다. 계정에 저장된 사본은 유지됩니다.'}</p>}
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
