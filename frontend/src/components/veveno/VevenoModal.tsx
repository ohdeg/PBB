import type { ReactNode } from 'react';
import { Dialog } from '../ui/Dialog';
import { useTranslation } from '../../features/veveno/i18n/LanguageContext';

interface VevenoModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeOnBackdrop?: boolean;
}

export function VevenoModal({
  open,
  title,
  onClose,
  children,
  closeOnBackdrop = true,
}: VevenoModalProps) {
  const t = useTranslation();
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      closeOnBackdrop={closeOnBackdrop}
      backdropClassName="veveno-modal-backdrop"
      panelClassName="veveno-modal"
    >
      {({ titleId }) => (
        <>
        <div className="veveno-modal__head">
          <h2 id={titleId} className="veveno-modal__title">
            {title}
          </h2>
          <button
            type="button"
            className="veveno-modal__close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>
        <div className="veveno-modal__body">{children}</div>
        </>
      )}
    </Dialog>
  );
}
