import { useEffect, useState } from 'react';
import { useTranslation } from '../../features/veveno/i18n/LanguageContext';
import { VevenoButton } from './VevenoButton';
import { VevenoInput } from './VevenoInput';
import { VevenoModal } from './VevenoModal';

interface VevenoStoreDeleteDialogProps {
  open: boolean;
  storeName: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function VevenoStoreDeleteDialog({
  open,
  storeName,
  loading = false,
  onConfirm,
  onCancel,
}: VevenoStoreDeleteDialogProps) {
  const t = useTranslation();
  const [confirmation, setConfirmation] = useState('');
  const canConfirm = confirmation.trim() === storeName;

  useEffect(() => {
    if (!open) {
      setConfirmation('');
    }
  }, [open, storeName]);

  return (
    <VevenoModal open={open} title={t('deleteStore.title')} onClose={onCancel} closeOnBackdrop={!loading}>
      <p className="veveno-modal__lead">
        {t('deleteStore.leadName', { name: storeName })}
      </p>
      <div className="veveno-modal__field">
        <VevenoInput
          className="veveno-store-delete__field"
          label={t('deleteStore.typeName', { name: storeName })}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={storeName}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={loading}
        />
      </div>
      <div className="veveno-modal__actions">
        <VevenoButton variant="secondary" onClick={onCancel} disabled={loading}>
          {t('common.cancel')}
        </VevenoButton>
        <VevenoButton
          variant="danger"
          onClick={onConfirm}
          disabled={!canConfirm}
          loading={loading}
        >
          {t('common.delete')}
        </VevenoButton>
      </div>
    </VevenoModal>
  );
}
