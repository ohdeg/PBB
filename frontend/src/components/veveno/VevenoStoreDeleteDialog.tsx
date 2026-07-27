import { useEffect, useState } from 'react';
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
  const [confirmation, setConfirmation] = useState('');
  const canConfirm = confirmation === storeName;

  useEffect(() => {
    if (!open) {
      setConfirmation('');
    }
  }, [open, storeName]);

  return (
    <VevenoModal open={open} title="가게 삭제" onClose={onCancel} closeOnBackdrop={!loading}>
      <p className="brew-modal__lead">
        <strong>&quot;{storeName}&quot;</strong> 가게를 삭제하면 메뉴, 레시피, 재고, 구독 등 모든
        데이터가 영구 삭제되며 되돌릴 수 없습니다.
      </p>
      <div className="brew-modal__field">
        <VevenoInput
          label={`"${storeName}"을(를) 입력하세요`}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={storeName}
          autoComplete="off"
          disabled={loading}
        />
      </div>
      <div className="brew-modal__actions">
        <VevenoButton variant="secondary" onClick={onCancel} disabled={loading}>
          취소
        </VevenoButton>
        <VevenoButton
          variant="danger"
          onClick={onConfirm}
          disabled={!canConfirm}
          loading={loading}
        >
          삭제
        </VevenoButton>
      </div>
    </VevenoModal>
  );
}
